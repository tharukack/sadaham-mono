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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useToast } from '../../components/ui/use-toast';
import { formatAuMobile, normalizeAuMobile } from '../../lib/phone';

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
  const [locationsSortBy, setLocationsSortBy] = useState<'created' | 'updated' | 'name'>(
    'updated'
  );
  const [locationsPage, setLocationsPage] = useState(1);
  const [locationsRowsPerPage, setLocationsRowsPerPage] = useState(10);
  const { toast } = useToast();

  const isAdmin = currentRole === 'ADMIN';
  const isDistributorSearchMobile = !!distributorSearch.trim() && /\d/.test(distributorSearch);
  const isTransporterSearchMobile = !!transporterSearch.trim() && /\d/.test(transporterSearch);

  const [form, setForm] = useState({
    name: '',
    address: '',
    distributorName: '',
    distributorMobile: '',
    deliveryTimeMinutes: '',
    distributionPriority: '',
    timeOfDispatch: '',
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
  const sortedLocations = useMemo(() => {
    const next = [...locations];
    next.sort((a: any, b: any) => {
      if (locationsSortBy === 'name') {
        return `${a.name || ''}`.localeCompare(`${b.name || ''}`);
      }
      const aDate = new Date(
        locationsSortBy === 'created' ? a.createdAt || 0 : a.updatedAt || 0,
      ).getTime();
      const bDate = new Date(
        locationsSortBy === 'created' ? b.createdAt || 0 : b.updatedAt || 0,
      ).getTime();
      return bDate - aDate;
    });
    return next;
  }, [locations, locationsSortBy]);
  const locationsPageCount = useMemo(() => {
    return Math.max(1, Math.ceil(sortedLocations.length / locationsRowsPerPage));
  }, [sortedLocations.length, locationsRowsPerPage]);
  const pagedLocations = useMemo(() => {
    const start = (locationsPage - 1) * locationsRowsPerPage;
    return sortedLocations.slice(start, start + locationsRowsPerPage);
  }, [sortedLocations, locationsPage, locationsRowsPerPage]);
  const editingLocation = useMemo(
    () => locations.find((loc) => loc.id === editingId),
    [locations, editingId]
  );
  const formatDispatchTime = (value?: string) => {
    if (!value) return '-';
    if (/(am|pm)/i.test(value)) return value;
    const [hoursRaw, minutesRaw] = value.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  useEffect(() => {
    if (!editingLocation) return;
    setForm({
      name: editingLocation.name || '',
      address: editingLocation.address || '',
      distributorName: editingLocation.distributorName || '',
      distributorMobile: normalizeAuMobile(editingLocation.distributorMobile || ''),
      deliveryTimeMinutes:
        typeof editingLocation.deliveryTimeMinutes === 'number'
          ? editingLocation.deliveryTimeMinutes.toString()
          : '',
      distributionPriority:
        typeof editingLocation.distributionPriority === 'number'
          ? editingLocation.distributionPriority.toString()
          : '',
      timeOfDispatch: editingLocation.timeOfDispatch || '',
      distributorCustomerId: editingLocation.distributorCustomerId || '',
      transporterCustomerId: editingLocation.transporterCustomerId || '',
    });
    if (editingLocation.distributorCustomer) {
      const fullName = `${editingLocation.distributorCustomer.firstName} ${editingLocation.distributorCustomer.lastName}`.trim();
      const mobile = editingLocation.distributorCustomer.mobile
        ? ` (${formatAuMobile(editingLocation.distributorCustomer.mobile)})`
        : '';
      setDistributorLabel(`${fullName}${mobile}`);
    } else if (editingLocation.distributorName || editingLocation.distributorMobile) {
      const mobile = editingLocation.distributorMobile
        ? ` (${formatAuMobile(editingLocation.distributorMobile)})`
        : '';
      setDistributorLabel(`${editingLocation.distributorName || 'Distributor'}${mobile}`);
    } else {
      setDistributorLabel('');
    }
    if (editingLocation.transporterCustomer) {
      const fullName = `${editingLocation.transporterCustomer.firstName} ${editingLocation.transporterCustomer.lastName}`.trim();
      const mobile = editingLocation.transporterCustomer.mobile
        ? ` (${formatAuMobile(editingLocation.transporterCustomer.mobile)})`
        : '';
      setTransporterLabel(`${fullName}${mobile}`);
    } else {
      setTransporterLabel('');
    }
  }, [editingLocation]);

  useEffect(() => {
    setLocationsPage(1);
  }, [locationsSortBy, locationsRowsPerPage]);

  useEffect(() => {
    setLocationsPage((prev) => Math.min(Math.max(prev, 1), locationsPageCount));
  }, [locationsPageCount]);

  const resetForm = () => {
    setForm({
      name: '',
      address: '',
      distributorName: '',
      distributorMobile: '',
      deliveryTimeMinutes: '',
      distributionPriority: '',
      timeOfDispatch: '',
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
    if (!form.distributorCustomerId) {
      toast({
        variant: 'destructive',
        title: 'Missing distributor',
        description: 'Select a distributor before saving.',
      });
      setFormLoading(false);
      return;
    }
    if (!form.transporterCustomerId) {
      toast({
        variant: 'destructive',
        title: 'Missing transporter',
        description: 'Select a transporter before saving.',
      });
      setFormLoading(false);
      return;
    }
    const toNumberOrUndefined = (value: string) => {
      if (!value.trim()) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const payload = {
      ...form,
      deliveryTimeMinutes: toNumberOrUndefined(form.deliveryTimeMinutes),
      distributionPriority: toNumberOrUndefined(form.distributionPriority),
      timeOfDispatch: form.timeOfDispatch.trim() ? form.timeOfDispatch : undefined,
    };
    try {
      if (editingId) {
        await api.patch(`/locations/${editingId}`, payload);
      } else {
        await api.post('/locations', payload);
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
      <PageHeader title="Pickup Locations" description="Review pickup points and distributor assignments." />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Location' : 'Add Location'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
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
              <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="delivery-time-minutes">Delivery Time (Minutes)</Label>
                  <Input
                    id="delivery-time-minutes"
                    type="number"
                    min={0}
                    value={form.deliveryTimeMinutes}
                    onChange={(e) => setForm({ ...form, deliveryTimeMinutes: e.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distribution-priority">Distribution Priority (1-99)</Label>
                  <Input
                    id="distribution-priority"
                    type="number"
                    min={1}
                    max={99}
                    value={form.distributionPriority}
                    onChange={(e) => setForm({ ...form, distributionPriority: e.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-of-dispatch">Time of Dispatch</Label>
                  <Input
                    id="time-of-dispatch"
                    type="time"
                    value={form.timeOfDispatch}
                    onChange={(e) => setForm({ ...form, timeOfDispatch: e.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Distributor</Label>
                <Input
                  value={distributorSearch}
                  onChange={(e) => setDistributorSearch(e.target.value)}
                  placeholder="Search customer by name or mobile"
                  disabled={!isAdmin}
                />
                {distributorSearch.trim().length > 0 && (
                  <div className="max-h-36 overflow-auto rounded-md border">
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
                              distributorMobile: normalizeAuMobile(c.mobile || ''),
                            });
                            const fullName = `${c.firstName} ${c.lastName}`.trim();
                            const mobile = c.mobile ? ` (${formatAuMobile(c.mobile)})` : '';
                            setDistributorLabel(`${fullName}${mobile}`);
                            setDistributorSearch('');
                          }}
                          disabled={!isAdmin}
                        >
                          <div className="text-left">
                            <div
                              className={
                                isDistributorSearchMobile
                                  ? 'text-xs text-muted-foreground'
                                  : 'text-sm font-medium'
                              }
                            >
                              {c.firstName} {c.lastName}
                            </div>
                            <div
                              className={
                                isDistributorSearchMobile
                                  ? 'text-sm font-medium'
                                  : 'text-xs text-muted-foreground'
                              }
                            >
                              {formatAuMobile(c.mobile || '')}
                            </div>
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Distributor:{' '}
                  {form.distributorCustomerId
                    ? distributorLabel || 'Selected'
                    : form.distributorName || 'Not selected'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Transporter</Label>
                <Input
                  value={transporterSearch}
                  onChange={(e) => setTransporterSearch(e.target.value)}
                  placeholder="Search customer by name or mobile"
                  disabled={!isAdmin}
                />
                {transporterSearch.trim().length > 0 && (
                  <div className="max-h-36 overflow-auto rounded-md border">
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
                            const mobile = c.mobile ? ` (${formatAuMobile(c.mobile)})` : '';
                            setTransporterLabel(`${fullName}${mobile}`);
                            setTransporterSearch('');
                          }}
                          disabled={!isAdmin}
                        >
                          <div className="text-left">
                            <div
                              className={
                                isTransporterSearchMobile
                                  ? 'text-xs text-muted-foreground'
                                  : 'text-sm font-medium'
                              }
                            >
                              {c.firstName} {c.lastName}
                            </div>
                            <div
                              className={
                                isTransporterSearchMobile
                                  ? 'text-sm font-medium'
                                  : 'text-xs text-muted-foreground'
                              }
                            >
                              {formatAuMobile(c.mobile || '')}
                            </div>
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Transporter: {form.transporterCustomerId ? transporterLabel || 'Selected' : 'Not selected'}
                </div>
              </div>
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
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Locations</CardTitle>
          <Button
            disabled={!isAdmin}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            Add Location
          </Button>
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
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Distributor</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Delivery Time (Min)</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Dispatch Time</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedLocations.map((loc: any) => (
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
                              {formatAuMobile(loc.distributorCustomer.mobile || '-') || '-'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium">{loc.distributorName}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatAuMobile(loc.distributorMobile || '') || '-'}
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
                              {formatAuMobile(loc.transporterCustomer.mobile || '-') || '-'}
                            </div>
                          </>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {typeof loc.deliveryTimeMinutes === 'number'
                          ? loc.deliveryTimeMinutes
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {typeof loc.distributionPriority === 'number'
                          ? loc.distributionPriority
                          : '-'}
                      </TableCell>
                      <TableCell>{formatDispatchTime(loc.timeOfDispatch)}</TableCell>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Sort by</span>
                    <Select
                      value={locationsSortBy}
                      onValueChange={(value) =>
                        setLocationsSortBy(value as 'created' | 'updated' | 'name')
                      }
                    >
                      <SelectTrigger className="h-8 w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="updated">Date modified</SelectItem>
                        <SelectItem value="created">Date created</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Rows per page</span>
                    <Select
                      value={String(locationsRowsPerPage)}
                      onValueChange={(value) => {
                        const parsed = Number(value);
                        setLocationsRowsPerPage(parsed);
                        setLocationsPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>
                    {sortedLocations.length === 0
                      ? '0 of 0'
                      : `${(locationsPage - 1) * locationsRowsPerPage + 1}-${Math.min(
                          locationsPage * locationsRowsPerPage,
                          sortedLocations.length,
                        )} of ${sortedLocations.length}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocationsPage((prev) => Math.max(1, prev - 1))}
                      disabled={locationsPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLocationsPage((prev) => Math.min(locationsPageCount, prev + 1))
                      }
                      disabled={locationsPage >= locationsPageCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
