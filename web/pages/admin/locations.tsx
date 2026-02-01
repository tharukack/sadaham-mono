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
  const [distributorSearch, setDistributorSearch] = useState('');
  const [distributorLabel, setDistributorLabel] = useState('');
  const [transporterSearch, setTransporterSearch] = useState('');
  const [transporterLabel, setTransporterLabel] = useState('');
  const { toast } = useToast();

  const isAdmin = currentRole === 'ADMIN';

  const [form, setForm] = useState({
    name: '',
    address: '',
    distributorName: '',
    distributorMobile: '',
    distributorCustomerId: '',
    transporterCustomerId: '',
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
      distributorCustomerId: editingLocation.distributorCustomerId || '',
      transporterCustomerId: editingLocation.transporterCustomerId || '',
    });
    if (editingLocation.distributorCustomer) {
      const fullName = `${editingLocation.distributorCustomer.firstName} ${editingLocation.distributorCustomer.lastName}`.trim();
      const mobile = editingLocation.distributorCustomer.mobile
        ? ` (${editingLocation.distributorCustomer.mobile})`
        : '';
      setDistributorLabel(`${fullName}${mobile}`);
    } else if (editingLocation.distributorName || editingLocation.distributorMobile) {
      const mobile = editingLocation.distributorMobile
        ? ` (${editingLocation.distributorMobile})`
        : '';
      setDistributorLabel(`${editingLocation.distributorName || 'Distributor'}${mobile}`);
    } else {
      setDistributorLabel('');
    }
    if (editingLocation.transporterCustomer) {
      const fullName = `${editingLocation.transporterCustomer.firstName} ${editingLocation.transporterCustomer.lastName}`.trim();
      const mobile = editingLocation.transporterCustomer.mobile
        ? ` (${editingLocation.transporterCustomer.mobile})`
        : '';
      setTransporterLabel(`${fullName}${mobile}`);
    } else {
      setTransporterLabel('');
    }
  }, [editingLocation]);

  const resetForm = () => {
    setForm({
      name: '',
      address: '',
      distributorName: '',
      distributorMobile: '',
      distributorCustomerId: '',
      transporterCustomerId: '',
    });
    setEditingId(null);
    setShowForm(false);
    setDistributorSearch('');
    setDistributorLabel('');
    setTransporterSearch('');
    setTransporterLabel('');
  };

  const distributorQuery = useQuery({
    queryKey: ['distributor-search', distributorSearch],
    queryFn: async () =>
      (await api.get('/customers/search', { params: { q: distributorSearch } })).data,
    enabled: isAdmin && distributorSearch.trim().length > 0,
  });

  const transporterQuery = useQuery({
    queryKey: ['transporter-search', transporterSearch],
    queryFn: async () =>
      (await api.get('/customers/search', { params: { q: transporterSearch } })).data,
    enabled: isAdmin && transporterSearch.trim().length > 0,
  });

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
              <Label>Distributor</Label>
              <Input
                value={distributorSearch}
                onChange={(e) => setDistributorSearch(e.target.value)}
                placeholder="Search customer by name or mobile"
                disabled={!isAdmin}
              />
            </div>
            {distributorSearch.trim().length > 0 && (
              <div className="rounded-md border">
                {distributorQuery.isLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading customers...</div>
                ) : (distributorQuery.data || []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No customers found.</div>
                ) : (
                  (distributorQuery.data || []).map((c: any) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={form.distributorCustomerId === c.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start rounded-none"
                      onClick={() => {
                        setForm({
                          ...form,
                          distributorCustomerId: c.id,
                          distributorName: `${c.firstName} ${c.lastName}`.trim(),
                          distributorMobile: c.mobile || '',
                        });
                        const fullName = `${c.firstName} ${c.lastName}`.trim();
                        const mobile = c.mobile ? ` (${c.mobile})` : '';
                        setDistributorLabel(`${fullName}${mobile}`);
                        setDistributorSearch('');
                      }}
                      disabled={!isAdmin}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.mobile}</div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Distributor:{' '}
              {form.distributorCustomerId
                ? distributorLabel || 'Selected'
                : form.distributorName || 'Not selected'}
            </div>
            <div className="space-y-2">
              <Label>Transporter (Customer)</Label>
              <Input
                value={transporterSearch}
                onChange={(e) => setTransporterSearch(e.target.value)}
                placeholder="Search customer by name or mobile"
                disabled={!isAdmin}
              />
            </div>
            {transporterSearch.trim().length > 0 && (
              <div className="rounded-md border">
                {transporterQuery.isLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading customers...</div>
                ) : (transporterQuery.data || []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No customers found.</div>
                ) : (
                  (transporterQuery.data || []).map((c: any) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={form.transporterCustomerId === c.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start rounded-none"
                      onClick={() => {
                        setForm({ ...form, transporterCustomerId: c.id });
                        const fullName = `${c.firstName} ${c.lastName}`.trim();
                        const mobile = c.mobile ? ` (${c.mobile})` : '';
                        setTransporterLabel(`${fullName}${mobile}`);
                        setTransporterSearch('');
                      }}
                      disabled={!isAdmin}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.mobile}</div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Transporter: {form.transporterCustomerId ? transporterLabel || 'Selected' : 'Not selected'}
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
                  <TableHead>Transporter</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc: any) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell>{loc.address}</TableCell>
                    <TableCell>
                      {loc.distributorCustomer ? (
                        <>
                          <div className="text-sm font-medium">
                            {`${loc.distributorCustomer.firstName} ${loc.distributorCustomer.lastName}`.trim()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {loc.distributorCustomer.mobile || '-'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium">{loc.distributorName}</div>
                          <div className="text-xs text-muted-foreground">
                            {loc.distributorMobile}
                          </div>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {loc.transporterCustomer ? (
                        <>
                          <div className="text-sm font-medium">
                            {`${loc.transporterCustomer.firstName} ${loc.transporterCustomer.lastName}`.trim()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {loc.transporterCustomer.mobile || '-'}
                          </div>
                        </>
                      ) : (
                        '-'
                      )}
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
