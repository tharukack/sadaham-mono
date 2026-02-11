import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { OrderDetailsModal } from '../../components/order-details-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useToast } from '../../components/ui/use-toast';
import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default function OrdersPage() {
  const [currentRole, setCurrentRole] = useState<string>('');
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

  const currentCampaignQuery = useQuery({
    queryKey: ['campaign-current'],
    queryFn: async () => (await api.get('/campaigns/current')).data,
  });
  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/orders')).data,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersRowsPerPage, setOrdersRowsPerPage] = useState(10);
  const [ordersSortBy, setOrdersSortBy] = useState<'created' | 'updated' | 'name'>('updated');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
    note: '',
  });
  const { toast } = useToast();

  const orders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const currentCampaignId = currentCampaignQuery.data?.id;
    const scoped = currentCampaignId
      ? (ordersQuery.data || []).filter((order: any) => order.campaignId === currentCampaignId)
      : [];
    if (!term) return scoped;
    return scoped.filter((order: any) => {
      const customerName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim();
      const pickup = order.pickupLocation?.name || '';
      return customerName.toLowerCase().includes(term) || pickup.toLowerCase().includes(term);
    });
  }, [ordersQuery.data, searchTerm, currentCampaignQuery.data?.id]);

  const sortedOrders = useMemo(() => {
    const next = [...orders];
    next.sort((a: any, b: any) => {
      if (ordersSortBy === 'name') {
        const aName = `${a.customer?.firstName || ''} ${a.customer?.lastName || ''}`.trim();
        const bName = `${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.trim();
        return aName.localeCompare(bName);
      }
      const aDate = new Date(
        ordersSortBy === 'created' ? a.createdAt || 0 : a.updatedAt || 0,
      ).getTime();
      const bDate = new Date(
        ordersSortBy === 'created' ? b.createdAt || 0 : b.updatedAt || 0,
      ).getTime();
      return bDate - aDate;
    });
    return next;
  }, [orders, ordersSortBy]);

  const ordersPageCount = useMemo(() => {
    return Math.max(1, Math.ceil(sortedOrders.length / ordersRowsPerPage));
  }, [sortedOrders.length, ordersRowsPerPage]);

  const pagedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersRowsPerPage;
    return sortedOrders.slice(start, start + ordersRowsPerPage);
  }, [sortedOrders, ordersPage, ordersRowsPerPage]);

  useEffect(() => {
    setOrdersPage(1);
  }, [searchTerm, currentCampaignQuery.data?.id, ordersSortBy]);

  useEffect(() => {
    setOrdersPage((prev) => Math.min(Math.max(prev, 1), ordersPageCount));
  }, [ordersPageCount]);

  const getMealDetails = (order: any) => {
    const meals = [
      { label: 'Chicken', qty: Number(order.chickenQty || 0) },
      { label: 'Fish', qty: Number(order.fishQty || 0) },
      { label: 'Veg', qty: Number(order.vegQty || 0) },
      { label: 'Egg', qty: Number(order.eggQty || 0) },
      { label: 'Other', qty: Number(order.otherQty || 0) },
    ];
    const total = meals.reduce((sum, meal) => sum + meal.qty, 0);
    return { total, meals: meals.filter((meal) => meal.qty > 0) };
  };

  const getOrderCost = (order: any) => {
    const campaign = order.campaign || currentCampaignQuery.data;
    const chickenCost = campaign?.chickenCost || 0;
    const fishCost = campaign?.fishCost || 0;
    const vegCost = campaign?.vegCost || 0;
    const eggCost = campaign?.eggCost || 0;
    const otherCost = campaign?.otherCost || 0;
    return (
      Number(order.chickenQty || 0) * chickenCost +
      Number(order.fishQty || 0) * fishCost +
      Number(order.vegQty || 0) * vegCost +
      Number(order.eggQty || 0) * eggCost +
      Number(order.otherQty || 0) * otherCost
    );
  };

  const totalOrderAmount = useMemo(() => {
    return orders.reduce((sum, order) => sum + getOrderCost(order), 0);
  }, [orders]);

  const totalOrdersCount = orders.length;
  const activeOrders = useMemo(() => orders.filter((order: any) => !order.deletedAt), [orders]);
  const activeOrderCount = activeOrders.length;
  const activeOrderAmount = useMemo(() => {
    return activeOrders.reduce((sum, order) => sum + getOrderCost(order), 0);
  }, [activeOrders]);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD' }).format(value);

  const isAdmin = currentRole === 'ADMIN';
  const isEditor = currentRole === 'EDITOR';
  const canCreateOrders = currentCampaignQuery.data?.state === 'STARTED' && (isAdmin || isEditor);
  const canEditOrders =
    currentCampaignQuery.data?.state === 'STARTED'
      ? isAdmin || isEditor
      : currentCampaignQuery.data?.state === 'FROZEN'
      ? isAdmin
      : false;

  const startEdit = (order: any) => {
    setEditingOrderId(order.id);
    setEditForm({
      chickenQty: Number(order.chickenQty || 0),
      fishQty: Number(order.fishQty || 0),
      vegQty: Number(order.vegQty || 0),
      eggQty: Number(order.eggQty || 0),
      otherQty: Number(order.otherQty || 0),
      note: order.note || '',
    });
  };

  const submitEdit = async () => {
    if (!editingOrderId || !canEditOrders) return;
    setEditSaving(true);
    try {
      await api.patch(`/orders/${editingOrderId}`, {
        chickenQty: Number(editForm.chickenQty || 0),
        fishQty: Number(editForm.fishQty || 0),
        vegQty: Number(editForm.vegQty || 0),
        eggQty: Number(editForm.eggQty || 0),
        otherQty: Number(editForm.otherQty || 0),
        note: editForm.note || undefined,
      });
      await ordersQuery.refetch();
      setEditingOrderId(null);
      toast({ title: 'Order updated' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to update order',
        description: err?.response?.data?.message || 'Unable to update order.',
      });
    } finally {
      setEditSaving(false);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!canEditOrders) return;
    try {
      await api.patch(`/orders/${id}/delete`);
      await ordersQuery.refetch();
      toast({ title: 'Order deleted' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete order',
        description: err?.response?.data?.message || 'Unable to delete order.',
      });
    }
  };

  const restoreOrder = async (id: string) => {
    if (!canEditOrders) return;
    try {
      await api.patch(`/orders/${id}/restore`);
      await ordersQuery.refetch();
      toast({ title: 'Order restored' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to restore order',
        description: err?.response?.data?.message || 'Unable to restore order.',
      });
    }
  };

  return (
    <AppShell title="Orders">
      <PageHeader title="Orders" description="Track customer orders and meal counts." />
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>Order List</CardTitle>
              {currentCampaignQuery.data && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="rounded-full border px-3 py-1">
                    <span className="font-medium text-foreground">All Orders</span>{' '}
                    <span className="text-foreground">{totalOrdersCount}</span>
                  </span>
                  <span className="rounded-full border px-3 py-1">
                    <span className="font-medium text-foreground">All Cost</span>{' '}
                    <span className="text-foreground">{formatCurrency(totalOrderAmount)}</span>
                  </span>
                  <span className="rounded-full border px-3 py-1">
                    <span className="font-medium text-foreground">Active Orders</span>{' '}
                    <span className="text-foreground">{activeOrderCount}</span>
                  </span>
                  <span className="rounded-full border px-3 py-1">
                    <span className="font-medium text-foreground">Active Cost</span>{' '}
                    <span className="text-foreground">{formatCurrency(activeOrderAmount)}</span>
                  </span>
                </div>
              )}
            </div>
            <Button asChild disabled={!canCreateOrders}>
              <Link href="/dashboard?addOrder=1">Add Order</Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <Input
              placeholder="Search orders by customer or pickup location"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {ordersQuery.isLoading || currentCampaignQuery.isLoading ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading orders...
            </div>
          ) : !currentCampaignQuery.data ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No active campaign. Orders will appear here when a campaign is started.
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No orders found.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-full overflow-x-auto">
              <Table className="min-w-[1600px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-background">Customer</TableHead>
                    <TableHead>Pickup Location</TableHead>
                    <TableHead>Pickup By</TableHead>
                    <TableHead>Meal Packets</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Updated At</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Updated By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedOrders.map((order: any) => {
                    const mealDetails = getMealDetails(order);
                    const isDeleted = !!order.deletedAt;
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          <button
                            type="button"
                            className="text-left text-foreground underline-offset-4 hover:underline"
                            onClick={() => setDetailOrder(order)}
                          >
                            {order.customer?.firstName} {order.customer?.lastName}
                          </button>
                        </TableCell>
                        <TableCell>{order.pickupLocation?.name || 'Unassigned'}</TableCell>
                        <TableCell>
                          {order.pickupByCustomer
                            ? `${order.pickupByCustomer.firstName} ${order.pickupByCustomer.lastName}`.trim()
                            : `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-sm font-medium">Total: {mealDetails.total}</span>
                            {mealDetails.meals.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No meals</span>
                            ) : (
                              mealDetails.meals.map((meal) => (
                                <Badge key={meal.label} variant="secondary">
                                  {meal.label} {meal.qty}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {getOrderCost(order).toFixed(2)}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                          {order.note ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{order.note}</span>
                              </TooltipTrigger>
                              <TooltipContent>{order.note}</TooltipContent>
                            </Tooltip>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {isDeleted ? (
                            <Badge variant="secondary">Deleted</Badge>
                          ) : (
                            <Badge variant="outline">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {order.updatedAt
                            ? new Date(order.updatedAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {order.createdBy
                            ? `${order.createdBy.firstName} ${order.createdBy.lastName}`.trim()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {order.updatedBy
                            ? `${order.updatedBy.firstName} ${order.updatedBy.lastName}`.trim()
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {isDeleted ? (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7"
                              onClick={() => restoreOrder(order.id)}
                              disabled={!canEditOrders}
                              aria-label="Restore order"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7"
                                onClick={() => startEdit(order)}
                                disabled={!canEditOrders}
                                aria-label="Edit order"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="h-7 w-7"
                                onClick={() => deleteOrder(order.id)}
                                disabled={!canEditOrders}
                                aria-label="Delete order"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Sort by</span>
                    <Select
                      value={ordersSortBy}
                      onValueChange={(value) =>
                        setOrdersSortBy(value as 'created' | 'updated' | 'name')
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
                      value={String(ordersRowsPerPage)}
                      onValueChange={(value) => {
                        const parsed = Number(value);
                        setOrdersRowsPerPage(parsed);
                        setOrdersPage(1);
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
                    {sortedOrders.length === 0
                      ? '0 of 0'
                      : `${(ordersPage - 1) * ordersRowsPerPage + 1}-${Math.min(
                          ordersPage * ordersRowsPerPage,
                          sortedOrders.length,
                        )} of ${sortedOrders.length}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrdersPage((prev) => Math.max(1, prev - 1))}
                      disabled={ordersPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setOrdersPage((prev) => Math.min(ordersPageCount, prev + 1))
                      }
                      disabled={ordersPage >= ordersPageCount}
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
        open={!!editingOrderId}
        onOpenChange={(open) => {
          if (!open) setEditingOrderId(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="orders-edit-chicken">Chicken</Label>
              <Input
                id="orders-edit-chicken"
                type="number"
                min={0}
                value={editForm.chickenQty}
                onChange={(e) => setEditForm({ ...editForm, chickenQty: Number(e.target.value) })}
                disabled={!canEditOrders}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orders-edit-fish">Fish</Label>
              <Input
                id="orders-edit-fish"
                type="number"
                min={0}
                value={editForm.fishQty}
                onChange={(e) => setEditForm({ ...editForm, fishQty: Number(e.target.value) })}
                disabled={!canEditOrders}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orders-edit-veg">Veg</Label>
              <Input
                id="orders-edit-veg"
                type="number"
                min={0}
                value={editForm.vegQty}
                onChange={(e) => setEditForm({ ...editForm, vegQty: Number(e.target.value) })}
                disabled={!canEditOrders}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orders-edit-egg">Egg</Label>
              <Input
                id="orders-edit-egg"
                type="number"
                min={0}
                value={editForm.eggQty}
                onChange={(e) => setEditForm({ ...editForm, eggQty: Number(e.target.value) })}
                disabled={!canEditOrders}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orders-edit-other">Other</Label>
              <Input
                id="orders-edit-other"
                type="number"
                min={0}
                value={editForm.otherQty}
                onChange={(e) => setEditForm({ ...editForm, otherQty: Number(e.target.value) })}
                disabled={!canEditOrders}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="orders-edit-note">Order Note</Label>
            <Textarea
              id="orders-edit-note"
              value={editForm.note}
              onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
              placeholder="Add a quick note for this order"
              disabled={!canEditOrders}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={submitEdit} disabled={!canEditOrders || editSaving}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="secondary" type="button" onClick={() => setEditingOrderId(null)}>
              Cancel
            </Button>
            {!canEditOrders && (
              <span className="text-sm text-muted-foreground">
                Editing is restricted based on the campaign state.
              </span>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <OrderDetailsModal
        order={detailOrder}
        open={!!detailOrder}
        onOpenChange={(open) => (!open ? setDetailOrder(null) : null)}
        campaignFallback={currentCampaignQuery.data}
      />
    </AppShell>
  );
}
