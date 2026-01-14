import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useToast } from '../../components/ui/use-toast';

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get('/locations')).data,
  });
  const [currentRole, setCurrentRole] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const { toast } = useToast();

  const isAdmin = currentRole === 'ADMIN';

  const [form, setForm] = useState({
    name: '',
    address: '',
    distributorName: '',
    distributorMobile: '',
  });

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

  const locations = useMemo(() => (data || []) as any[], [data]);
  const editingLocation = useMemo(
    () => locations.find((loc) => loc.id === editingId),
    [locations, editingId]
  );

  useEffect(() => {
    if (!editingLocation) return;
    setForm({
      name: editingLocation.name || '',
      address: editingLocation.address || '',
      distributorName: editingLocation.distributorName || '',
      distributorMobile: editingLocation.distributorMobile || '',
    });
  }, [editingLocation]);

  const resetForm = () => {
    setForm({
      name: '',
      address: '',
      distributorName: '',
      distributorMobile: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setFormLoading(true);
    try {
      if (editingId) {
        await api.patch(`/locations/${editingId}`, form);
      } else {
        await api.post('/locations', form);
      }
      await queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({ title: editingId ? 'Location updated' : 'Location created' });
      resetForm();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: err?.response?.data?.message || 'Unable to save location.',
      });
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <AppShell title="Pickup Locations">
      <PageHeader
        title="Pickup Locations"
        description="Review pickup points and distributor assignments."
        actions={
          <Button
            disabled={!isAdmin}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            Add Location
          </Button>
        }
      />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Location' : 'Add Location'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-name">Location Name</Label>
              <Input
                id="location-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-address">Address</Label>
              <Input
                id="location-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-distributor-name">Distributor Name</Label>
              <Input
                id="location-distributor-name"
                value={form.distributorName}
                onChange={(e) => setForm({ ...form, distributorName: e.target.value })}
                required
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-distributor-mobile">Distributor Mobile</Label>
              <Input
                id="location-distributor-mobile"
                value={form.distributorMobile}
                onChange={(e) => setForm({ ...form, distributorMobile: e.target.value })}
                required
                disabled={!isAdmin}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!isAdmin || formLoading}>
                {formLoading ? 'Saving...' : 'Save Location'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading locations...
            </div>
          ) : locations.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No pickup locations available.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Distributor</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc: any) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell>{loc.address}</TableCell>
                    <TableCell>
                      {loc.distributorName} ({loc.distributorMobile})
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingId(loc.id);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
