import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { badgeVariants } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../components/ui/use-toast';
import { cn } from '../../lib/utils';

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ`¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€';

type SmsCount = {
  encoding: 'GSM-7' | 'UCS-2';
  characters: number;
  segments: number;
  remainingInSegment: number;
};

const countGsm7Units = (text: string) => {
  let units = 0;
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch)) {
      units += 1;
      continue;
    }
    if (GSM7_EXTENDED.includes(ch)) {
      units += 2;
      continue;
    }
    return null;
  }
  return units;
};

const countSms = (text: string): SmsCount => {
  const gsmUnits = countGsm7Units(text);
  if (gsmUnits !== null) {
    const single = 160;
    const concat = 153;
    const segments = gsmUnits <= single ? 1 : Math.ceil(gsmUnits / concat);
    const segmentSize = segments === 1 ? single : concat;
    const usedInSegment =
      segments === 1 ? gsmUnits : gsmUnits - (segments - 1) * concat;
    return {
      encoding: 'GSM-7',
      characters: gsmUnits,
      segments,
      remainingInSegment: Math.max(segmentSize - usedInSegment, 0),
    };
  }

  const ucsUnits = text.length;
  const single = 70;
  const concat = 67;
  const segments = ucsUnits <= single ? 1 : Math.ceil(ucsUnits / concat);
  const segmentSize = segments === 1 ? single : concat;
  const usedInSegment =
    segments === 1 ? ucsUnits : ucsUnits - (segments - 1) * concat;
  return {
    encoding: 'UCS-2',
    characters: ucsUnits,
    segments,
    remainingInSegment: Math.max(segmentSize - usedInSegment, 0),
  };
};

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
        name: 'Order Modified',
        defaultBody: 'Hi {{firstName}}, your order has been updated.',
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

  const placeholderGroups = [
    {
      title: 'Variable',
      items: [
        { label: 'Total Orders', token: '{{totalOrders}}', optional: true },
        { label: 'Chicken Qty', token: '{{chickenQty}}', optional: true },
        { label: 'Fish Qty', token: '{{fishQty}}', optional: true },
        { label: 'Veg Qty', token: '{{vegQty}}', optional: true },
        { label: 'Egg Qty', token: '{{eggQty}}', optional: true },
        { label: 'Other Qty', token: '{{otherQty}}', optional: true },
        { label: 'Notes', token: '{{notes}}', optional: true },
        { label: 'Pickup By', token: '{{pickupBy}}', optional: true },
      ],
    },
    {
      title: 'Other',
      items: [
        { label: 'First Name', token: '{{firstName}}' },
        { label: 'Last Name', token: '{{lastName}}' },
        { label: 'Campaign Name', token: '{{campaignName}}' },
        { label: 'Event Date', token: '{{eventDate}}' },
        { label: 'Last Date For Changes', token: '{{lastDateForChanges}}' },
        { label: 'Pickup Location', token: '{{pickupLocation}}' },
        { label: 'Pickup Address', token: '{{pickupAddress}}' },
        { label: 'Total Cost', token: '{{totalCost}}' },
        { label: 'Chicken Cost', token: '{{chickenCost}}' },
        { label: 'Fish Cost', token: '{{fishCost}}' },
        { label: 'Veg Cost', token: '{{vegCost}}' },
        { label: 'Egg Cost', token: '{{eggCost}}' },
        { label: 'Other Cost', token: '{{otherCost}}' },
        { label: 'Distributor Name', token: '{{distributorName}}' },
        { label: 'Distributor Mobile', token: '{{distributorMobile}}' },
        { label: 'Distributor Address', token: '{{distributorAddress}}' },
        { label: 'Order Entered By', token: '{{enteredByName}}' },
        { label: 'Order Entered Mobile', token: '{{enteredByMobile}}' },
        { label: 'Main Collector', token: '{{mainCollectorName}}' },
        { label: 'Main Collector Mobile', token: '{{mainCollectorMobile}}' },
      ],
    },
  ];

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

  const smsCount = useMemo(() => countSms(draftBody || ''), [draftBody]);

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
        <DialogContent className="max-w-4xl h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTemplate} className="flex h-full flex-col space-y-6">
            <div className="grid h-full gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="flex h-full flex-col space-y-4">
                <div className="flex h-full flex-col space-y-2">
                  <Label>Message body</Label>
                  <Textarea
                    ref={textareaRef}
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="min-h-0 flex-1 resize-none"
                    disabled={!isAdmin}
                  />
                  <div className="text-xs text-muted-foreground">
                    Chars: {smsCount.characters} | Encoding: {smsCount.encoding} | Segments:{' '}
                    {smsCount.segments} | Remaining in segment:{' '}
                    {smsCount.remainingInSegment}
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
              </div>
              <div className="flex h-full flex-col space-y-4 overflow-y-auto pr-1">
                <Label>Placeholders</Label>
                <div className="space-y-3">
                  {placeholderGroups.map((group) => (
                    <div key={group.title} className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.title}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {group.items.map(({ label, token, optional }) => (
                          <button
                            key={token}
                            type="button"
                            onClick={() => insertPlaceholder(token)}
                            disabled={!isAdmin}
                            className={cn(
                              badgeVariants({ variant: optional ? 'outline' : 'secondary' }),
                              'w-full justify-center gap-2 px-2 py-1 text-[11px] font-medium',
                              optional &&
                                'border-amber-400/70 bg-amber-50/70 text-amber-700 hover:bg-amber-50',
                              !optional && 'hover:bg-secondary/70',
                              !isAdmin && 'cursor-not-allowed opacity-60'
                            )}
                          >
                            <span className="truncate">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Lines containing optional placeholders are omitted when the value is empty or
                  zero. The pickup-by line is also omitted when the pickup person is the same as
                  the customer.
                </p>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
