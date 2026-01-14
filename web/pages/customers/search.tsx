import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useToast } from '../../components/ui/use-toast';

export default function CustomerSearchPage() {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [currentRole, setCurrentRole] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
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

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['customer-search', term],
    queryFn: async () => (await api.get('/customers/search', { params: { q: term } })).data,
    enabled: canAccess,
  });

  const customers = useMemo(() => (data || []) as any[], [data]);
  const editingCustomer = useMemo(
    () => customers.find((c) => c.id === editingId),
    [customers, editingId],
  );

  useEffect(() => {
    if (!editingCustomer) return;
    setForm({
      firstName: editingCustomer.firstName || '',
      lastName: editingCustomer.lastName || '',
      mobile: editingCustomer.mobile || '',
      address: editingCustomer.address || '',
    });
  }, [editingCustomer]);

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
        actions={
          <Button
            onClick={() => {
              resetForm();
              setShowAdd(true);
            }}
          >
            Add Customer
          </Button>
        }
      />
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Search Customers</CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by name or mobile"
            />
            <Button variant="secondary" onClick={() => refetch()}>
              Search
            </Button>
          </div>
        </CardHeader>
      </Card>

      {(showAdd || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Customer' : 'Add Customer'}</CardTitle>
          </CardHeader>
          <CardContent>
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
                    placeholder="+61400000000"
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
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="secondary" type="button" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(customers || []).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.firstName} {c.lastName}
                    </TableCell>
                    <TableCell>{c.mobile}</TableCell>
                    <TableCell>{c.address || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setShowAdd(false);
                            setEditingId(c.id);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!canDelete}
                          onClick={() => softDelete(c.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
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
