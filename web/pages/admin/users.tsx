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
import { Toggle } from '../../components/ui/toggle';
import { useToast } from '../../components/ui/use-toast';
import { Pencil } from 'lucide-react';
import { formatAuMobile, normalizeAuMobile } from '../../lib/phone';

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
    isActive: true,
    mainCollectorId: '',
  });
  const [collectorSearch, setCollectorSearch] = useState('');

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
  const usersById = useMemo(() => {
    const map = new Map<string, any>();
    users.forEach((user) => {
      if (user?.id) map.set(user.id, user);
    });
    return map;
  }, [users]);
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
  const isEditDirty = useMemo(() => {
    if (!editingUserId || !editingUser) return true;
    const current = {
      firstName: (form.firstName || '').trim(),
      lastName: (form.lastName || '').trim(),
      mobile: normalizeAuMobile(form.mobile || ''),
      email: (form.email || '').trim(),
      address: (form.address || '').trim(),
      role: form.role,
      isActive: form.isActive,
      mainCollectorId: form.mainCollectorId || '',
    };
    const original = {
      firstName: (editingUser.firstName || '').trim(),
      lastName: (editingUser.lastName || '').trim(),
      mobile: normalizeAuMobile(editingUser.mobile || ''),
      email: (editingUser.email || '').trim(),
      address: (editingUser.address || '').trim(),
      role: editingUser.role || 'VIEWER',
      isActive: editingUser.isActive ?? true,
      mainCollectorId:
        editingUser.mainCollectorId && editingUser.mainCollectorId !== editingUser.id
          ? editingUser.mainCollectorId
          : '',
    };
    return JSON.stringify(current) !== JSON.stringify(original);
  }, [
    editingUser,
    editingUserId,
    form.address,
    form.email,
    form.firstName,
    form.isActive,
    form.lastName,
    form.mainCollectorId,
    form.mobile,
    form.role,
  ]);
  const formatUserLabel = (user: any) => {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return name || 'Unnamed user';
  };
  const selectedCollector = useMemo(() => {
    if (!form.mainCollectorId) return null;
    return users.find((u) => u.id === form.mainCollectorId) || null;
  }, [form.mainCollectorId, users]);
  const selectedCollectorLabel = useMemo(() => {
    return selectedCollector ? formatUserLabel(selectedCollector) : '';
  }, [selectedCollector]);
  const getCollectorLabel = (user: any) => {
    if (!user?.mainCollectorId || user.mainCollectorId === user.id) {
      return 'Self';
    }
    const collector = usersById.get(user.mainCollectorId);
    return collector ? formatUserLabel(collector) : 'Unknown';
  };
  const collectorOptions = useMemo(() => {
    const term = collectorSearch.trim().toLowerCase();
    if (!term) return [];
    return users
      .filter((user) => {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        return fullName.toLowerCase().includes(term);
      })
      .slice(0, 8);
  }, [users, collectorSearch]);

  useEffect(() => {
    if (!editingUser) return;
    setForm({
      firstName: editingUser.firstName || "",
      lastName: editingUser.lastName || "",
      mobile: normalizeAuMobile(editingUser.mobile || ""),
      email: editingUser.email || "",
      address: editingUser.address || "",
      role: editingUser.role || "VIEWER",
      isActive: editingUser.isActive ?? true,
      mainCollectorId:
        editingUser.mainCollectorId && editingUser.mainCollectorId !== editingUser.id
          ? editingUser.mainCollectorId
          : '',
    });
  }, [editingUser]);

  useEffect(() => {
    if (!editingUser) return;
    if (!editingUser.mainCollectorId || editingUser.mainCollectorId === editingUser.id) {
      setCollectorSearch('');
      return;
    }
    const collector = users.find((u) => u.id === editingUser.mainCollectorId);
    setCollectorSearch(collector ? formatUserLabel(collector) : '');
  }, [editingUser, users]);

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
      isActive: true,
      mainCollectorId: '',
    });
    setCollectorSearch('');
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
          mainCollectorId: form.mainCollectorId || editingUserId,
        };
        await api.patch(`/users/${editingUserId}`, payload);
      } else {
        const payload: any = {
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          email: form.email || undefined,
          address: form.address || undefined,
          role: form.role,
          isActive: form.isActive,
        };
        if (form.mainCollectorId) {
          payload.mainCollectorId = form.mainCollectorId;
        }
        const res = await api.post('/users', payload);
        const tempPassword = res?.data?.tempPassword;
        const hasTempPassword = Boolean(tempPassword);
        if (tempPassword) {
          toast({
            title: 'User created',
            description: `Temporary password: ${tempPassword}`,
          });
        }
        if (!hasTempPassword) {
          toast({ title: 'User created' });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      resetForm();
      if (editingUserId) {
        toast({ title: 'User updated' });
      }
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

  const resetPassword = async () => {
    if (!editingUserId || !isAdmin) return;
    setFormLoading(true);
    try {
      const res = await api.post(`/users/${editingUserId}/reset-password`);
      const tempPassword = res?.data?.tempPassword;
      toast({
        title: 'Password reset',
        description: tempPassword
          ? `Temporary password: ${tempPassword}`
          : 'A temporary password was sent via SMS.',
      });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Reset failed',
        description: err?.response?.data?.message || 'Unable to reset password.',
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
                      <TableHead>Main Collector</TableHead>
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
                        <TableCell>{formatAuMobile(user.mobile || '')}</TableCell>
                        <TableCell>{user.email || '-'}</TableCell>
                        <TableCell>{getCollectorLabel(user)}</TableCell>
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
                            <Badge className="border-rose-200 bg-rose-50 text-rose-700" variant="outline">
                              Inactive
                            </Badge>
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
                  placeholder="0400000000"
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
              <div className="space-y-2">
                <Label>Active</Label>
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={form.isActive}
                    onCheckedChange={(value) => setForm({ ...form, isActive: value })}
                    disabled={!isAdmin}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="user-collector">Main Collector</Label>
                <Input
                  id="user-collector"
                  value={collectorSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCollectorSearch(value);
                    if (!value.trim()) {
                      setForm({ ...form, mainCollectorId: '' });
                    }
                  }}
                  disabled={!isAdmin}
                  placeholder="Search existing users by name"
                />
                {collectorSearch.trim().length > 0 &&
                  (!form.mainCollectorId ||
                    collectorSearch.trim().toLowerCase() !== selectedCollectorLabel.toLowerCase()) && (
                  <div className="max-h-48 overflow-y-auto rounded-md border bg-popover p-1 text-sm">
                    {collectorOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-muted-foreground">
                        No matches found.
                      </div>
                    ) : (
                      collectorOptions.map((user: any) => (
                        <button
                          key={user.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted"
                          onClick={() => {
                            setForm({ ...form, mainCollectorId: user.id });
                            setCollectorSearch(formatUserLabel(user));
                          }}
                        >
                          <span>{formatUserLabel(user)}</span>
                          <span className="text-xs text-muted-foreground">
                            {user.role || 'USER'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Leave empty to default to the user itself.
                </p>
                {!editingUserId && (
                  <p className="text-xs text-muted-foreground">
                    A temporary password will be generated and sent via SMS.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedCollector ? formatUserLabel(selectedCollector) : 'Self (default)'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={!isAdmin || formLoading || (editingUserId ? !isEditDirty : false)}
              >
                {formLoading ? 'Saving...' : 'Save'}
              </Button>
              {editingUserId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetPassword}
                  disabled={!isAdmin || formLoading}
                >
                  Reset Password
                </Button>
              )}
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
