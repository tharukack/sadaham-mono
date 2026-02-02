import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../components/ui/use-toast';

export default function SmsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['sms-templates'],
    queryFn: async () => (await api.get('/sms/templates')).data,
  });
  const [currentRole, setCurrentRole] = useState<string>('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [originalBody, setOriginalBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { toast } = useToast();

  const templateOrder = useMemo(
    () => [
      {
        name: 'Order Confirmation',
        defaultBody: 'Hi {{firstName}}, your order is confirmed.',
      },
      {
        name: 'Order Reminder',
        defaultBody: 'Hi {{firstName}}, just a reminder about your order pickup.',
      },
      {
        name: 'Thank You Note',
        defaultBody: 'Hi {{firstName}}, thank you for your order!',
      },
    ],
    []
  );

  const templatesByName = useMemo(() => {
    const map = new Map<string, any>();
    (data || []).forEach((tpl: any) => {
      if (tpl?.name) map.set(tpl.name, tpl);
    });
    return map;
  }, [data]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('user');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setCurrentRole(parsed?.role || '');
    } catch {
      setCurrentRole('');
    }
  }, []);

  useEffect(() => {
    const next: Record<string, string> = {};
    templateOrder.forEach((tpl) => {
      next[tpl.name] = templatesByName.get(tpl.name)?.body || tpl.defaultBody;
    });
    setForm(next);
  }, [templateOrder, templatesByName]);

  const isAdmin = currentRole === 'ADMIN';

  const placeholderTokens = ['{{firstName}}', '{{lastName}}', '{{pickupLocation}}', '{{pickupDate}}'];

  const openEditor = (name: string) => {
    const body = form[name] || '';
    setSelectedName(name);
    setDraftBody(body);
    setOriginalBody(body);
  };

  const closeEditor = () => {
    setSelectedName(null);
    setDraftBody('');
    setOriginalBody('');
  };

  const insertPlaceholder = (token: string) => {
    if (!textareaRef.current) return;
    const input = textareaRef.current;
    const start = input.selectionStart ?? draftBody.length;
    const end = input.selectionEnd ?? draftBody.length;
    const next = `${draftBody.slice(0, start)}${token}${draftBody.slice(end)}`;
    setDraftBody(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + token.length;
      input.setSelectionRange(cursor, cursor);
    });
  };

  const saveTemplate = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!selectedName) return;
    const body = draftBody || '';
    if (!body.trim()) {
      toast({ variant: 'destructive', title: 'Body is required' });
      return;
    }
    if (body === originalBody) return;
    setSaving(true);
    try {
      const existing = templatesByName.get(selectedName);
      if (existing?.id) {
        await api.patch(`/sms/templates/${existing.id}`, { body });
      } else {
        await api.post('/sms/templates', { name: selectedName, body });
      }
      await queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
      setForm((prev) => ({ ...prev, [selectedName]: body }));
      setOriginalBody(body);
      toast({ title: 'Template saved' });
      closeEditor();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: err?.response?.data?.message || 'Unable to save template.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="SMS Templates">
      <PageHeader
        title="SMS Templates"
        description="Manage the core SMS messages used across campaigns."
      />
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading templates...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templateOrder.map((tpl) => (
                  <TableRow key={tpl.name}>
                    <TableCell className="font-medium">{tpl.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {form[tpl.name] || tpl.defaultBody}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEditor(tpl.name)}
                      >
                        {isAdmin ? 'Edit' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!selectedName} onOpenChange={(open) => (!open ? closeEditor() : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTemplate} className="space-y-4">
            <div className="space-y-2">
              <Label>Message body</Label>
              <Textarea
                ref={textareaRef}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={4}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label>Placeholders</Label>
              <div className="flex flex-wrap gap-2">
                {placeholderTokens.map((token) => (
                  <Button
                    key={token}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => insertPlaceholder(token)}
                    disabled={!isAdmin}
                  >
                    {token}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                disabled={!isAdmin || saving || draftBody === originalBody}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button type="button" variant="secondary" onClick={closeEditor}>
                Close
              </Button>
              {!isAdmin && (
                <span className="text-xs text-muted-foreground">
                  Only admins can edit SMS templates.
                </span>
              )}
              {isAdmin && draftBody === originalBody && (
                <span className="text-xs text-muted-foreground">
                  Make a change to enable saving.
                </span>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
