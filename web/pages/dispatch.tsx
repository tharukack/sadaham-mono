import { useEffect, useMemo, useState } from 'react';
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

const toCsvValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const downloadCsv = (filename: string, rows: Array<Array<unknown>>) => {
  const content = rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const toFileSafeName = (value?: string) => {
  if (!value) return 'campaign';
  return value.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
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
  const [pickupPage, setPickupPage] = useState(1);
  const [collectorRowsPerPage, setCollectorRowsPerPage] = useState<
    '10' | '20' | '50' | '100' | 'all'
  >('10');
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersRowsPerPage, setOrdersRowsPerPage] = useState<'10' | '20' | '50' | '100' | 'all'>('10');
  const [ordersSortBy, setOrdersSortBy] = useState<'created' | 'customer' | 'pickup'>('created');
  const [ordersSortDir, setOrdersSortDir] = useState<'asc' | 'desc'>('desc');
  const [systemUserFilter, setSystemUserFilter] = useState<string>('all');
  const [mainUserFilter, setMainUserFilter] = useState<string>('all');

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
  const selectedPickupName = useMemo(() => {
    if (!selectedPickupId) return '';
    return locations.find((loc: any) => loc.id === selectedPickupId)?.name || '';
  }, [locations, selectedPickupId]);

  const pickupOrderCount = pickupOrders.length;
  const pickupPageCount = useMemo(() => {
    if (collectorRowsPerPage === 'all') return 1;
    return Math.max(1, Math.ceil(pickupOrders.length / Number(collectorRowsPerPage)));
  }, [pickupOrders.length, collectorRowsPerPage]);

  const pickupPagedOrders = useMemo(() => {
    if (collectorRowsPerPage === 'all') return pickupOrders;
    const start = (pickupPage - 1) * Number(collectorRowsPerPage);
    return pickupOrders.slice(start, start + Number(collectorRowsPerPage));
  }, [pickupOrders, pickupPage, collectorRowsPerPage]);

  const pickupRangeLabel = useMemo(() => {
    if (pickupOrders.length === 0) return '0 of 0';
    if (collectorRowsPerPage === 'all') return `1-${pickupOrders.length} of ${pickupOrders.length}`;
    const start = (pickupPage - 1) * Number(collectorRowsPerPage) + 1;
    const end = Math.min(pickupPage * Number(collectorRowsPerPage), pickupOrders.length);
    return `${start}-${end} of ${pickupOrders.length}`;
  }, [pickupOrders.length, pickupPage, collectorRowsPerPage]);

  useEffect(() => {
    setPickupPage(1);
  }, [selectedPickupId]);
  const campaignFileLabel = toFileSafeName(currentCampaignQuery.data?.name);

  const systemUsers = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    activeOrders.forEach((order: any) => {
      const createdBy = order.createdBy;
      if (!createdBy?.id) return;
      map.set(createdBy.id, { id: createdBy.id, label: getName(createdBy) });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeOrders]);

  const mainUsers = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    activeOrders.forEach((order: any) => {
      const createdBy = order.createdBy;
      const mainCollector =
        createdBy?.mainCollector && createdBy.mainCollector.id !== createdBy.id
          ? createdBy.mainCollector
          : null;
      if (!mainCollector?.id) return;
      map.set(mainCollector.id, { id: mainCollector.id, label: getName(mainCollector) });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeOrders]);

  const filteredOrders = useMemo(() => {
    return activeOrders.filter((order: any) => {
      const createdById = order.createdBy?.id || '';
      const mainCollectorId =
        order.createdBy?.mainCollector && order.createdBy.mainCollector.id !== order.createdBy.id
          ? order.createdBy.mainCollector.id
          : '';
      const matchesSystem = systemUserFilter === 'all' || createdById === systemUserFilter;
      const matchesMain = mainUserFilter === 'all' || mainCollectorId === mainUserFilter;
      return matchesSystem && matchesMain;
    });
  }, [activeOrders, systemUserFilter, mainUserFilter]);

  const sortedOrders = useMemo(() => {
    const next = [...filteredOrders];
    next.sort((a: any, b: any) => {
      if (ordersSortBy === 'customer') {
        const aName = getName(a.customer);
        const bName = getName(b.customer);
        return ordersSortDir === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
      }
      if (ordersSortBy === 'pickup') {
        const aPickup = locations.find((loc: any) => loc.id === a.pickupLocationId)?.name || '';
        const bPickup = locations.find((loc: any) => loc.id === b.pickupLocationId)?.name || '';
        return ordersSortDir === 'asc' ? aPickup.localeCompare(bPickup) : bPickup.localeCompare(aPickup);
      }
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return ordersSortDir === 'asc' ? aDate - bDate : bDate - aDate;
    });
    return next;
  }, [filteredOrders, ordersSortBy, ordersSortDir, locations]);

  const ordersPageCount = useMemo(() => {
    if (ordersRowsPerPage === 'all') return 1;
    return Math.max(1, Math.ceil(sortedOrders.length / Number(ordersRowsPerPage)));
  }, [sortedOrders.length, ordersRowsPerPage]);

  const pagedOrders = useMemo(() => {
    if (ordersRowsPerPage === 'all') return sortedOrders;
    const start = (ordersPage - 1) * Number(ordersRowsPerPage);
    return sortedOrders.slice(start, start + Number(ordersRowsPerPage));
  }, [sortedOrders, ordersPage, ordersRowsPerPage]);

  const ordersRangeLabel = useMemo(() => {
    if (sortedOrders.length === 0) return '0 of 0';
    if (ordersRowsPerPage === 'all') return `1-${sortedOrders.length} of ${sortedOrders.length}`;
    const start = (ordersPage - 1) * Number(ordersRowsPerPage) + 1;
    const end = Math.min(ordersPage * Number(ordersRowsPerPage), sortedOrders.length);
    return `${start}-${end} of ${sortedOrders.length}`;
  }, [sortedOrders.length, ordersPage, ordersRowsPerPage]);

  const exportSummaryCsv = () => {
    const rows: Array<Array<unknown>> = [
      [
        'Name',
        'Address',
        'Distributor',
        'Distributor Mobile',
        'Transporter',
        'Transporter Mobile',
        'Total Meals',
        'Chicken',
        'Fish',
        'Veg',
        'Egg',
        'Other',
        'Delivery Time (Min)',
        'Priority',
        'Dispatch Time',
      ],
    ];
    locations.forEach((loc: any) => {
      const totals = summaryByLocation.get(loc.id) || {
        chicken: 0,
        fish: 0,
        veg: 0,
        egg: 0,
        other: 0,
        total: 0,
      };
      const distributorName = loc.distributorCustomer
        ? getName(loc.distributorCustomer)
        : loc.distributorName || '';
      const distributorMobile = loc.distributorCustomer
        ? formatAuMobile(loc.distributorCustomer.mobile || '') || ''
        : formatAuMobile(loc.distributorMobile || '') || '';
      const transporterName = loc.transporterCustomer ? getName(loc.transporterCustomer) : '';
      const transporterMobile = loc.transporterCustomer
        ? formatAuMobile(loc.transporterCustomer.mobile || '') || ''
        : '';
      rows.push([
        loc.name || '',
        loc.address || '',
        distributorName,
        distributorMobile,
        transporterName,
        transporterMobile,
        totals.total,
        totals.chicken,
        totals.fish,
        totals.veg,
        totals.egg,
        totals.other,
        typeof loc.deliveryTimeMinutes === 'number' ? loc.deliveryTimeMinutes : '',
        typeof loc.distributionPriority === 'number' ? loc.distributionPriority : '',
        formatDispatchTime(loc.timeOfDispatch),
      ]);
    });
    downloadCsv(`dispatch-summary-${campaignFileLabel}.csv`, rows);
  };

  const exportPickupCsv = () => {
    if (!selectedPickupId) return;
    const rows: Array<Array<unknown>> = [
      [
        'Pickup Location',
        'Main Collector',
        'Entered By',
        'Customer',
        'Customer Mobile',
        'Total Meals',
        'Chicken',
        'Fish',
        'Veg',
        'Egg',
        'Other',
        'Notes',
      ],
    ];
    pickupOrders.forEach((order: any) => {
      const createdBy = order.createdBy;
      const mainCollector =
        createdBy?.mainCollector && createdBy.mainCollector.id !== createdBy.id
          ? createdBy.mainCollector
          : null;
      const totals = getOrderMealTotals(order);
      rows.push([
        selectedPickupName,
        getName(mainCollector || createdBy),
        getName(createdBy),
        getName(order.customer),
        formatAuMobile(order.customer?.mobile || '') || '',
        totals.total,
        totals.chicken,
        totals.fish,
        totals.veg,
        totals.egg,
        totals.other,
        order.note || '',
      ]);
    });
    const pickupLabel = toFileSafeName(selectedPickupName || 'pickup');
    downloadCsv(`pickup-orders-${campaignFileLabel}-${pickupLabel}.csv`, rows);
  };

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
          <TabsTrigger value="orders">All Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle>Dispatch Summary</CardTitle>
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Orders: {totalOrderCount}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportSummaryCsv}
                  disabled={
                    locationsQuery.isLoading ||
                    ordersQuery.isLoading ||
                    currentCampaignQuery.isLoading ||
                    !currentCampaignQuery.data ||
                    locations.length === 0
                  }
                >
                  Export CSV
                </Button>
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
                        <SelectTrigger className="h-8 w-full sm:w-[110px]">
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
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportPickupCsv}
                  disabled={
                    locationsQuery.isLoading ||
                    ordersQuery.isLoading ||
                    currentCampaignQuery.isLoading ||
                    !currentCampaignQuery.data ||
                    !selectedPickupId ||
                    pickupOrders.length === 0
                  }
                >
                  Export CSV
                </Button>
              </div>
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
                          setPickupPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-full sm:w-[110px]">
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
                  <div className="rounded-md border">
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[1200px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Main Collector</TableHead>
                            <TableHead>Entered By</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Mobile</TableHead>
                            <TableHead>Total Meals</TableHead>
                            <TableHead>Meals By Type</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pickupPagedOrders.map((order: any) => {
                            const totals = getOrderMealTotals(order);
                            const meals = [
                              { label: 'Chicken', value: totals.chicken },
                              { label: 'Fish', value: totals.fish },
                              { label: 'Veg', value: totals.veg },
                              { label: 'Egg', value: totals.egg },
                              { label: 'Other', value: totals.other },
                            ].filter((meal) => meal.value > 0);
                            const createdBy = order.createdBy;
                            const mainCollector =
                              createdBy?.mainCollector && createdBy.mainCollector.id !== createdBy.id
                                ? createdBy.mainCollector
                                : null;
                            return (
                              <TableRow key={order.id}>
                                <TableCell>{getName(mainCollector || createdBy)}</TableCell>
                                <TableCell>{getName(createdBy)}</TableCell>
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
                      <span>{pickupRangeLabel}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPickupPage((prev) => Math.max(1, prev - 1))}
                          disabled={collectorRowsPerPage === 'all' || pickupPage <= 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPickupPage((prev) => Math.min(pickupPageCount, prev + 1))}
                          disabled={collectorRowsPerPage === 'all' || pickupPage >= pickupPageCount}
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

        <TabsContent value="orders">
          <Card>
            <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>All Campaign Orders</CardTitle>
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Orders: {sortedOrders.length}
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
                <Select
                  value={systemUserFilter}
                  onValueChange={(value) => {
                    setSystemUserFilter(value);
                    setOrdersPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-[220px]">
                    <SelectValue placeholder="System user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All collectors</SelectItem>
                    {systemUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={mainUserFilter}
                  onValueChange={(value) => {
                    setMainUserFilter(value);
                    setOrdersPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-[220px]">
                    <SelectValue placeholder="Main user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All main collectors</SelectItem>
                    {mainUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              ) : sortedOrders.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No orders found for the selected filters.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span>Rows per page</span>
                        <Select
                          value={ordersRowsPerPage}
                          onValueChange={(value) => {
                            setOrdersRowsPerPage(value as '10' | '20' | '50' | '100' | 'all');
                            setOrdersPage(1);
                          }}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-[110px]">
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
                      <div className="flex items-center gap-2">
                        <span>Sort by</span>
                        <Select
                          value={`${ordersSortBy}:${ordersSortDir}`}
                          onValueChange={(value) => {
                            const [sortBy, sortDir] = value.split(':') as [
                              'created' | 'customer' | 'pickup',
                              'asc' | 'desc',
                            ];
                            setOrdersSortBy(sortBy);
                            setOrdersSortDir(sortDir);
                          }}
                        >
                          <SelectTrigger className="h-8 w-full sm:w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="start">
                            <SelectItem value="created:desc">Newest first</SelectItem>
                            <SelectItem value="created:asc">Oldest first</SelectItem>
                            <SelectItem value="customer:asc">Customer A–Z</SelectItem>
                            <SelectItem value="customer:desc">Customer Z–A</SelectItem>
                            <SelectItem value="pickup:asc">Pickup A–Z</SelectItem>
                            <SelectItem value="pickup:desc">Pickup Z–A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{ordersRangeLabel}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrdersPage((prev) => Math.max(1, prev - 1))}
                          disabled={ordersRowsPerPage === 'all' || ordersPage <= 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrdersPage((prev) => Math.min(ordersPageCount, prev + 1))}
                          disabled={ordersRowsPerPage === 'all' || ordersPage >= ordersPageCount}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="w-full overflow-x-auto">
                    <Table className="min-w-[1400px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Entered By</TableHead>
                          <TableHead>Main User</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Pickup Location</TableHead>
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
                          const createdBy = order.createdBy;
                          const mainCollector =
                            createdBy?.mainCollector && createdBy.mainCollector.id !== createdBy.id
                              ? createdBy.mainCollector
                              : null;
                          const pickupName =
                            locations.find((loc: any) => loc.id === order.pickupLocationId)?.name ||
                            '-';
                          return (
                            <TableRow key={order.id}>
                              <TableCell>{getName(createdBy)}</TableCell>
                              <TableCell>{getName(mainCollector)}</TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  className="text-left text-foreground underline-offset-4 hover:underline"
                                  onClick={() => setDetailOrder(order)}
                                >
                                  {getName(order.customer)}
                                </button>
                              </TableCell>
                              <TableCell>
                                {formatAuMobile(order.customer?.mobile || '') || '-'}
                              </TableCell>
                              <TableCell>{pickupName}</TableCell>
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
