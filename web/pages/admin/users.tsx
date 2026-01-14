import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useToast } from '../../components/ui/use-toast';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const [currentRole, setCurrentRole] = useState<string>('');
  const isAdmin = currentRole === 'ADMIN';

  const [showAdd, setShowAdd] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    address: '',
    role: 'VIEWER',
    password: '',
    isActive: true,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem('user');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setCurrentRole(parsed?.role || '');
    } catch {
      setCurrentRole('');
    }
  }, []);

  const users = useMemo(() => (data || []) as any[], [data]);
  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      return fullName.toLowerCase().includes(term);
    });
  }, [users, searchTerm]);
  const editingUser = useMemo(
    () => users.find((u) => u.id === editingUserId),
    [users, editingUserId]
  );

  useEffect(() => {
    if (!editingUser) return;
    setForm({
      firstName: editingUser.firstName || "",
      lastName: editingUser.lastName || "",
      mobile: editingUser.mobile || "",
      email: editingUser.email || "",
      address: editingUser.address || "",
      role: editingUser.role || "VIEWER",
      password: "",
      isActive: editingUser.isActive ?? true,
    });
  }, [editingUser]);

  const resetForm = () => {
    setForm({
      firstName: '',
      lastName: '',
      mobile: '',
      email: '',
      address: '',
      role: 'VIEWER',
      password: '',
      isActive: true,
    });
    setEditingUserId(null);
    setShowAdd(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setFormLoading(true);
    try {
      if (editingUserId) {
        const payload: any = {
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          email: form.email || null,
          address: form.address || null,
          role: form.role,
          isActive: form.isActive,
        };
        await api.patch(`/users/${editingUserId}`, payload);
      } else {
        const payload = {
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          email: form.email || undefined,
          address: form.address || undefined,
          role: form.role,
          password: form.password,
        };
        await api.post('/users', payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      resetForm();
      toast({ title: editingUserId ? 'User updated' : 'User created' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: err?.response?.data?.message || 'Unable to save user.',
      });
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <AppShell title="Users">
      <PageHeader
        title="Users"
        description="Manage admin, editor, and viewer access."
        actions={
          <Button
            disabled={!isAdmin}
            onClick={() => {
              resetForm();
              setShowAdd(true);
            }}
          >
            Add User
          </Button>
        }
      />

      {(showAdd || editingUserId) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingUserId ? 'Edit User' : 'Add User'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="user-first">First Name</Label>
                  <Input
                    id="user-first"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    disabled={!isAdmin}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-last">Last Name</Label>
                  <Input
                    id="user-last"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    disabled={!isAdmin}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-mobile">Mobile</Label>
                  <Input
                    id="user-mobile"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="+61400000000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="name@example.com"
                    type="email"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="user-address">Address</Label>
                  <Input
                    id="user-address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(value) => setForm({ ...form, role: value })}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="EDITOR">Editor</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingUserId ? (
                  <div className="space-y-2">
                    <Label>Active</Label>
                    <Select
                      value={form.isActive ? 'true' : 'false'}
                      onValueChange={(value) =>
                        setForm({ ...form, isActive: value === 'true' })
                      }
                      disabled={!isAdmin}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="user-password">Password</Label>
                    <Input
                      id="user-password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      disabled={!isAdmin}
                      type="password"
                      minLength={6}
                      required
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!isAdmin || formLoading}>
                  {formLoading ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="secondary" type="button" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
              {!isAdmin && (
                <p className="text-sm text-muted-foreground">
                  Only admins can add or edit users.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>User Directory</CardTitle>
          <div className="pt-3">
            <Input
              placeholder="Search users by name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.mobile} {user.email ? `- ${user.email}` : ''}
                    </TableCell>
                    <TableCell>
                      {user.role} · {user.isActive ? 'Active' : 'Inactive'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!isAdmin}
                        onClick={() => {
                          setShowAdd(false);
                          setEditingUserId(user.id);
                        }}
                      >
                        Edit
                      </Button>
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
