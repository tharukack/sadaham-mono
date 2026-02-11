import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Plus, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '../lib/api';
import { AppShell } from '../components/layout/app-shell';
import { PageHeader } from '../components/page-header';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Separator } from '../components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

type Campaign = {
  id: string;
  name: string;
  state: string;
  startedAt?: string;
  frozenAt?: string | null;
  endedAt?: string | null;
};

type StatsCampaign = {
  campaign: Campaign;
  orders: {
    totalOrders: number;
    totalMeals: number;
    avgMealsPerOrder: number;
    medianMealsPerOrder: number;
    maxMealsInOrder: number;
    peakOrderDay: string | null;
    timeline: Array<{ date: string; orders: number }>;
  };
  meals: {
    totals: { chicken: number; fish: number; veg: number; egg: number; other: number };
  };
  pickupLocations: {
    rows: Array<{
      locationId: string;
      name: string;
      distributorName: string;
      orders: number;
      meals: number;
    }>;
    topOrders: Array<{
      locationId: string;
      name: string;
      distributorName: string;
      orders: number;
      meals: number;
    }>;
    topMeals: Array<{
      locationId: string;
      name: string;
      distributorName: string;
      orders: number;
      meals: number;
    }>;
  };
  sms: {
    total: number;
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
    failureRate: number;
    byType: { otp: number; orderConfirmation: number; bulk: number };
    timeline: Array<{ date: string; delivered: number; failed: number }>;
    failureReasons: Array<{ reason: string; count: number; sampleIds: string[] }>;
  };
  dataQuality: {
    missingPickup: number;
    missingAddress: number;
    invalidMeals: number;
    postFreezeEdits: number;
    duplicateMobiles: boolean;
  };
  compare: {
    durationDays: number;
    topMealType: string;
    topPickupLocation: string;
  };
};

type StatsResponse = {
  campaigns: StatsCampaign[];
  combined: {
    orders: StatsCampaign['orders'];
    meals: StatsCampaign['meals'];
    pickupLocations: StatsCampaign['pickupLocations'];
    sms: StatsCampaign['sms'];
  };
};

function formatDate(date?: string | null) {
  if (!date) return '-';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-AU').format(value || 0);
}

function SkeletonCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

