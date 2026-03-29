import { useEffect, useMemo, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

type SortDir = 'desc' | 'asc';
type AuditTab = 'activity' | 'backups';

export default function AuditPage() {
  const [currentRole, setCurrentRole] = useState('');
  const [activeTab, setActiveTab] = useState<AuditTab>('activity');
  const [activityPage, setActivityPage] = useState(1);
  const [backupPage, setBackupPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const isSuperAdmin = currentRole === 'SUPERADMIN';

  const auditQuery = useQuery({
    queryKey: ['audit', activityPage, pageSize, sortDir],
    queryFn: async () =>
      (
        await api.get('/audit', {
          params: { page: activityPage, pageSize, sortDir },
        })
      ).data,
    enabled: isSuperAdmin,
  });

  const backupQuery = useQuery({
    queryKey: ['audit-backups', backupPage, pageSize, sortDir],
    queryFn: async () =>
      (
        await api.get('/audit/backups', {
          params: { page: backupPage, pageSize, sortDir },
        })
      ).data,
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

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

  const activeData = activeTab === 'activity' ? auditQuery.data : backupQuery.data;
  const isLoading = activeTab === 'activity' ? auditQuery.isLoading : backupQuery.isLoading;
  const total = activeData?.total || 0;
  const page = activeTab === 'activity' ? activityPage : backupPage;
  const setPage = activeTab === 'activity' ? setActivityPage : setBackupPage;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const auditItems = auditQuery.data?.items || [];
  const backupItems = backupQuery.data?.items || [];
  const backupState = backupQuery.data?.state || null;

  const backupSummary = useMemo(() => {
    if (!backupState) return [];
    return [
      ['Last status', backupState.lastStatus || '-'],
      ['Last reason', backupState.lastReason || '-'],
      ['Last uploaded at', backupState.lastUploadedAt ? formatDateTime(backupState.lastUploadedAt) : '-'],
      ['Last file', backupState.lastUploadedFile || '-'],
      ['Drive path', backupState.lastUploadedDrivePath || '-'],
    ];
  }, [backupState]);

  return (
    <AppShell title="Audit Log">
      <PageHeader title="Audit Log" description="Review system actions and backup activity." />
      {!isSuperAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Audit logs are restricted to superadmins.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AuditTab)}>
          <TabsList className="mb-4">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="backups">Backup History</TabsTrigger>
          </TabsList>

          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Sort</span>
              <Select value={sortDir} onValueChange={(value) => setSortDir(value as SortDir)}>
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
                  setActivityPage(1);
                  setBackupPage(1);
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
              {total === 0 ? '0 of 0' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}
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

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Loading audit entries...
                  </div>
                ) : auditItems.length === 0 ? (
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
                      {auditItems.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.createdAt ? formatDateTime(log.createdAt) : '-'}
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
                          <TableCell className="text-xs text-muted-foreground">{log.entityId || '-'}</TableCell>
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
          </TabsContent>

          <TabsContent value="backups">
            <Card>
              <CardHeader>
                <CardTitle>Backup History</CardTitle>
              </CardHeader>
              <CardContent>
                {backupSummary.length > 0 ? (
                  <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {backupSummary.map(([label, value]) => (
                      <div key={label} className="rounded-md border p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
                        <div className="mt-1 break-all text-sm font-medium">{value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {isLoading ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Loading backup entries...
                  </div>
                ) : backupItems.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No backup entries available.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Checked At</TableHead>
                        <TableHead>Uploaded At</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>File Name</TableHead>
                        <TableHead>Drive Path</TableHead>
                        <TableHead>Hash</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backupItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.checkedAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.uploadedAt ? formatDateTime(item.uploadedAt) : '-'}
                          </TableCell>
                          <TableCell className="font-medium uppercase">{item.status || '-'}</TableCell>
                          <TableCell>{item.reason || '-'}</TableCell>
                          <TableCell className="max-w-[240px] break-all text-xs">{item.fileName || '-'}</TableCell>
                          <TableCell className="max-w-[280px] break-all text-xs text-muted-foreground">
                            {item.drivePath || '-'}
                          </TableCell>
                          <TableCell className="max-w-[180px] break-all text-xs text-muted-foreground">
                            {item.dumpHash || '-'}
                          </TableCell>
                          <TableCell className="max-w-[240px] break-all text-xs text-destructive">
                            {item.errorMessage || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || '-';
  }

  return parsed.toLocaleString();
}