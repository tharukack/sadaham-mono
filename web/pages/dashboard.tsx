import Link from 'next/link';
import { useRouter } from 'next/router';
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
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
import { Pencil, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { OrderDetailsModal } from '../components/order-details-modal';
import { KpiCards } from '../components/dashboard/kpi-cards';
import { OrdersTrendChart } from '../components/dashboard/orders-trend-chart';
import { MealTotalsChart } from '../components/dashboard/meal-totals-chart';
import { PickupLocationsTable } from '../components/dashboard/pickup-locations-table';
import { SmsSummary } from '../components/dashboard/sms-summary';
import { formatAuMobile } from '../lib/phone';

type Campaign = {
  id: string;
  name: string;
  state: string;
  startedAt?: string;
  frozenAt?: string | null;
  endedAt?: string | null;
  chickenCost?: number;
  fishCost?: number;
  vegCost?: number;
  eggCost?: number;
  otherCost?: number;
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
  const router = useRouter();
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

  useEffect(() => {
    if (!router.isReady) return;
    const addOrder = router.query.addOrder;
    if (addOrder === '1' || addOrder === 'true') {
      setShowAddModal(true);
      const { addOrder: _addOrder, ...rest } = router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
  }, [router.isReady, router.query, router]);

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

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [pickupByLabel, setPickupByLabel] = useState('');
  const [editPickupByLabel, setEditPickupByLabel] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [addExistingOrderId, setAddExistingOrderId] = useState<string | null>(null);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addPickupByOpen, setAddPickupByOpen] = useState(false);
  const [editPickupByOpen, setEditPickupByOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersRowsPerPage, setOrdersRowsPerPage] = useState(10);
  const [ordersSortBy, setOrdersSortBy] = useState<'created' | 'updated' | 'name'>('updated');
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [addOriginalForm, setAddOriginalForm] = useState({
    pickupLocationId: '',
    pickupByCustomerId: '',
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
    note: '',
  });
  const [editOriginalForm, setEditOriginalForm] = useState({
    pickupLocationId: '',
    pickupByCustomerId: '',
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
    note: '',
  });
  const [orderForm, setOrderForm] = useState({
    pickupLocationId: '',
    pickupByCustomerId: '',
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
    note: '',
  });
  const [editForm, setEditForm] = useState({
    pickupLocationId: '',
    pickupByCustomerId: '',
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
    note: '',
  });

  const allCustomersQuery = useQuery({
    queryKey: ['customers-all', selectedCampaign?.id],
    queryFn: async () => (await api.get('/customers/search', { params: { q: '' } })).data,
    enabled:
      !!selectedCampaign?.id &&
      (showAddModal || showEditModal || addCustomerOpen || addPickupByOpen || editPickupByOpen),
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
  const activeOrders = useMemo(() => orders.filter((order: any) => !order.deletedAt), [orders]);

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
    return Math.max(1, Math.ceil(orders.length / ordersRowsPerPage));
  }, [orders.length, ordersRowsPerPage]);

  const pagedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersRowsPerPage;
    return sortedOrders.slice(start, start + ordersRowsPerPage);
  }, [sortedOrders, ordersPage, ordersRowsPerPage]);

  useEffect(() => {
    setOrdersPage(1);
  }, [selectedCampaign?.id, ordersSortBy]);

  useEffect(() => {
    setOrdersPage((prev) => Math.min(Math.max(prev, 1), ordersPageCount));
  }, [ordersPageCount]);

  const selectedCustomer = useMemo(() => {
    return (allCustomersQuery.data || []).find((c: any) => c.id === selectedCustomerId);
  }, [allCustomersQuery.data, selectedCustomerId]);

  const existingOrderForCustomer = useMemo(() => {
    if (!selectedCampaign?.id || !selectedCustomerId) return null;
    return orders.find((order: any) => order.customerId === selectedCustomerId) || null;
  }, [orders, selectedCampaign?.id, selectedCustomerId]);

  const canCreateOrders =
    !!currentCampaignQuery.data &&
    ((currentCampaignQuery.data.state === 'STARTED' && (isAdmin || isEditor)) ||
      (currentCampaignQuery.data.state === 'FROZEN' && isAdmin));
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
      pickupByCustomerId: orderForm.pickupByCustomerId || '',
      chickenQty: Number(orderForm.chickenQty || 0),
      fishQty: Number(orderForm.fishQty || 0),
      vegQty: Number(orderForm.vegQty || 0),
      eggQty: Number(orderForm.eggQty || 0),
      otherQty: Number(orderForm.otherQty || 0),
      note: orderForm.note || '',
    };
    const original = {
      pickupLocationId: addOriginalForm.pickupLocationId || '',
      pickupByCustomerId: addOriginalForm.pickupByCustomerId || '',
      chickenQty: Number(addOriginalForm.chickenQty || 0),
      fishQty: Number(addOriginalForm.fishQty || 0),
      vegQty: Number(addOriginalForm.vegQty || 0),
      eggQty: Number(addOriginalForm.eggQty || 0),
      otherQty: Number(addOriginalForm.otherQty || 0),
      note: addOriginalForm.note || '',
    };
    return JSON.stringify(current) !== JSON.stringify(original);
  }, [orderForm, addOriginalForm]);

  const isEditFormDirty = useMemo(() => {
    const current = {
      pickupLocationId: editForm.pickupLocationId || '',
      pickupByCustomerId: editForm.pickupByCustomerId || '',
      chickenQty: Number(editForm.chickenQty || 0),
      fishQty: Number(editForm.fishQty || 0),
      vegQty: Number(editForm.vegQty || 0),
      eggQty: Number(editForm.eggQty || 0),
      otherQty: Number(editForm.otherQty || 0),
      note: editForm.note || '',
    };
    const original = {
      pickupLocationId: editOriginalForm.pickupLocationId || '',
      pickupByCustomerId: editOriginalForm.pickupByCustomerId || '',
      chickenQty: Number(editOriginalForm.chickenQty || 0),
      fishQty: Number(editOriginalForm.fishQty || 0),
      vegQty: Number(editOriginalForm.vegQty || 0),
      eggQty: Number(editOriginalForm.eggQty || 0),
      otherQty: Number(editOriginalForm.otherQty || 0),
      note: editOriginalForm.note || '',
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
    const chickenCost = selectedCampaign?.chickenCost || 0;
    const fishCost = selectedCampaign?.fishCost || 0;
    const vegCost = selectedCampaign?.vegCost || 0;
    const eggCost = selectedCampaign?.eggCost || 0;
    const otherCost = selectedCampaign?.otherCost || 0;
    return (
      Number(order.chickenQty || 0) * chickenCost +
      Number(order.fishQty || 0) * fishCost +
      Number(order.vegQty || 0) * vegCost +
      Number(order.eggQty || 0) * eggCost +
      Number(order.otherQty || 0) * otherCost
    );
  };



  useEffect(() => {
    if (!selectedCustomerId) {
      setAddExistingOrderId(null);
      setAddOriginalForm({
        pickupLocationId: '',
        pickupByCustomerId: '',
        chickenQty: 0,
        fishQty: 0,
        vegQty: 0,
        eggQty: 0,
        otherQty: 0,
        note: '',
      });
      return;
    }
    if (existingOrderForCustomer) {
      const base = {
        pickupLocationId: existingOrderForCustomer.pickupLocationId || '',
        pickupByCustomerId:
          existingOrderForCustomer.pickupByCustomerId || existingOrderForCustomer.customerId || '',
        chickenQty: existingOrderForCustomer.chickenQty || 0,
        fishQty: existingOrderForCustomer.fishQty || 0,
        vegQty: existingOrderForCustomer.vegQty || 0,
        eggQty: existingOrderForCustomer.eggQty || 0,
        otherQty: existingOrderForCustomer.otherQty || 0,
        note: existingOrderForCustomer.note || '',
      };
      setAddExistingOrderId(existingOrderForCustomer.id);
      setAddOriginalForm(base);
      setOrderForm(base);
      setPickupByLabel(
        existingOrderForCustomer.pickupByCustomer
          ? `${existingOrderForCustomer.pickupByCustomer.firstName} ${existingOrderForCustomer.pickupByCustomer.lastName}`.trim()
          : `${existingOrderForCustomer.customer?.firstName || ''} ${existingOrderForCustomer.customer?.lastName || ''}`.trim()
      );
    } else {
      const empty = {
        pickupLocationId: '',
        pickupByCustomerId: selectedCustomerId || '',
        chickenQty: 0,
        fishQty: 0,
        vegQty: 0,
        eggQty: 0,
        otherQty: 0,
        note: '',
      };
      setAddExistingOrderId(null);
      setAddOriginalForm(empty);
      setOrderForm(empty);
      setPickupByLabel('');
    }
  }, [selectedCustomerId, existingOrderForCustomer]);

  const startEdit = (order: any) => {
    setEditingOrderId(order.id);
    setShowEditModal(true);
    setEditPickupByLabel(
      order.pickupByCustomer
        ? `${order.pickupByCustomer.firstName} ${order.pickupByCustomer.lastName}`.trim()
        : `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim()
    );
    const base = {
      pickupLocationId: order.pickupLocationId || '',
      pickupByCustomerId: order.pickupByCustomerId || order.customerId || '',
      chickenQty: order.chickenQty || 0,
      fishQty: order.fishQty || 0,
      vegQty: order.vegQty || 0,
      eggQty: order.eggQty || 0,
      otherQty: order.otherQty || 0,
      note: order.note || '',
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
        pickupByCustomerId: orderForm.pickupByCustomerId || selectedCustomerId,
        chickenQty: Number(orderForm.chickenQty || 0),
        fishQty: Number(orderForm.fishQty || 0),
        vegQty: Number(orderForm.vegQty || 0),
        eggQty: Number(orderForm.eggQty || 0),
        otherQty: Number(orderForm.otherQty || 0),
        note: orderForm.note || undefined,
      };
      let response;
      if (addExistingOrderId) {
        response = await api.patch(`/orders/${addExistingOrderId}`, payload);
      } else {
        response = await api.post('/orders', payload);
      }
      setSelectedCustomerId('');
      setPickupByLabel('');
      setPickupByLabel('');
      setOrderForm({
        pickupLocationId: '',
        pickupByCustomerId: '',
        chickenQty: 0,
        fishQty: 0,
        vegQty: 0,
        eggQty: 0,
        otherQty: 0,
        note: '',
      });
      setAddExistingOrderId(null);
      setAddOriginalForm({
        pickupLocationId: '',
        pickupByCustomerId: '',
        chickenQty: 0,
        fishQty: 0,
        vegQty: 0,
        eggQty: 0,
        otherQty: 0,
        note: '',
      });
      await ordersQuery.refetch();
      await statsQuery.refetch();
      setShowAddModal(false);
      toast({ title: addExistingOrderId ? 'Order updated' : 'Order created' });
      if (response?.data?.smsError) {
        toast({
          variant: 'destructive',
          title: 'SMS error',
          description: response.data.smsError,
        });
      }
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
      const response = await api.patch(`/orders/${editingOrderId}`, {
        pickupLocationId: editForm.pickupLocationId,
        pickupByCustomerId: editForm.pickupByCustomerId || undefined,
        chickenQty: Number(editForm.chickenQty || 0),
        fishQty: Number(editForm.fishQty || 0),
        vegQty: Number(editForm.vegQty || 0),
        eggQty: Number(editForm.eggQty || 0),
        otherQty: Number(editForm.otherQty || 0),
        note: editForm.note || undefined,
      });
      setEditingOrderId(null);
      setShowEditModal(false);
      setEditPickupByLabel('');
      await ordersQuery.refetch();
      await statsQuery.refetch();
      toast({ title: 'Order updated' });
      if (response?.data?.smsError) {
        toast({
          variant: 'destructive',
          title: 'SMS error',
          description: response.data.smsError,
        });
      }
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
          <Button
            variant="outline"
            className="h-auto w-full justify-between text-left whitespace-normal break-words"
            disabled={disabled}
          >
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

  const CustomerPicker = ({
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
    const [searchTerm, setSearchTerm] = useState('');
    const selected = (allCustomersQuery.data || []).find((c: any) => c.id === value) || selectedCustomer;
    const isMobileSearch = !!searchTerm.trim() && /\d/.test(searchTerm);

    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-auto w-full justify-between text-left whitespace-normal break-words"
            disabled={disabled}
          >
            {selected ? `${selected.firstName} ${selected.lastName}`.trim() : 'Select customer'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search by name or mobile"
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {allCustomersQuery.isLoading ? (
                <CommandEmpty>Loading customers...</CommandEmpty>
              ) : (allCustomersQuery.data || []).length === 0 ? (
                <CommandEmpty>No customers found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {(allCustomersQuery.data || []).map((c: any) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.firstName} ${c.lastName} ${formatAuMobile(c.mobile || '')}`}
                      onSelect={() => {
                        onChange(c.id);
                        onOpenChange(false);
                      }}
                    >
                      <div className="text-left">
                        <div
                          className={
                            isMobileSearch ? 'text-xs text-muted-foreground' : 'text-sm font-medium'
                          }
                        >
                          {c.firstName} {c.lastName}
                        </div>
                        <div
                          className={
                            isMobileSearch ? 'text-sm font-medium' : 'text-xs text-muted-foreground'
                          }
                        >
                          {formatAuMobile(c.mobile || '')}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const PickupByPicker = ({
    value: _value,
    onChange,
    disabled,
    open,
    onOpenChange,
    label,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    label?: string;
  }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const isMobileSearch = !!searchTerm.trim() && /\d/.test(searchTerm);

    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-auto w-full justify-between text-left whitespace-normal break-words"
            disabled={disabled}
          >
            {label || 'Select pickup person'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search pickup person by name or mobile"
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {allCustomersQuery.isLoading ? (
                <CommandEmpty>Loading customers...</CommandEmpty>
              ) : (allCustomersQuery.data || []).length === 0 ? (
                <CommandEmpty>No customers found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {(allCustomersQuery.data || []).map((c: any) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.firstName} ${c.lastName} ${formatAuMobile(c.mobile || '')}`}
                      onSelect={() => {
                        onChange(c.id);
                        setPickupByLabel(`${c.firstName} ${c.lastName}`.trim());
                        setEditPickupByLabel(`${c.firstName} ${c.lastName}`.trim());
                        onOpenChange(false);
                      }}
                    >
                      <div className="text-left">
                        <div
                          className={
                            isMobileSearch ? 'text-xs text-muted-foreground' : 'text-sm font-medium'
                          }
                        >
                          {c.firstName} {c.lastName}
                        </div>
                        <div
                          className={
                            isMobileSearch ? 'text-sm font-medium' : 'text-xs text-muted-foreground'
                          }
                        >
                          {formatAuMobile(c.mobile || '')}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
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
        <CardContent className="p-6">
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-lg font-semibold">{selectedCampaign.name}</div>
                  <Badge variant="secondary">{selectedCampaign.state}</Badge>
                  <Badge variant="outline">All Orders: {orders.length}</Badge>
                  <Badge variant="outline">Active Orders: {activeOrders.length}</Badge>
                  {isFallback && (
                    <span className="text-sm text-muted-foreground">
                      Showing last ended campaign
                    </span>
                  )}
                </div>
                {canCreateOrders && (
                  <Button onClick={() => setShowAddModal(true)}>Add Order</Button>
                )}
              </div>
              <Separator />
              <div className="space-y-3">
                {ordersQuery.isLoading ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Loading orders...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No orders in this campaign.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-full overflow-x-auto">
                    <Table className="min-w-[1100px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                    <TableHeader>
                      <TableRow className="whitespace-nowrap">
                        <TableHead className="sticky left-0 z-10 bg-background">
                          Customer
                        </TableHead>
                        <TableHead>Pickup Location</TableHead>
                        <TableHead>Pickup By</TableHead>
                        <TableHead>Meal Packets</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedOrders.map((order: any) => {
                        const mealDetails = getMealDetails(order);
                        const isDeleted = !!order.deletedAt;
                        return (
                          <TableRow key={order.id} className="whitespace-nowrap">
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
                                <span className="text-sm font-medium">
                                  Total: {mealDetails.total}
                                </span>
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
                                <Badge variant="destructive">Deleted</Badge>
                              ) : (
                                <Badge variant="outline">Active</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isDeleted ? (
                                canEditOrders ? (
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    className="h-7 w-7"
                                    onClick={() => restoreOrder(order.id)}
                                    aria-label="Restore order"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Deleted</span>
                                )
                              ) : canEditOrders ? (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    className="h-7 w-7"
                                    onClick={() => startEdit(order)}
                                    aria-label="Edit order"
                                  >
                                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="destructive"
                                    className="h-7 w-7"
                                    onClick={() => deleteOrder(order.id)}
                                    disabled={!canDeleteOrders}
                                    aria-label="Delete order"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                            <SelectTrigger className="h-8 w-full sm:w-[170px]">
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
                          <SelectTrigger className="h-8 w-full sm:w-[90px]">
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
                          {orders.length === 0
                            ? '0 of 0'
                            : `${(ordersPage - 1) * ordersRowsPerPage + 1}-${Math.min(
                                ordersPage * ordersRowsPerPage,
                                orders.length
                              )} of ${orders.length}`}
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
        <DialogContent className="w-[80vw] max-w-[80vw] max-h-[80vh] overflow-y-auto sm:w-[75vw] sm:max-w-4xl md:w-[70vw] md:max-w-4xl lg:w-[60vw] lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitOrder} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                <div className="flex min-h-[32px] items-center justify-between gap-2 border-b pb-2">
                  <div className="text-sm font-semibold">Find Customer</div>
                  {canCreateOrders ? (
                    <Button
                      size="icon"
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      asChild
                    >
                      <Link href="/customers/search" aria-label="Add customer">
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      disabled
                      aria-label="Add customer"
                    >
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <CustomerPicker
                    value={selectedCustomerId}
                    onChange={(value) => {
                      setSelectedCustomerId(value);
                      setOrderForm((prev) => ({
                        ...prev,
                        pickupByCustomerId: prev.pickupByCustomerId || value,
                      }));
                    }}
                    disabled={!canCreateOrders}
                    open={addCustomerOpen}
                    onOpenChange={setAddCustomerOpen}
                  />
                </div>
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
              </div>
              <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                <div className="flex min-h-[32px] items-center justify-between gap-2 border-b pb-2">
                  <div className="text-sm font-semibold">Order Pickup By</div>
                  <span className="invisible inline-flex h-8 w-8" aria-hidden="true" />
                </div>
                <PickupByPicker
                  value={orderForm.pickupByCustomerId}
                  onChange={(value) => setOrderForm({ ...orderForm, pickupByCustomerId: value })}
                  disabled={!canCreateOrders}
                  open={addPickupByOpen}
                  onOpenChange={setAddPickupByOpen}
                  label={pickupByLabel || 'Select pickup person'}
                />
                <div className="text-sm text-muted-foreground">
                  Pickup by:{' '}
                  {orderForm.pickupByCustomerId
                    ? pickupByLabel || 'Selected'
                    : selectedCustomerId
                    ? 'Same as customer'
                    : 'Not selected'}
                </div>
              </div>
              <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                <div className="flex min-h-[32px] items-center justify-between gap-2 border-b pb-2">
                  <div className="text-sm font-semibold">Pickup Location</div>
                  <span className="invisible inline-flex h-8 w-8" aria-hidden="true" />
                </div>
                <LocationPicker
                  value={orderForm.pickupLocationId}
                  onChange={(value) => setOrderForm({ ...orderForm, pickupLocationId: value })}
                  disabled={!canCreateOrders}
                  open={addLocationOpen}
                  onOpenChange={setAddLocationOpen}
                />
              </div>
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
            <div className="space-y-2">
              <Label htmlFor="dash-add-note">Order Note</Label>
              <Textarea
                id="dash-add-note"
                value={orderForm.note}
                onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })}
                placeholder="Add a quick note for this order"
                disabled={!canCreateOrders}
              />
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
        <DialogContent className="w-[80vw] max-w-[80vw] max-h-[80vh] overflow-y-auto sm:w-[75vw] sm:max-w-4xl md:w-[70vw] md:max-w-4xl lg:w-[60vw] lg:max-w-5xl">
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
            <div className="space-y-2">
              <Label>Order Pickup By</Label>
              <PickupByPicker
                value={editForm.pickupByCustomerId || ''}
                onChange={(value) => setEditForm({ ...editForm, pickupByCustomerId: value })}
                disabled={!canEditOrders}
                open={editPickupByOpen}
                onOpenChange={setEditPickupByOpen}
                label={editPickupByLabel || 'Select pickup person'}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Pickup by:{' '}
              {editForm.pickupByCustomerId ? editPickupByLabel || 'Selected' : 'Same as customer'}
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
            <div className="space-y-2">
              <Label htmlFor="dash-edit-note">Order Note</Label>
              <Textarea
                id="dash-edit-note"
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                placeholder="Add a quick note for this order"
                disabled={!canEditOrders}
              />
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

      <OrderDetailsModal
        order={detailOrder}
        open={!!detailOrder}
        onOpenChange={(open) => (!open ? setDetailOrder(null) : null)}
        campaignFallback={selectedCampaign}
      />
    </AppShell>
  );
}