export default function StatsPage() {
  const [currentRole, setCurrentRole] = useState<string>('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);

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

  const campaignsQuery = useQuery<Campaign[]>({
    queryKey: ['campaigns-all'],
    queryFn: async () => (await api.get('/campaigns')).data,
    enabled: currentRole === 'ADMIN',
  });

  const currentCampaignQuery = useQuery<Campaign | null>({
    queryKey: ['campaign-current'],
    queryFn: async () => (await api.get('/campaigns/current')).data,
    enabled: currentRole === 'ADMIN',
  });

  const lastEndedQuery = useQuery<Campaign | null>({
    queryKey: ['campaign-last-ended'],
    queryFn: async () => (await api.get('/campaigns/last-ended')).data,
    enabled: currentRole === 'ADMIN' && currentCampaignQuery.isFetched && !currentCampaignQuery.data,
  });

  useEffect(() => {
    if (selectedIds.length > 0 || appliedIds.length > 0) return;
    const defaultCampaign = currentCampaignQuery.data || lastEndedQuery.data;
    if (!defaultCampaign?.id) return;
    setSelectedIds([defaultCampaign.id]);
    setAppliedIds([defaultCampaign.id]);
  }, [selectedIds.length, appliedIds.length, currentCampaignQuery.data, lastEndedQuery.data]);

  const statsQuery = useQuery<StatsResponse>({
    queryKey: ['stats-campaigns', appliedIds],
    queryFn: async () => (await api.post('/stats/campaigns', { campaignIds: appliedIds })).data,
    enabled: currentRole === 'ADMIN' && appliedIds.length > 0,
  });

  const isAdmin = currentRole === 'ADMIN';
  const campaigns = campaignsQuery.data || [];
  const stats = statsQuery.data;
  const combined = stats?.combined;

  const selectedCampaigns = useMemo(
    () => campaigns.filter((campaign) => selectedIds.includes(campaign.id)),
    [campaigns, selectedIds],
  );

  const combinedMealTotals = combined?.meals?.totals || {
    chicken: 0,
    fish: 0,
    veg: 0,
    egg: 0,
    other: 0,
  };

  const totalCombinedMeals =
    combinedMealTotals.chicken +
    combinedMealTotals.fish +
    combinedMealTotals.veg +
    combinedMealTotals.egg +
    combinedMealTotals.other;

  const ordersPerCampaignChart = useMemo(() => {
    return (stats?.campaigns || []).map((campaignStat) => ({
      name: campaignStat.campaign.name,
      orders: campaignStat.orders.totalOrders,
      avgMeals: Number(campaignStat.orders.avgMealsPerOrder.toFixed(2)),
      medianMeals: Number(campaignStat.orders.medianMealsPerOrder.toFixed(2)),
      maxMeals: campaignStat.orders.maxMealsInOrder,
      deliveryRate: Number((campaignStat.sms.deliveryRate * 100).toFixed(1)),
      totalMeals: campaignStat.orders.totalMeals,
    }));
  }, [stats?.campaigns]);

  const ordersTimelineCombined = combined?.orders.timeline || [];
  const smsTimelineCombined = combined?.sms.timeline || [];

  const compareChartData = useMemo(() => {
    return (stats?.campaigns || []).map((campaignStat) => ({
      name: campaignStat.campaign.name,
      orders: campaignStat.orders.totalOrders,
      meals: campaignStat.orders.totalMeals,
      deliveryRate: Number((campaignStat.sms.deliveryRate * 100).toFixed(1)),
      avgMeals: Number(campaignStat.orders.avgMealsPerOrder.toFixed(2)),
    }));
  }, [stats?.campaigns]);

  const mealStackedData = useMemo(() => {
    return (stats?.campaigns || []).map((campaignStat) => ({
      name: campaignStat.campaign.name,
      chicken: campaignStat.meals.totals.chicken,
      fish: campaignStat.meals.totals.fish,
      veg: campaignStat.meals.totals.veg,
      egg: campaignStat.meals.totals.egg,
      other: campaignStat.meals.totals.other,
    }));
  }, [stats?.campaigns]);

  const mealShareData = useMemo(() => {
    return (stats?.campaigns || []).map((campaignStat) => {
      const total =
        campaignStat.meals.totals.chicken +
        campaignStat.meals.totals.fish +
        campaignStat.meals.totals.veg +
        campaignStat.meals.totals.egg +
        campaignStat.meals.totals.other;
      return {
        name: campaignStat.campaign.name,
        chicken: total ? (campaignStat.meals.totals.chicken / total) * 100 : 0,
        fish: total ? (campaignStat.meals.totals.fish / total) * 100 : 0,
        veg: total ? (campaignStat.meals.totals.veg / total) * 100 : 0,
        egg: total ? (campaignStat.meals.totals.egg / total) * 100 : 0,
        other: total ? (campaignStat.meals.totals.other / total) * 100 : 0,
      };
    });
  }, [stats?.campaigns]);

  const pickupTopCombined = combined?.pickupLocations.topOrders || [];
  const pickupTopChart = pickupTopCombined.slice(0, 10).map((row) => ({
    name: row.name,
    orders: row.orders,
  }));

  const smsFailureReasons = combined?.sms.failureReasons || [];

  const isLoadingStats = statsQuery.isLoading || statsQuery.isFetching;

  const defaultSelectionLabel = currentCampaignQuery.data
    ? 'Active campaign'
    : lastEndedQuery.data
    ? 'Last ended campaign'
    : '';

  const selectionLabel = selectedIds.length
    ? `${selectedIds.length} campaign${selectedIds.length === 1 ? '' : 's'} selected`
    : 'Select campaigns';

  return (
    <AppShell title="Stats">
      <PageHeader title="Stats" description="Admin analytics across campaigns" />
      {!isAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Stats are restricted to administrators.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {selectionLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search campaigns..." />
                      <CommandList>
                        <CommandEmpty>No campaigns found.</CommandEmpty>
                        <CommandGroup>
                          {(campaigns || []).map((campaign) => {
                            const isSelected = selectedIds.includes(campaign.id);
                            return (
                              <CommandItem
                                key={campaign.id}
                                onSelect={() => {
                                  setSelectedIds((prev) =>
                                    prev.includes(campaign.id)
                                      ? prev.filter((id) => id !== campaign.id)
                                      : [...prev, campaign.id],
                                  );
                                }}
                              >
                                <div className="flex flex-1 items-center justify-between">
                                  <span>{campaign.name}</span>
                                  {isSelected ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const endedIds = campaigns.filter((c) => c.state === 'ENDED').map((c) => c.id);
                    setSelectedIds(endedIds);
                  }}
                >
                  Select All Ended
                </Button>
                <Button variant="ghost" onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
                <Button
                  onClick={() => setAppliedIds(Array.from(new Set(selectedIds)).sort())}
                  disabled={selectedIds.length === 0}
                >
                  Apply
                </Button>
                {defaultSelectionLabel ? <Badge variant="secondary">{defaultSelectionLabel}</Badge> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedCampaigns.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Choose one or more campaigns to load stats.
                  </span>
                ) : (
                  selectedCampaigns.map((campaign) => (
                    <Badge key={campaign.id} variant="outline" className="flex items-center gap-2">
                      {campaign.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== campaign.id))}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </Badge>
                  ))
                )}
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground">
                {appliedIds.length === 0
                  ? 'Apply to fetch stats.'
                  : `Showing stats for ${appliedIds.length} campaign${
                      appliedIds.length === 1 ? '' : 's'
                    }.`}
              </div>
            </CardContent>
          </Card>

          {statsQuery.isError ? (
            <Card>
              <CardContent className="p-6 text-sm text-destructive">
                Failed to load stats. Please try again.
              </CardContent>
            </Card>
          ) : appliedIds.length === 0 ? null : (
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="meals">Meals</TabsTrigger>
                <TabsTrigger value="pickup">Pickup Locations</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
                <TabsTrigger value="compare">Compare Campaigns</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {isLoadingStats ? (
                    <>
                      <SkeletonCard title="Campaigns Selected" />
                      <SkeletonCard title="Total Orders" />
                      <SkeletonCard title="Total Meals" />
                      <SkeletonCard title="Avg Meals / Order" />
                      <SkeletonCard title="Peak Order Day" />
                      <SkeletonCard title="SMS Delivery Rate" />
                      <SkeletonCard title="SMS Failed" />
                    </>
                  ) : (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Campaigns Selected</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                          {formatNumber(stats?.campaigns.length || 0)}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Total Orders</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                          {formatNumber(combined?.orders.totalOrders || 0)}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Total Meals</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                          {formatNumber(combined?.orders.totalMeals || 0)}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Avg Meals / Order</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                          {combined?.orders.avgMealsPerOrder.toFixed(2)}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Peak Order Day</CardTitle>
                        </CardHeader>
                        <CardContent className="text-lg font-semibold">
                          {combined?.orders.peakOrderDay || '-'}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">SMS Delivery Rate</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                          {formatPercent(combined?.sms.deliveryRate || 0)}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">SMS Failed</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                          {formatNumber(combined?.sms.failed || 0)}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">Orders Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {ordersTimelineCombined.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No data.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={ordersTimelineCombined}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="orders" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">SMS Delivered vs Failed</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {smsTimelineCombined.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No data.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={smsTimelineCombined}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="delivered" strokeWidth={2} stroke="#16a34a" />
                            <Line type="monotone" dataKey="failed" strokeWidth={2} stroke="#dc2626" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Selected Campaigns Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Date Range</TableHead>
                          <TableHead>Total Orders</TableHead>
                          <TableHead>Total Meals</TableHead>
                          <TableHead>Delivery Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(stats?.campaigns || []).map((campaignStat) => (
                          <TableRow key={campaignStat.campaign.id}>
                            <TableCell className="font-medium">{campaignStat.campaign.name}</TableCell>
                            <TableCell>{campaignStat.campaign.state}</TableCell>
                            <TableCell>
                              {formatDate(campaignStat.campaign.startedAt)} -{' '}
                              {formatDate(campaignStat.campaign.endedAt)}
                            </TableCell>
                            <TableCell>{formatNumber(campaignStat.orders.totalOrders)}</TableCell>
                            <TableCell>{formatNumber(campaignStat.orders.totalMeals)}</TableCell>
                            <TableCell>{formatPercent(campaignStat.sms.deliveryRate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="orders" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">Total Orders Per Campaign</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {ordersPerCampaignChart.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No data.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ordersPerCampaignChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="orders" fill="hsl(var(--primary))" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">Orders Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {ordersTimelineCombined.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No data.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={ordersTimelineCombined}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="orders" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Campaign Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Total Orders</TableHead>
                          <TableHead>Avg Meals / Order</TableHead>
                          <TableHead>Median Meals / Order</TableHead>
                          <TableHead>Max Meals / Order</TableHead>
                          <TableHead>Peak Day</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(stats?.campaigns || []).map((campaignStat) => (
                          <TableRow key={campaignStat.campaign.id}>
                            <TableCell className="font-medium">{campaignStat.campaign.name}</TableCell>
                            <TableCell>{formatNumber(campaignStat.orders.totalOrders)}</TableCell>
                            <TableCell>{campaignStat.orders.avgMealsPerOrder.toFixed(2)}</TableCell>
                            <TableCell>{campaignStat.orders.medianMealsPerOrder.toFixed(2)}</TableCell>
                            <TableCell>{campaignStat.orders.maxMealsInOrder}</TableCell>
                            <TableCell>{campaignStat.orders.peakOrderDay || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="meals" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">Total Meals by Type</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {mealStackedData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No data.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={mealStackedData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="chicken" stackId="meals" fill="#f97316" />
                            <Bar dataKey="fish" stackId="meals" fill="#0ea5e9" />
                            <Bar dataKey="veg" stackId="meals" fill="#22c55e" />
                            <Bar dataKey="egg" stackId="meals" fill="#eab308" />
                            <Bar dataKey="other" stackId="meals" fill="#a855f7" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">Meal Share by Type</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {mealShareData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No data.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={mealShareData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} domain={[0, 100]} />
                            <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                            <Legend />
                            <Bar dataKey="chicken" stackId="share" fill="#f97316" />
                            <Bar dataKey="fish" stackId="share" fill="#0ea5e9" />
                            <Bar dataKey="veg" stackId="share" fill="#22c55e" />
                            <Bar dataKey="egg" stackId="share" fill="#eab308" />
                            <Bar dataKey="other" stackId="share" fill="#a855f7" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Combined Meal Totals</CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'Chicken', value: combinedMealTotals.chicken },
                          { name: 'Fish', value: combinedMealTotals.fish },
                          { name: 'Veg', value: combinedMealTotals.veg },
                          { name: 'Egg', value: combinedMealTotals.egg },
                          { name: 'Other', value: combinedMealTotals.other },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Combined Meal Share</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Meal Type</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Share</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { label: 'Chicken', value: combinedMealTotals.chicken },
                          { label: 'Fish', value: combinedMealTotals.fish },
                          { label: 'Veg', value: combinedMealTotals.veg },
                          { label: 'Egg', value: combinedMealTotals.egg },
                          { label: 'Other', value: combinedMealTotals.other },
                        ].map((row) => {
                          const share = totalCombinedMeals ? row.value / totalCombinedMeals : 0;
                          return (
                            <TableRow key={row.label}>
                              <TableCell className="font-medium">{row.label}</TableCell>
                              <TableCell>{formatNumber(row.value)}</TableCell>
                              <TableCell>{formatPercent(share)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Meal Totals per Campaign</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Chicken</TableHead>
                          <TableHead>Fish</TableHead>
                          <TableHead>Veg</TableHead>
                          <TableHead>Egg</TableHead>
                          <TableHead>Other</TableHead>
                          <TableHead>Total Meals</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(stats?.campaigns || []).map((campaignStat) => {
                          const totals = campaignStat.meals.totals;
                          const total = totals.chicken + totals.fish + totals.veg + totals.egg + totals.other;
                          return (
                            <TableRow key={campaignStat.campaign.id}>
                              <TableCell className="font-medium">{campaignStat.campaign.name}</TableCell>
                              <TableCell>{formatNumber(totals.chicken)}</TableCell>
                              <TableCell>{formatNumber(totals.fish)}</TableCell>
                              <TableCell>{formatNumber(totals.veg)}</TableCell>
                              <TableCell>{formatNumber(totals.egg)}</TableCell>
                              <TableCell>{formatNumber(totals.other)}</TableCell>
                              <TableCell>{formatNumber(total)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pickup" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Top Pickup Locations (Orders)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {pickupTopChart.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No data.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={pickupTopChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="orders" fill="hsl(var(--primary))" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Top Pickup Locations (Meals)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(combined?.pickupLocations.topMeals || []).slice(0, 5).map((row) => (
                          <div key={row.locationId} className="flex items-center justify-between text-sm">
                            <span>{row.name}</span>
                            <span className="font-medium">{formatNumber(row.meals)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pickup Location Summary (Combined)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Location</TableHead>
                          <TableHead>Distributor</TableHead>
                          <TableHead>Orders</TableHead>
                          <TableHead>Meals</TableHead>
                          <TableHead>% of Orders</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(combined?.pickupLocations.rows || []).map((row) => {
                          const share = combined?.orders.totalOrders
                            ? row.orders / combined.orders.totalOrders
                            : 0;
                          return (
                            <TableRow key={row.locationId}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell>{row.distributorName}</TableCell>
                              <TableCell>{formatNumber(row.orders)}</TableCell>
                              <TableCell>{formatNumber(row.meals)}</TableCell>
                              <TableCell>{formatPercent(share)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sms" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Total Messages</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {formatNumber(combined?.sms.total || 0)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Delivered</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {formatNumber(combined?.sms.delivered || 0)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Failed</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {formatNumber(combined?.sms.failed || 0)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Delivery Rate</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {formatPercent(combined?.sms.deliveryRate || 0)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Failure Rate</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {formatPercent(combined?.sms.failureRate || 0)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">OTP</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {formatNumber(combined?.sms.byType.otp || 0)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Order Confirmation</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {formatNumber(combined?.sms.byType.orderConfirmation || 0)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Bulk</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      {formatNumber(combined?.sms.byType.bulk || 0)}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">Delivered vs Failed by Campaign</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {ordersPerCampaignChart.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No data.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={(stats?.campaigns || []).map((campaignStat) => ({
                              name: campaignStat.campaign.name,
                              delivered: campaignStat.sms.delivered,
                              failed: campaignStat.sms.failed,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="delivered" fill="#16a34a" />
                            <Bar dataKey="failed" fill="#dc2626" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">SMS Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      {smsTimelineCombined.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No data.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={smsTimelineCombined}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="delivered" strokeWidth={2} stroke="#16a34a" />
                            <Line type="monotone" dataKey="failed" strokeWidth={2} stroke="#dc2626" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Top Failure Reasons</CardTitle>
                    </CardHeader>
                    <CardContent className="h-72">
                      {smsFailureReasons.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No failures recorded.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={smsFailureReasons.slice(0, 6).map((reason) => ({
                              reason: reason.reason,
                              count: reason.count,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="reason" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="hsl(var(--primary))" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">SMS Summary per Campaign</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Delivered</TableHead>
                            <TableHead>Failed</TableHead>
                            <TableHead>Delivery Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(stats?.campaigns || []).map((campaignStat) => (
                            <TableRow key={campaignStat.campaign.id}>
                              <TableCell className="font-medium">{campaignStat.campaign.name}</TableCell>
                              <TableCell>{formatNumber(campaignStat.sms.total)}</TableCell>
                              <TableCell>{formatNumber(campaignStat.sms.delivered)}</TableCell>
                              <TableCell>{formatNumber(campaignStat.sms.failed)}</TableCell>
                              <TableCell>{formatPercent(campaignStat.sms.deliveryRate)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Failure Reasons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reason</TableHead>
                          <TableHead>Count</TableHead>
                          <TableHead>Sample IDs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {smsFailureReasons.map((reason) => (
                          <TableRow key={reason.reason}>
                            <TableCell className="font-medium">{reason.reason}</TableCell>
                            <TableCell>{formatNumber(reason.count)}</TableCell>
                            <TableCell>{reason.sampleIds.join(', ') || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compare" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Campaign Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Duration (Days)</TableHead>
                          <TableHead>Total Orders</TableHead>
                          <TableHead>Total Meals</TableHead>
                          <TableHead>Avg Meals / Order</TableHead>
                          <TableHead>Top Meal Type</TableHead>
                          <TableHead>Top Pickup Location</TableHead>
                          <TableHead>SMS Delivery Rate</TableHead>
                          <TableHead>SMS Failed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(stats?.campaigns || []).map((campaignStat) => (
                          <TableRow key={campaignStat.campaign.id}>
                            <TableCell className="font-medium">{campaignStat.campaign.name}</TableCell>
                            <TableCell>{campaignStat.compare.durationDays}</TableCell>
                            <TableCell>{formatNumber(campaignStat.orders.totalOrders)}</TableCell>
                            <TableCell>{formatNumber(campaignStat.orders.totalMeals)}</TableCell>
                            <TableCell>{campaignStat.orders.avgMealsPerOrder.toFixed(2)}</TableCell>
                            <TableCell>{campaignStat.compare.topMealType}</TableCell>
                            <TableCell>{campaignStat.compare.topPickupLocation}</TableCell>
                            <TableCell>{formatPercent(campaignStat.sms.deliveryRate)}</TableCell>
                            <TableCell>{formatNumber(campaignStat.sms.failed)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Comparison Chart</CardTitle>
                  </CardHeader>
                  <CardContent className="h-96">
                    {compareChartData.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No data.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={compareChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="orders" fill="#0ea5e9" />
                          <Bar dataKey="meals" fill="#22c55e" />
                          <Bar dataKey="deliveryRate" fill="#f97316" />
                          <Bar dataKey="avgMeals" fill="#a855f7" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </AppShell>
  );
}

