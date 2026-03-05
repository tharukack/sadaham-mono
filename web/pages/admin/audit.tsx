import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

export default function AuditPage() {
  const [currentRole, setCurrentRole] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const isSuperAdmin = currentRole === 'SUPERADMIN';
  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, pageSize, sortDir],
    queryFn: async () =>
      (
        await api.get('/audit', {
          params: { page, pageSize, sortDir },
        })
      ).data,
    enabled: isSuperAdmin,
  });
  const total = data?.total || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const items = data?.items || [];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentRole(parsed?.role || '');
      }
    } catch {
      setCurrentRole('');
    }
  }, []);

  return (
    <AppShell title="Audit Log">
      <PageHeader
        title="Audit Log"
        description="Review system actions and changes."
      />
      {!isSuperAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Audit logs are restricted to superadmins.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Sort</span>
                <Select value={sortDir} onValueChange={(value) => setSortDir(value as 'asc' | 'desc')}>
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="desc">Newest first</SelectItem>
                    <SelectItem value="asc">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span>Rows</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs">
                {total === 0
                  ? '0 of 0'
                  : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                  disabled={page >= pageCount}
                >
                  Next
                </Button>
              </div>
            </div>
            {isLoading ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Loading audit entries...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No audit entries available.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toISOString() : '-'}
                      </TableCell>
                      <TableCell>
                        {log.actorUser
                          ? `${log.actorUser.firstName || ''} ${log.actorUser.lastName || ''}`.trim() ||
                            log.actorUser.email ||
                            log.actorUser.mobile ||
                            log.actorUser.id
                          : log.actorUserId || '-'}
                      </TableCell>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell>{log.entityType}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.entityId || '-'}
                      </TableCell>
                      <TableCell className="max-w-[420px] text-xs text-muted-foreground">
                        {log.diff ? (
                          <pre className="whitespace-pre-wrap">{JSON.stringify(log.diff, null, 2)}</pre>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
