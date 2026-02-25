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
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useToast } from '../../components/ui/use-toast';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { formatAuMobile, normalizeAuMobile } from '../../lib/phone';

export default function CustomerSearchPage() {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [currentRole, setCurrentRole] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [customersPage, setCustomersPage] = useState(1);
  const [customersRowsPerPage, setCustomersRowsPerPage] = useState(10);
  const [customersSortBy, setCustomersSortBy] = useState<'created' | 'updated' | 'name'>(
    'updated',
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const { toast } = useToast();

  const canAccess = currentRole === 'ADMIN' || currentRole === 'EDITOR';
  const canDelete = currentRole === 'ADMIN';

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    address: '',
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

  const { data, isLoading } = useQuery({
    queryKey: ['customer-search', term],
    queryFn: async () =>
      (await api.get('/customers/search', { params: { q: term, includeDeleted: 1 } })).data,
    enabled: canAccess,
  });

  const customers = useMemo(() => (data || []) as any[], [data]);
  const filteredCustomers = useMemo(() => {
    if (statusFilter === 'active') {
      return customers.filter((c: any) => !c.deletedAt);
    }
    if (statusFilter === 'deleted') {
      return customers.filter((c: any) => !!c.deletedAt);
    }
    return customers;
  }, [customers, statusFilter]);

  const sortedCustomers = useMemo(() => {
    const next = [...filteredCustomers];
    next.sort((a: any, b: any) => {
      if (customersSortBy === 'name') {
        const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim();
        return aName.localeCompare(bName);
      }
      const aDate = new Date(
        customersSortBy === 'created' ? a.createdAt || 0 : a.updatedAt || 0,
      ).getTime();
      const bDate = new Date(
        customersSortBy === 'created' ? b.createdAt || 0 : b.updatedAt || 0,
      ).getTime();
      return bDate - aDate;
    });
    return next;
  }, [filteredCustomers, customersSortBy]);

  const customersPageCount = useMemo(() => {
    return Math.max(1, Math.ceil(sortedCustomers.length / customersRowsPerPage));
  }, [sortedCustomers.length, customersRowsPerPage]);

  const pagedCustomers = useMemo(() => {
    const start = (customersPage - 1) * customersRowsPerPage;
    return sortedCustomers.slice(start, start + customersRowsPerPage);
  }, [sortedCustomers, customersPage, customersRowsPerPage]);
  const editingCustomer = useMemo(
    () => customers.find((c) => c.id === editingId),
    [customers, editingId],
  );

  useEffect(() => {
    if (!editingCustomer) return;
    setForm({
      firstName: editingCustomer.firstName || '',
      lastName: editingCustomer.lastName || '',
      mobile: normalizeAuMobile(editingCustomer.mobile || ''),
      address: editingCustomer.address || '',
    });
  }, [editingCustomer]);

  const isEditDirty = useMemo(() => {
    if (!editingId || !editingCustomer) return true;
    const current = {
      firstName: (form.firstName || '').trim(),
      lastName: (form.lastName || '').trim(),
      mobile: normalizeAuMobile(form.mobile || ''),
      address: (form.address || '').trim(),
    };
    const original = {
      firstName: (editingCustomer.firstName || '').trim(),
      lastName: (editingCustomer.lastName || '').trim(),
      mobile: normalizeAuMobile(editingCustomer.mobile || ''),
      address: (editingCustomer.address || '').trim(),
    };
    return JSON.stringify(current) !== JSON.stringify(original);
  }, [editingCustomer, editingId, form.address, form.firstName, form.lastName, form.mobile]);

  useEffect(() => {
    setCustomersPage(1);
  }, [term, customersSortBy, statusFilter]);

  useEffect(() => {
    setCustomersPage((prev) => Math.min(Math.max(prev, 1), customersPageCount));
  }, [customersPageCount]);

  const resetForm = () => {
    setForm({
      firstName: '',
      lastName: '',
      mobile: '',
      address: '',
    });
    setEditingId(null);
    setShowAdd(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canAccess) return;
    setFormLoading(true);
    try {
      if (editingId) {
        await api.post(`/customers/${editingId}`, {
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          address: form.address || undefined,
        });
      } else {
        await api.post('/customers', {
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          address: form.address || undefined,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['customer-search'] });
      resetForm();
      toast({ title: editingId ? 'Customer updated' : 'Customer created' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: err?.response?.data?.message || 'Unable to save customer.',
      });
    } finally {
      setFormLoading(false);
    }
  };

  const softDelete = async (id: string) => {
    if (!canDelete) return;
    try {
      await api.patch(`/customers/${id}/delete`);
      await queryClient.invalidateQueries({ queryKey: ['customer-search'] });
      toast({ title: 'Customer deleted' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: err?.response?.data?.message || 'Unable to delete customer.',
      });
    }
  };

  const restoreCustomer = async (id: string) => {
    if (!canDelete) return;
    try {
      await api.patch(`/customers/${id}/restore`);
      await queryClient.invalidateQueries({ queryKey: ['customer-search'] });
      toast({ title: 'Customer restored' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Restore failed',
        description: err?.response?.data?.message || 'Unable to restore customer.',
      });
    }
  };

  if (!canAccess) {
    return (
      <AppShell title="Customer Search">
        <PageHeader title="Customer Search" />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have access to view customers.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Customer Search">
      <PageHeader
        title="Customer Search"
        description="Find, add, and manage customer profiles."
      />
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>Customer List</CardTitle>
              <span className="text-sm font-medium text-muted-foreground">
                Total Customers: {customers.length}
              </span>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setShowAdd(true);
              }}
            >
              Add Customer
            </Button>
          </div>
          <div className="flex items-center gap-2 pt-3">
            <Input
              className="flex-1 min-w-0 sm:min-w-[200px]"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by name or mobile"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'deleted')}
            >
              <SelectTrigger className="h-10 w-full sm:w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All customers</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="deleted">Deleted only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading customers...
            </div>
          ) : (customers || []).length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No customers found.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[1400px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Updated At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedCustomers.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.firstName} {c.lastName}
                        </TableCell>
                        <TableCell>{formatAuMobile(c.mobile || '')}</TableCell>
                        <TableCell>{c.address || '-'}</TableCell>
                        <TableCell>
                          {c.updatedAt
                            ? new Date(c.updatedAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {c.deletedAt ? (
                            <Badge variant="destructive">Deleted</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.createdBy
                            ? `${c.createdBy.firstName} ${c.createdBy.lastName}`.trim()
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.deletedAt ? (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7"
                              onClick={() => restoreCustomer(c.id)}
                              disabled={!canDelete}
                              aria-label="Restore customer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7"
                                onClick={() => {
                                  setShowAdd(false);
                                  setEditingId(c.id);
                                }}
                                aria-label="Edit customer"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="h-7 w-7"
                                disabled={!canDelete}
                                onClick={() => softDelete(c.id)}
                                aria-label="Delete customer"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Sort by</span>
                    <Select
                      value={customersSortBy}
                      onValueChange={(value) =>
                        setCustomersSortBy(value as 'created' | 'updated' | 'name')
                      }
                    >
                      <SelectTrigger className="h-8 w-full sm:w-[170px]">
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
                      value={String(customersRowsPerPage)}
                      onValueChange={(value) => {
                        const parsed = Number(value);
                        setCustomersRowsPerPage(parsed);
                        setCustomersPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-full sm:w-[90px]">
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
                    {sortedCustomers.length === 0
                      ? '0 of 0'
                      : `${(customersPage - 1) * customersRowsPerPage + 1}-${Math.min(
                          customersPage * customersRowsPerPage,
                          sortedCustomers.length,
                        )} of ${sortedCustomers.length}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomersPage((prev) => Math.max(1, prev - 1))}
                      disabled={customersPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCustomersPage((prev) => Math.min(customersPageCount, prev + 1))
                      }
                      disabled={customersPage >= customersPageCount}
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

      <Dialog
        open={showAdd || !!editingId}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer-first">First Name</Label>
                <Input
                  id="customer-first"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-last">Last Name</Label>
                <Input
                  id="customer-last"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-mobile">Mobile</Label>
                <Input
                  id="customer-mobile"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  placeholder="0400000000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-address">Address</Label>
                <Input
                  id="customer-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={formLoading || (editingId ? !isEditDirty : false)}>
                {formLoading ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="secondary" type="button" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
