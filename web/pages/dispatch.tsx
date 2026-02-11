import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '../components/layout/app-shell';
import { PageHeader } from '../components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { OrderDetailsModal } from '../components/order-details-modal';
import { api } from '../lib/api';
import { formatAuMobile } from '../lib/phone';

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

const getOrderMealTotals = (order: any) => {
  const chicken = Number(order.chickenQty || 0);
  const fish = Number(order.fishQty || 0);
  const veg = Number(order.vegQty || 0);
  const egg = Number(order.eggQty || 0);
  const other = Number(order.otherQty || 0);
  const total = chicken + fish + veg + egg + other;
  return { chicken, fish, veg, egg, other, total };
};

const getName = (person?: any) => {
  if (!person) return 'Unknown';
  const name = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return name || 'Unknown';
};

export default function DispatchPage() {
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get('/locations')).data,
  });
  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/orders')).data,
  });
  const currentCampaignQuery = useQuery({
    queryKey: ['campaign-current'],
    queryFn: async () => (await api.get('/campaigns/current')).data,
  });
  const [selectedPickupId, setSelectedPickupId] = useState<string>('');
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryRowsPerPage, setSummaryRowsPerPage] = useState<'10' | '20' | '50' | '100' | 'all'>('10');
  const [collectorPages, setCollectorPages] = useState<Record<string, number>>({});
  const [collectorRowsPerPage, setCollectorRowsPerPage] = useState<
    '10' | '20' | '50' | '100' | 'all'
  >('10');

  const locations = useMemo(() => (locationsQuery.data || []) as any[], [locationsQuery.data]);
  const activeOrders = useMemo(() => {
    const currentCampaignId = currentCampaignQuery.data?.id;
    const scoped = currentCampaignId
      ? (ordersQuery.data || []).filter((order: any) => order.campaignId === currentCampaignId)
      : [];
    return scoped.filter((order: any) => !order.deletedAt);
  }, [ordersQuery.data, currentCampaignQuery.data?.id]);
  const summaryPageCount = useMemo(() => {
    if (summaryRowsPerPage === 'all') return 1;
    return Math.max(1, Math.ceil(locations.length / Number(summaryRowsPerPage)));
  }, [locations.length, summaryRowsPerPage]);
  const pagedLocations = useMemo(() => {
    if (summaryRowsPerPage === 'all') return locations;
    const start = (summaryPage - 1) * Number(summaryRowsPerPage);
    return locations.slice(start, start + Number(summaryRowsPerPage));
  }, [locations, summaryPage, summaryRowsPerPage]);

  const summaryByLocation = useMemo(() => {
    const map = new Map<
      string,
      { chicken: number; fish: number; veg: number; egg: number; other: number; total: number }
    >();
    activeOrders.forEach((order: any) => {
      const locationId = order.pickupLocationId || 'unassigned';
      const current = map.get(locationId) || { chicken: 0, fish: 0, veg: 0, egg: 0, other: 0, total: 0 };
      const totals = getOrderMealTotals(order);
      map.set(locationId, {
        chicken: current.chicken + totals.chicken,
        fish: current.fish + totals.fish,
        veg: current.veg + totals.veg,
        egg: current.egg + totals.egg,
        other: current.other + totals.other,
        total: current.total + totals.total,
      });
    });
    return map;
  }, [activeOrders]);
  const totalOrderCount = activeOrders.length;
  const summaryRangeLabel = useMemo(() => {
    if (locations.length === 0) return '0 of 0';
    if (summaryRowsPerPage === 'all') return `1-${locations.length} of ${locations.length}`;
    const start = (summaryPage - 1) * Number(summaryRowsPerPage) + 1;
    const end = Math.min(summaryPage * Number(summaryRowsPerPage), locations.length);
    return `${start}-${end} of ${locations.length}`;
  }, [locations.length, summaryPage, summaryRowsPerPage]);

  const pickupOrders = useMemo(() => {
    if (!selectedPickupId) return [];
    return activeOrders.filter((order: any) => order.pickupLocationId === selectedPickupId);
  }, [activeOrders, selectedPickupId]);

  const ordersByCollector = useMemo(() => {
    const map = new Map<string, { id: string; label: string; orders: any[] }>();
    pickupOrders.forEach((order: any) => {
      const createdBy = order.createdBy;
      const mainCollector =
        createdBy?.mainCollector && createdBy.mainCollector.id !== createdBy.id
          ? createdBy.mainCollector
          : null;
      const groupKey = mainCollector?.id || createdBy?.id || 'unknown';
      const label = getName(mainCollector || createdBy);
      if (!map.has(groupKey)) {
        map.set(groupKey, { id: groupKey, label, orders: [] });
      }
      map.get(groupKey)!.orders.push(order);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [pickupOrders]);
  const pickupOrderCount = pickupOrders.length;

  return (
    <AppShell title="Dispatch">
      <PageHeader
        title="Dispatch"
        description="Review pickup point summaries and grouped orders."
      />
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Dispatch Summary</TabsTrigger>
          <TabsTrigger value="pickup">Orders By Pickup Point</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>Dispatch Summary</CardTitle>
                <span className="text-sm font-medium text-muted-foreground">
                  Total Orders: {totalOrderCount}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {locationsQuery.isLoading || ordersQuery.isLoading || currentCampaignQuery.isLoading ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Loading dispatch summary...
                </div>
              ) : !currentCampaignQuery.data ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No active campaign. Dispatch summary will appear when a campaign is started.
                </div>
              ) : locations.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No pickup locations available.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-[1600px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 z-10 bg-background">Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Distributor</TableHead>
                        <TableHead>Transporter</TableHead>
                        <TableHead>Total Meals</TableHead>
                        <TableHead>Meals By Type</TableHead>
                        <TableHead>Delivery Time (Min)</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Dispatch Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedLocations.map((loc: any) => {
                        const totals = summaryByLocation.get(loc.id) || {
                          chicken: 0,
                          fish: 0,
                          veg: 0,
                          egg: 0,
                          other: 0,
                          total: 0,
                        };
                        const meals = [
                          { label: 'Chicken', value: totals.chicken },
                          { label: 'Fish', value: totals.fish },
                          { label: 'Veg', value: totals.veg },
                          { label: 'Egg', value: totals.egg },
                          { label: 'Other', value: totals.other },
                        ].filter((meal) => meal.value > 0);
                          return (
                          <TableRow key={loc.id}>
                            <TableCell className="sticky left-0 z-10 bg-background font-medium">
                              {loc.name}
                            </TableCell>
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
                            <TableCell className="font-semibold">{totals.total}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                {meals.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">No meals</span>
                                ) : (
                                  meals.map((meal) => (
                                    <Badge key={meal.label} variant="secondary">
                                      {meal.label} {meal.value}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {typeof loc.deliveryTimeMinutes === 'number' ? loc.deliveryTimeMinutes : '-'}
                            </TableCell>
                            <TableCell>
                              {typeof loc.distributionPriority === 'number' ? loc.distributionPriority : '-'}
                            </TableCell>
                            <TableCell>{formatDispatchTime(loc.timeOfDispatch)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Rows per page</span>
                      <Select
                        value={summaryRowsPerPage}
                        onValueChange={(value) => {
                          setSummaryRowsPerPage(value as '10' | '20' | '50' | '100' | 'all');
                          setSummaryPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="all">Show all</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{summaryRangeLabel}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSummaryPage((prev) => Math.max(1, prev - 1))}
                          disabled={summaryRowsPerPage === 'all' || summaryPage <= 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSummaryPage((prev) => Math.min(summaryPageCount, prev + 1))}
                          disabled={summaryRowsPerPage === 'all' || summaryPage >= summaryPageCount}
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
        </TabsContent>

        <TabsContent value="pickup">
          <Card>
            <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Orders By Pickup Point</CardTitle>
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Orders: {selectedPickupId ? pickupOrderCount : 0}
                  </span>
                </div>
              </div>
              <Select value={selectedPickupId} onValueChange={setSelectedPickupId}>
                <SelectTrigger className="w-full md:w-[280px]">
                  <SelectValue placeholder="Select pickup location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {locationsQuery.isLoading || ordersQuery.isLoading || currentCampaignQuery.isLoading ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Loading orders...
                </div>
              ) : !currentCampaignQuery.data ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No active campaign. Orders will appear when a campaign is started.
                </div>
              ) : !selectedPickupId ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Select a pickup location to view orders.
                </div>
              ) : pickupOrders.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No orders found for this pickup location.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Rows per page</span>
                      <Select
                        value={collectorRowsPerPage}
                        onValueChange={(value) => {
                          setCollectorRowsPerPage(value as '10' | '20' | '50' | '100' | 'all');
                          setCollectorPages({});
                        }}
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="all">Show all</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {ordersByCollector.map((group) => {
                    const rowsPerPage =
                      collectorRowsPerPage === 'all' ? group.orders.length : Number(collectorRowsPerPage);
                    const currentPage = collectorPages[group.id] || 1;
                    const pageCount = Math.max(1, Math.ceil(group.orders.length / Math.max(1, rowsPerPage)));
                    const start = (currentPage - 1) * Math.max(1, rowsPerPage);
                    const pagedOrders =
                      collectorRowsPerPage === 'all'
                        ? group.orders
                        : group.orders.slice(start, start + rowsPerPage);
                    const rangeLabel =
                      group.orders.length === 0
                        ? '0 of 0'
                        : `${start + 1}-${Math.min(start + Math.max(1, rowsPerPage), group.orders.length)} of ${
                            group.orders.length
                          }`;
                    return (
                    <div key={group.id} className="rounded-md border">
                      <div className="border-b bg-muted px-3 py-2 text-sm font-semibold">
                        Main Collector: {group.label}
                      </div>
                      <div className="w-full overflow-x-auto">
                        <Table className="min-w-[1100px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Entered By</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Mobile</TableHead>
                              <TableHead>Total Meals</TableHead>
                              <TableHead>Meals By Type</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pagedOrders.map((order: any) => {
                              const totals = getOrderMealTotals(order);
                              const meals = [
                                { label: 'Chicken', value: totals.chicken },
                                { label: 'Fish', value: totals.fish },
                                { label: 'Veg', value: totals.veg },
                                { label: 'Egg', value: totals.egg },
                                { label: 'Other', value: totals.other },
                              ].filter((meal) => meal.value > 0);
                              return (
                                <TableRow key={order.id}>
                                  <TableCell>{getName(order.createdBy)}</TableCell>
                                  <TableCell>
                                    <button
                                      type="button"
                                      className="text-left text-foreground underline-offset-4 hover:underline"
                                      onClick={() => setDetailOrder(order)}
                                    >
                                      {getName(order.customer)}
                                    </button>
                                  </TableCell>
                                  <TableCell>{formatAuMobile(order.customer?.mobile || '') || '-'}</TableCell>
                                  <TableCell className="font-medium">{totals.total}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {meals.length === 0 ? (
                                        <span className="text-xs text-muted-foreground">No meals</span>
                                      ) : (
                                        meals.map((meal) => (
                                          <Badge key={meal.label} variant="secondary">
                                            {meal.label} {meal.value}
                                          </Badge>
                                        ))
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-[240px] truncate text-muted-foreground">
                                    {order.note || '-'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
                        <span>{rangeLabel}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCollectorPages((prev) => ({
                                ...prev,
                                [group.id]: Math.max(1, currentPage - 1),
                              }))
                            }
                            disabled={collectorRowsPerPage === 'all' || currentPage <= 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCollectorPages((prev) => ({
                                ...prev,
                                [group.id]: Math.min(pageCount, currentPage + 1),
                              }))
                            }
                            disabled={collectorRowsPerPage === 'all' || currentPage >= pageCount}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <OrderDetailsModal
        order={detailOrder}
        open={!!detailOrder}
        onOpenChange={(open) => (!open ? setDetailOrder(null) : null)}
      />
    </AppShell>
  );
}
