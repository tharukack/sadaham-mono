import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useToast } from '../../components/ui/use-toast';
import { Pencil } from 'lucide-react';

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
  const [usersPage, setUsersPage] = useState(1);
  const [usersRowsPerPage, setUsersRowsPerPage] = useState(10);
  const [usersSortBy, setUsersSortBy] = useState<'created' | 'updated' | 'name'>('updated');
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
  const sortedUsers = useMemo(() => {
    const next = [...filteredUsers];
    next.sort((a: any, b: any) => {
      if (usersSortBy === 'name') {
        const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim();
        return aName.localeCompare(bName);
      }
      const aDate = new Date(
        usersSortBy === 'created' ? a.createdAt || 0 : a.updatedAt || 0,
      ).getTime();
      const bDate = new Date(
        usersSortBy === 'created' ? b.createdAt || 0 : b.updatedAt || 0,
      ).getTime();
      return bDate - aDate;
    });
    return next;
  }, [filteredUsers, usersSortBy]);
  const usersPageCount = useMemo(() => {
    return Math.max(1, Math.ceil(sortedUsers.length / usersRowsPerPage));
  }, [sortedUsers.length, usersRowsPerPage]);
  const pagedUsers = useMemo(() => {
    const start = (usersPage - 1) * usersRowsPerPage;
    return sortedUsers.slice(start, start + usersRowsPerPage);
  }, [sortedUsers, usersPage, usersRowsPerPage]);
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

  useEffect(() => {
    setUsersPage(1);
  }, [searchTerm, usersSortBy]);

  useEffect(() => {
    setUsersPage((prev) => Math.min(Math.max(prev, 1), usersPageCount));
  }, [usersPageCount]);

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
      />

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>User Directory</CardTitle>
              <span className="text-sm font-medium text-muted-foreground">
                Total Users: {users.length}
              </span>
            </div>
            <Button
              disabled={!isAdmin}
              onClick={() => {
                resetForm();
                setShowAdd(true);
              }}
            >
              Add User
            </Button>
          </div>
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
            <div className="space-y-3">
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[1400px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedUsers.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell>{user.mobile}</TableCell>
                        <TableCell>{user.email || '-'}</TableCell>
                        <TableCell>
                          {user.role === 'ADMIN' ? (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                              Admin
                            </Badge>
                          ) : user.role === 'EDITOR' ? (
                            <Badge className="border-sky-200 bg-sky-50 text-sky-700" variant="outline">
                              Editor
                            </Badge>
                          ) : (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                              Viewer
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge variant="outline">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.updatedAt
                            ? new Date(user.updatedAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7"
                            disabled={!isAdmin}
                            onClick={() => {
                              setShowAdd(false);
                              setEditingUserId(user.id);
                            }}
                            aria-label="Edit user"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
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
                      value={usersSortBy}
                      onValueChange={(value) =>
                        setUsersSortBy(value as 'created' | 'updated' | 'name')
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
                      value={String(usersRowsPerPage)}
                      onValueChange={(value) => {
                        const parsed = Number(value);
                        setUsersRowsPerPage(parsed);
                        setUsersPage(1);
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
                    {sortedUsers.length === 0
                      ? '0 of 0'
                      : `${(usersPage - 1) * usersRowsPerPage + 1}-${Math.min(
                          usersPage * usersRowsPerPage,
                          sortedUsers.length,
                        )} of ${sortedUsers.length}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
                      disabled={usersPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage((prev) => Math.min(usersPageCount, prev + 1))}
                      disabled={usersPage >= usersPageCount}
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
        open={showAdd || !!editingUserId}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUserId ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
