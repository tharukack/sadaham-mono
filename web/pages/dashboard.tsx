import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { AppShell } from '../components/layout/app-shell';
import { PageHeader } from '../components/page-header';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../components/ui/command';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useToast } from '../components/ui/use-toast';
import { KpiCards } from '../components/dashboard/kpi-cards';
import { OrdersTrendChart } from '../components/dashboard/orders-trend-chart';
import { MealTotalsChart } from '../components/dashboard/meal-totals-chart';
import { PickupLocationsTable } from '../components/dashboard/pickup-locations-table';
import { SmsSummary } from '../components/dashboard/sms-summary';

type Campaign = {
  id: string;
  name: string;
  state: string;
  startedAt?: string;
  frozenAt?: string | null;
  endedAt?: string | null;
};

type CampaignStats = {
  campaign: Campaign;
  orders: {
    totalOrders: number;
    totalCustomers: number;
    byPickupLocation: Array<{ locationId: string; locationName: string; orders: number }>;
    mealTotals: { chicken: number; fish: number; veg: number; egg: number; other: number };
    dailyOrders: Array<{ date: string; orders: number }>;
  };
  sms: { queued: number; sent: number; delivered: number; failed: number };
};

export default function Dashboard() {
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

  const lastEndedQuery = useQuery({
    queryKey: ['campaign-last-ended'],
    queryFn: async () => (await api.get('/campaigns/last-ended')).data,
    enabled: currentCampaignQuery.isFetched && !currentCampaignQuery.data,
  });

  const selectedCampaign: Campaign | null = currentCampaignQuery.data || lastEndedQuery.data || null;
  const isFallback = !currentCampaignQuery.data && !!lastEndedQuery.data;

  const statsQuery = useQuery<CampaignStats>({
    queryKey: ['campaign-stats', selectedCampaign?.id],
    queryFn: async () => (await api.get(`/campaigns/${selectedCampaign?.id}/stats`)).data,
    enabled: !!selectedCampaign?.id,
  });

  const ordersQuery = useQuery({
    queryKey: ['campaign-orders', selectedCampaign?.id],
    queryFn: async () => (await api.get(`/campaigns/${selectedCampaign?.id}/orders`)).data,
    enabled: !!selectedCampaign?.id,
  });

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get('/locations')).data,
    enabled: !!selectedCampaign?.id,
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [addExistingOrderId, setAddExistingOrderId] = useState<string | null>(null);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [addOriginalForm, setAddOriginalForm] = useState({
    pickupLocationId: '',
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
  });
  const [editOriginalForm, setEditOriginalForm] = useState({
    pickupLocationId: '',
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
  });
  const [orderForm, setOrderForm] = useState({
    pickupLocationId: '',
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
  });
  const [editForm, setEditForm] = useState({
    pickupLocationId: '',
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
  });

  const customersQuery = useQuery({
    queryKey: ['customer-search', customerSearch],
    queryFn: async () => (await api.get('/customers/search', { params: { q: customerSearch } })).data,
    enabled: !!selectedCampaign?.id && customerSearch.trim().length > 0,
  });

  const isAdmin = currentRole === 'ADMIN';
  const isEditor = currentRole === 'EDITOR';
  const isLoadingCampaigns = currentCampaignQuery.isLoading || lastEndedQuery.isLoading;
  const stats = statsQuery.data;
  const { toast } = useToast();

  const orders = useMemo(() => {
    if (!selectedCampaign?.id) return [];
    return (ordersQuery.data || []) as any[];
  }, [ordersQuery.data, selectedCampaign?.id]);

  const selectedCustomer = useMemo(() => {
    return (customersQuery.data || []).find((c: any) => c.id === selectedCustomerId);
  }, [customersQuery.data, selectedCustomerId]);

  const existingOrderForCustomer = useMemo(() => {
    if (!selectedCampaign?.id || !selectedCustomerId) return null;
    return orders.find((order: any) => order.customerId === selectedCustomerId) || null;
  }, [orders, selectedCampaign?.id, selectedCustomerId]);

  const canCreateOrders =
    !!currentCampaignQuery.data &&
    currentCampaignQuery.data.state === 'STARTED' &&
    (isAdmin || isEditor);
  const canEditOrders =
    !!currentCampaignQuery.data &&
    (currentCampaignQuery.data.state === 'STARTED'
      ? isAdmin || isEditor
      : currentCampaignQuery.data.state === 'FROZEN'
      ? isAdmin
      : false);
  const canDeleteOrders = canEditOrders;

  const isAddFormDirty = useMemo(() => {
    const current = {
      pickupLocationId: orderForm.pickupLocationId || '',
      chickenQty: Number(orderForm.chickenQty || 0),
      fishQty: Number(orderForm.fishQty || 0),
      vegQty: Number(orderForm.vegQty || 0),
      eggQty: Number(orderForm.eggQty || 0),
      otherQty: Number(orderForm.otherQty || 0),
    };
    const original = {
      pickupLocationId: addOriginalForm.pickupLocationId || '',
      chickenQty: Number(addOriginalForm.chickenQty || 0),
      fishQty: Number(addOriginalForm.fishQty || 0),
      vegQty: Number(addOriginalForm.vegQty || 0),
      eggQty: Number(addOriginalForm.eggQty || 0),
      otherQty: Number(addOriginalForm.otherQty || 0),
    };
    return JSON.stringify(current) !== JSON.stringify(original);
  }, [orderForm, addOriginalForm]);

  const isEditFormDirty = useMemo(() => {
    const current = {
      pickupLocationId: editForm.pickupLocationId || '',
      chickenQty: Number(editForm.chickenQty || 0),
      fishQty: Number(editForm.fishQty || 0),
      vegQty: Number(editForm.vegQty || 0),
      eggQty: Number(editForm.eggQty || 0),
      otherQty: Number(editForm.otherQty || 0),
    };
    const original = {
      pickupLocationId: editOriginalForm.pickupLocationId || '',
      chickenQty: Number(editOriginalForm.chickenQty || 0),
      fishQty: Number(editOriginalForm.fishQty || 0),
      vegQty: Number(editOriginalForm.vegQty || 0),
      eggQty: Number(editOriginalForm.eggQty || 0),
      otherQty: Number(editOriginalForm.otherQty || 0),
    };
    return JSON.stringify(current) !== JSON.stringify(original);
  }, [editForm, editOriginalForm]);

  const addMealTotal = useMemo(() => {
    return (
      Number(orderForm.chickenQty || 0) +
      Number(orderForm.fishQty || 0) +
      Number(orderForm.vegQty || 0) +
      Number(orderForm.eggQty || 0) +
      Number(orderForm.otherQty || 0)
    );
  }, [orderForm]);

  const editMealTotal = useMemo(() => {
    return (
      Number(editForm.chickenQty || 0) +
      Number(editForm.fishQty || 0) +
      Number(editForm.vegQty || 0) +
      Number(editForm.eggQty || 0) +
      Number(editForm.otherQty || 0)
    );
  }, [editForm]);

  const canSubmitAdd =
    canCreateOrders &&
    !!selectedCustomerId &&
    !!orderForm.pickupLocationId &&
    addMealTotal > 0 &&
    isAddFormDirty;
  const canSubmitEdit =
    canEditOrders && !!editForm.pickupLocationId && editMealTotal > 0 && isEditFormDirty;

  useEffect(() => {
    if (!selectedCustomerId) {
      setAddExistingOrderId(null);
      setAddOriginalForm({
        pickupLocationId: '',
        chickenQty: 0,
        fishQty: 0,
        vegQty: 0,
        eggQty: 0,
        otherQty: 0,
      });
      return;
    }
    if (existingOrderForCustomer) {
      const base = {
        pickupLocationId: existingOrderForCustomer.pickupLocationId || '',
        chickenQty: existingOrderForCustomer.chickenQty || 0,
        fishQty: existingOrderForCustomer.fishQty || 0,
        vegQty: existingOrderForCustomer.vegQty || 0,
        eggQty: existingOrderForCustomer.eggQty || 0,
        otherQty: existingOrderForCustomer.otherQty || 0,
      };
      setAddExistingOrderId(existingOrderForCustomer.id);
      setAddOriginalForm(base);
      setOrderForm(base);
    } else {
      const empty = {
        pickupLocationId: '',
        chickenQty: 0,
        fishQty: 0,
        vegQty: 0,
        eggQty: 0,
        otherQty: 0,
      };
      setAddExistingOrderId(null);
      setAddOriginalForm(empty);
      setOrderForm(empty);
    }
  }, [selectedCustomerId, existingOrderForCustomer]);

  const startEdit = (order: any) => {
    setEditingOrderId(order.id);
    setShowEditModal(true);
    const base = {
      pickupLocationId: order.pickupLocationId || '',
      chickenQty: order.chickenQty || 0,
      fishQty: order.fishQty || 0,
      vegQty: order.vegQty || 0,
      eggQty: order.eggQty || 0,
      otherQty: order.otherQty || 0,
    };
    setEditOriginalForm(base);
    setEditForm(base);
  };

  const submitOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCreateOrders) return;
    setOrderSaving(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        pickupLocationId: orderForm.pickupLocationId,
        chickenQty: Number(orderForm.chickenQty || 0),
        fishQty: Number(orderForm.fishQty || 0),
        vegQty: Number(orderForm.vegQty || 0),
        eggQty: Number(orderForm.eggQty || 0),
        otherQty: Number(orderForm.otherQty || 0),
      };
      if (addExistingOrderId) {
        await api.patch(`/orders/${addExistingOrderId}`, payload);
      } else {
        await api.post('/orders', payload);
      }
      setSelectedCustomerId('');
      setCustomerSearch('');
      setOrderForm({
        pickupLocationId: '',
        chickenQty: 0,
        fishQty: 0,
        vegQty: 0,
        eggQty: 0,
        otherQty: 0,
      });
      setAddExistingOrderId(null);
      setAddOriginalForm({
        pickupLocationId: '',
        chickenQty: 0,
        fishQty: 0,
        vegQty: 0,
        eggQty: 0,
        otherQty: 0,
      });
      await ordersQuery.refetch();
      await statsQuery.refetch();
      setShowAddModal(false);
      toast({ title: addExistingOrderId ? 'Order updated' : 'Order created' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to save order',
        description: err?.response?.data?.message || 'Unable to save order.',
      });
    } finally {
      setOrderSaving(false);
    }
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingOrderId || !canEditOrders) return;
    setEditSaving(true);
    try {
      await api.patch(`/orders/${editingOrderId}`, {
        pickupLocationId: editForm.pickupLocationId,
        chickenQty: Number(editForm.chickenQty || 0),
        fishQty: Number(editForm.fishQty || 0),
        vegQty: Number(editForm.vegQty || 0),
        eggQty: Number(editForm.eggQty || 0),
        otherQty: Number(editForm.otherQty || 0),
      });
      setEditingOrderId(null);
      setShowEditModal(false);
      await ordersQuery.refetch();
      await statsQuery.refetch();
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

  const LocationPicker = ({
    value,
    onChange,
    disabled,
    open,
    onOpenChange,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    const selected = (locationsQuery.data || []).find((loc: any) => loc.id === value);

    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-between" disabled={disabled}>
            {selected ? selected.name : 'Select location'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput placeholder="Search locations..." />
            <CommandList>
              <CommandEmpty>No locations found.</CommandEmpty>
              <CommandGroup>
                {(locationsQuery.data || []).map((loc: any) => (
                  <CommandItem
                    key={loc.id}
                    value={`${loc.name} ${loc.distributorName}`}
                    onSelect={() => {
                      onChange(loc.id);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{loc.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {loc.distributorName}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };
  const emptyOrders = useMemo(
    () =>
      stats?.orders ?? {
        totalOrders: 0,
        totalCustomers: 0,
        byPickupLocation: [],
        mealTotals: { chicken: 0, fish: 0, veg: 0, egg: 0, other: 0 },
        dailyOrders: [],
      },
    [stats]
  );

  const emptySms = useMemo(
    () => stats?.sms ?? { queued: 0, sent: 0, delivered: 0, failed: 0 },
    [stats]
  );

  const deleteOrder = async (id: string) => {
    if (!canDeleteOrders) return;
    try {
      await api.patch(`/orders/${id}/delete`);
      await ordersQuery.refetch();
      await statsQuery.refetch();
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
    if (!canDeleteOrders) return;
    try {
      await api.patch(`/orders/${id}/restore`);
      await ordersQuery.refetch();
      await statsQuery.refetch();
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
    <AppShell title="Dashboard">
      <PageHeader title="Dashboard" description="Campaign performance and operational insights." />

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Campaign Overview</CardTitle>
          <Separator />
        </CardHeader>
        <CardContent>
          {isLoadingCampaigns ? (
            <div className="text-sm text-muted-foreground">Loading campaigns...</div>
          ) : !selectedCampaign ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              <div className="text-base font-semibold text-foreground">No campaigns yet</div>
              <div className="mt-2">Ask an admin to start a campaign.</div>
              {isAdmin && (
                <Button className="mt-4" asChild>
                  <Link href="/admin/campaign">Start Campaign</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-lg font-semibold">{selectedCampaign.name}</div>
                <Badge variant="secondary">{selectedCampaign.state}</Badge>
                {isFallback && (
                  <span className="text-sm text-muted-foreground">
                    Showing last ended campaign
                  </span>
                )}
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">Orders</div>
                  {canCreateOrders && (
                    <Button onClick={() => setShowAddModal(true)}>Add Order</Button>
                  )}
                </div>
                {ordersQuery.isLoading ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Loading orders...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No orders in this campaign.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Pickup Location</TableHead>
                        <TableHead>Meals</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => {
                        const mealCount =
                          Number(order.chickenQty || 0) +
                          Number(order.fishQty || 0) +
                          Number(order.vegQty || 0) +
                          Number(order.eggQty || 0) +
                          Number(order.otherQty || 0);
                        const isDeleted = !!order.deletedAt;
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">
                              {order.customer?.firstName} {order.customer?.lastName}
                            </TableCell>
                            <TableCell>{order.pickupLocation?.name || 'Unassigned'}</TableCell>
                            <TableCell>
                              C:{order.chickenQty || 0} F:{order.fishQty || 0} V:
                              {order.vegQty || 0} E:{order.eggQty || 0} O:
                              {order.otherQty || 0}
                            </TableCell>
                            <TableCell>
                              {isDeleted ? (
                                <Badge variant="secondary">Deleted</Badge>
                              ) : (
                                <Badge variant="outline">Active</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isDeleted ? (
                                canEditOrders ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => restoreOrder(order.id)}
                                  >
                                    Restore
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Deleted</span>
                                )
                              ) : canEditOrders ? (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => startEdit(order)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteOrder(order.id)}
                                    disabled={!canDeleteOrders}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No access</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedCampaign ? null : statsQuery.isError ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="text-sm font-medium text-destructive">
              Failed to load dashboard stats.
            </div>
            <Button onClick={() => statsQuery.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : statsQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading dashboard...
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <KpiCards
              totalOrders={emptyOrders.totalOrders}
              totalCustomers={emptyOrders.totalCustomers}
              mealTotals={emptyOrders.mealTotals}
              sms={emptySms}
              campaignState={stats?.campaign?.state}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <OrdersTrendChart data={emptyOrders.dailyOrders} />
              <MealTotalsChart totals={emptyOrders.mealTotals} />
            </div>
            <PickupLocationsTable
              rows={emptyOrders.byPickupLocation}
              totalOrders={emptyOrders.totalOrders}
            />
            <SmsSummary
              queued={emptySms.queued}
              sent={emptySms.sent}
              delivered={emptySms.delivered}
              failed={emptySms.failed}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <PickupLocationsTable
              rows={emptyOrders.byPickupLocation}
              totalOrders={emptyOrders.totalOrders}
            />
            <Card>
              <CardHeader>
                <CardTitle>Meal Totals</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meal Type</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(emptyOrders.mealTotals).map(([meal, total]) => (
                      <TableRow key={meal}>
                        <TableCell className="font-medium">{meal}</TableCell>
                        <TableCell>{total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>SMS Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(emptySms).map(([status, count]) => (
                      <TableRow key={status}>
                        <TableCell className="font-medium">{status}</TableCell>
                        <TableCell>{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitOrder} className="space-y-4">
            <div className="space-y-2">
              <Label>Find Customer</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name or mobile"
                  disabled={!canCreateOrders}
                />
                {canCreateOrders ? (
                  <Button type="button" variant="secondary" asChild>
                    <Link href="/customers/search">Add Customer</Link>
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" disabled>
                    Add Customer
                  </Button>
                )}
              </div>
            </div>
            {customerSearch.trim().length > 0 && (
              <div className="rounded-md border">
                {customersQuery.isLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading customers...</div>
                ) : (customersQuery.data || []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No customers found.</div>
                ) : (
                  (customersQuery.data || []).map((c: any) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={selectedCustomerId === c.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start rounded-none"
                      onClick={() => setSelectedCustomerId(c.id)}
                      disabled={!canCreateOrders}
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
            {selectedCustomer && (
              <div className="text-sm text-muted-foreground">
                Selected: {selectedCustomer.firstName} {selectedCustomer.lastName}
              </div>
            )}
            {addExistingOrderId && (
              <div className="text-sm text-amber-700">
                This customer already has an order. Saving will update the existing order.
              </div>
            )}
            <div className="space-y-2">
              <Label>Pickup Location</Label>
              <LocationPicker
                value={orderForm.pickupLocationId}
                onChange={(value) => setOrderForm({ ...orderForm, pickupLocationId: value })}
                disabled={!canCreateOrders}
                open={addLocationOpen}
                onOpenChange={setAddLocationOpen}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="dash-add-chicken">Chicken</Label>
                <Input
                  id="dash-add-chicken"
                  type="number"
                  min={0}
                  value={orderForm.chickenQty}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, chickenQty: Number(e.target.value) })
                  }
                  disabled={!canCreateOrders}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-add-fish">Fish</Label>
                <Input
                  id="dash-add-fish"
                  type="number"
                  min={0}
                  value={orderForm.fishQty}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, fishQty: Number(e.target.value) })
                  }
                  disabled={!canCreateOrders}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-add-veg">Veg</Label>
                <Input
                  id="dash-add-veg"
                  type="number"
                  min={0}
                  value={orderForm.vegQty}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, vegQty: Number(e.target.value) })
                  }
                  disabled={!canCreateOrders}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-add-egg">Egg</Label>
                <Input
                  id="dash-add-egg"
                  type="number"
                  min={0}
                  value={orderForm.eggQty}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, eggQty: Number(e.target.value) })
                  }
                  disabled={!canCreateOrders}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-add-other">Other</Label>
                <Input
                  id="dash-add-other"
                  type="number"
                  min={0}
                  value={orderForm.otherQty}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, otherQty: Number(e.target.value) })
                  }
                  disabled={!canCreateOrders}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canSubmitAdd || orderSaving}>
                {orderSaving ? 'Saving...' : addExistingOrderId ? 'Save Changes' : 'Save Order'}
              </Button>
              {!canCreateOrders && (
                <span className="text-sm text-muted-foreground">
                  Orders can only be created when a campaign is STARTED.
                </span>
              )}
              {selectedCustomerId && !isAddFormDirty && (
                <span className="text-sm text-muted-foreground">
                  Make a change to enable saving.
                </span>
              )}
              {selectedCustomerId && (!orderForm.pickupLocationId || addMealTotal === 0) && (
                <span className="text-sm text-muted-foreground">
                  Select a pickup location and enter at least one meal.
                </span>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditModal}
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) {
            setEditingOrderId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Pickup Location</Label>
              <LocationPicker
                value={editForm.pickupLocationId}
                onChange={(value) => setEditForm({ ...editForm, pickupLocationId: value })}
                disabled={!canEditOrders}
                open={editLocationOpen}
                onOpenChange={setEditLocationOpen}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="dash-edit-chicken">Chicken</Label>
                <Input
                  id="dash-edit-chicken"
                  type="number"
                  min={0}
                  value={editForm.chickenQty}
                  onChange={(e) =>
                    setEditForm({ ...editForm, chickenQty: Number(e.target.value) })
                  }
                  disabled={!canEditOrders}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-edit-fish">Fish</Label>
                <Input
                  id="dash-edit-fish"
                  type="number"
                  min={0}
                  value={editForm.fishQty}
                  onChange={(e) =>
                    setEditForm({ ...editForm, fishQty: Number(e.target.value) })
                  }
                  disabled={!canEditOrders}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-edit-veg">Veg</Label>
                <Input
                  id="dash-edit-veg"
                  type="number"
                  min={0}
                  value={editForm.vegQty}
                  onChange={(e) =>
                    setEditForm({ ...editForm, vegQty: Number(e.target.value) })
                  }
                  disabled={!canEditOrders}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-edit-egg">Egg</Label>
                <Input
                  id="dash-edit-egg"
                  type="number"
                  min={0}
                  value={editForm.eggQty}
                  onChange={(e) =>
                    setEditForm({ ...editForm, eggQty: Number(e.target.value) })
                  }
                  disabled={!canEditOrders}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-edit-other">Other</Label>
                <Input
                  id="dash-edit-other"
                  type="number"
                  min={0}
                  value={editForm.otherQty}
                  onChange={(e) =>
                    setEditForm({ ...editForm, otherQty: Number(e.target.value) })
                  }
                  disabled={!canEditOrders}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canSubmitEdit || editSaving}>
                {editSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="secondary" type="button" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              {!canEditOrders && (
                <span className="text-sm text-muted-foreground">
                  Editing is restricted based on the campaign state.
                </span>
              )}
              {canEditOrders && !isEditFormDirty && (
                <span className="text-sm text-muted-foreground">
                  Make a change to enable saving.
                </span>
              )}
              {canEditOrders && (!editForm.pickupLocationId || editMealTotal === 0) && (
                <span className="text-sm text-muted-foreground">
                  Select a pickup location and enter at least one meal.
                </span>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
