
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api';
import { formatAuMobile } from '../../lib/phone';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../components/ui/command';
import { useToast } from '../../components/ui/use-toast';
import { Pencil } from 'lucide-react';

export default function CampaignPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [currentRole, setCurrentRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    chickenCost: 0,
    fishCost: 0,
    vegCost: 0,
    eggCost: 0,
    otherCost: 0,
  });
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignRowsPerPage, setCampaignRowsPerPage] = useState(10);
  const [campaignSortBy, setCampaignSortBy] = useState<'name' | 'state' | 'started'>('started');
  const [customerSearch, setCustomerSearch] = useState('');
  const [pickupBySearch, setPickupBySearch] = useState('');
  const [pickupByLabel, setPickupByLabel] = useState('');
  const [editPickupByLabel, setEditPickupByLabel] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [expandedOrdersPage, setExpandedOrdersPage] = useState(1);
  const [expandedOrdersRowsPerPage, setExpandedOrdersRowsPerPage] = useState(10);
  const [expandedOrdersSortBy, setExpandedOrdersSortBy] = useState<
    'created' | 'updated' | 'name'
  >('updated');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
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
  const [addExistingOrderId, setAddExistingOrderId] = useState<string | null>(null);
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
  const isAdmin = currentRole === 'ADMIN';
  const isEditor = currentRole === 'EDITOR';
  const { toast } = useToast();

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
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('campaignOrderDraft');
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft?.orderForm) {
        setOrderForm(draft.orderForm);
        setCustomerSearch(draft.customerSearch || '');
        setSelectedCustomerId(draft.selectedCustomerId || '');
        setShowAddModal(true);
      }
    } catch {
      // ignore malformed draft
    }
  }, []);

  const { data: currentCampaign, isLoading: isCurrentCampaignLoading } = useQuery({
    queryKey: ['campaign-current'],
    queryFn: async () => (await api.get('/campaigns/current')).data,
  });

  useEffect(() => {
    if (!editingCampaign) return;
    setCampaignForm({
      name: editingCampaign.name || '',
      chickenCost: editingCampaign.chickenCost || 0,
      fishCost: editingCampaign.fishCost || 0,
      vegCost: editingCampaign.vegCost || 0,
      eggCost: editingCampaign.eggCost || 0,
      otherCost: editingCampaign.otherCost || 0,
    });
  }, [editingCampaign]);

  const { data: campaigns, isLoading: isCampaignsLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/campaigns')).data,
    enabled: isAdmin,
  });

  const { data: locations, isLoading: isLocationsLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get('/locations')).data,
  });

  const { data: customers, isLoading: isCustomersLoading } = useQuery({
    queryKey: ['customer-search', customerSearch],
    queryFn: async () => (await api.get('/customers/search', { params: { q: customerSearch } })).data,
    enabled: (isAdmin || isEditor) && customerSearch.trim().length > 0,
  });

  const { data: pickupByCustomers, isLoading: isPickupByLoading } = useQuery({
    queryKey: ['pickup-by-search', pickupBySearch],
    queryFn: async () => (await api.get('/customers/search', { params: { q: pickupBySearch } })).data,
    enabled: (isAdmin || isEditor) && pickupBySearch.trim().length > 0,
  });

  const { data: orders, isLoading: isOrdersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/orders')).data,
    enabled: !!currentCampaign,
  });
  const orderCountsByCampaign = useMemo(() => {
    const map = new Map<string, number>();
    (orders || []).forEach((order: any) => {
      const id = order.campaignId;
      if (!id) return;
      map.set(id, (map.get(id) || 0) + 1);
    });
    return map;
  }, [orders]);

  const canCreateOrders =
    (isAdmin || isEditor) && currentCampaign && currentCampaign.state === 'STARTED';
  const canEditOrders =
    currentCampaign?.state === 'STARTED'
      ? isAdmin || isEditor
      : currentCampaign?.state === 'FROZEN'
      ? isAdmin
      : false;

  const selectedCustomer = useMemo(() => {
    return (customers || []).find((c: any) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const existingOrderForCustomer = useMemo(() => {
    if (!currentCampaign || !selectedCustomerId) return null;
    return (orders || []).find(
      (order: any) =>
        order.campaignId === currentCampaign.id && order.customerId === selectedCustomerId
    );
  }, [orders, currentCampaign, selectedCustomerId]);

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

  const campaignList = useMemo(() => {
    if (isAdmin) return campaigns || [];
    return currentCampaign ? [currentCampaign] : [];
  }, [campaigns, currentCampaign, isAdmin]);

  const filteredCampaigns = useMemo(() => {
    const term = campaignSearch.trim().toLowerCase();
    if (!term) return campaignList;
    return campaignList.filter((campaign: any) => {
      const name = `${campaign.name || ''}`.toLowerCase();
      const state = `${campaign.state || ''}`.toLowerCase();
      return name.includes(term) || state.includes(term);
    });
  }, [campaignList, campaignSearch]);

  const sortedCampaigns = useMemo(() => {
    const next = [...filteredCampaigns];
    next.sort((a: any, b: any) => {
      if (campaignSortBy === 'name') {
        return `${a.name || ''}`.localeCompare(`${b.name || ''}`);
      }
      if (campaignSortBy === 'state') {
        return `${a.state || ''}`.localeCompare(`${b.state || ''}`);
      }
      const aDate = new Date(a.startedAt || 0).getTime();
      const bDate = new Date(b.startedAt || 0).getTime();
      return bDate - aDate;
    });
    return next;
  }, [filteredCampaigns, campaignSortBy]);

  const campaignPageCount = useMemo(() => {
    return Math.max(1, Math.ceil(sortedCampaigns.length / campaignRowsPerPage));
  }, [sortedCampaigns.length, campaignRowsPerPage]);

  const pagedCampaigns = useMemo(() => {
    const start = (campaignPage - 1) * campaignRowsPerPage;
    return sortedCampaigns.slice(start, start + campaignRowsPerPage);
  }, [sortedCampaigns, campaignPage, campaignRowsPerPage]);

  const submitCampaign = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setCampaignSaving(true);
    try {
      const payload = {
        name: campaignForm.name,
        chickenCost: campaignForm.chickenCost,
        fishCost: campaignForm.fishCost,
        vegCost: campaignForm.vegCost,
        eggCost: campaignForm.eggCost,
        otherCost: campaignForm.otherCost,
      };
      if (editingCampaign) {
        await api.patch(`/campaigns/${editingCampaign.id}`, payload);
      } else {
        await api.post('/campaigns', payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-current'] });
      setCampaignForm({
        name: '',
        chickenCost: 0,
        fishCost: 0,
        vegCost: 0,
        eggCost: 0,
        otherCost: 0,
      });
      setEditingCampaign(null);
      setCampaignModalOpen(false);
      toast({ title: editingCampaign ? 'Campaign updated' : 'Campaign created' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: editingCampaign ? 'Failed to update campaign' : 'Failed to create campaign',
        description:
          err?.response?.data?.message ||
          (editingCampaign ? 'Unable to update campaign.' : 'Unable to create campaign.'),
      });
    } finally {
      setCampaignSaving(false);
    }
  };

  useEffect(() => {
    setCampaignPage(1);
  }, [campaignSearch, campaignSortBy]);

  useEffect(() => {
    setCampaignPage((prev) => Math.min(Math.max(prev, 1), campaignPageCount));
  }, [campaignPageCount]);

  useEffect(() => {
    setExpandedOrdersPage(1);
  }, [expandedCampaignId, expandedOrdersSortBy]);


  const updateState = async (id: string, state: string) => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await api.patch(`/campaigns/${id}`, { state });
      await queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-current'] });
      toast({ title: `Campaign updated to ${state}` });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to update campaign',
        description: err?.response?.data?.message || 'Unable to update campaign.',
      });
    } finally {
      setSaving(false);
    }
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
      if (addExistingOrderId) {
        await api.patch(`/orders/${addExistingOrderId}`, payload);
      } else {
        await api.post('/orders', payload);
      }
      setSelectedCustomerId('');
      setCustomerSearch('');
      setPickupBySearch('');
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
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowAddModal(false);
      toast({ title: addExistingOrderId ? 'Order updated' : 'Order created' });
      if (typeof window !== 'undefined') {
        localStorage.removeItem('campaignOrderDraft');
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

  const startEdit = (order: any) => {
    setEditingOrderId(order.id);
    setShowEditModal(true);
    setPickupBySearch('');
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

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingOrderId || !canEditOrders) return;
    setEditSaving(true);
    try {
      await api.patch(`/orders/${editingOrderId}`, {
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
      setPickupBySearch('');
      setEditPickupByLabel('');
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
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
    const selected = (locations || []).find((loc: any) => loc.id === value);

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
                {(locations || []).map((loc: any) => (
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

  return (
    <AppShell title="Campaigns">
      <PageHeader
        title="Campaigns"
        description="Manage campaign states and track orders."
      />
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Campaign List</CardTitle>
            <CardDescription>Search, sort, and expand a campaign to manage details.</CardDescription>
          </div>
          {isAdmin && (
            <Button
              onClick={() => {
                setEditingCampaign(null);
                setCampaignForm({
                  name: '',
                  chickenCost: 0,
                  fishCost: 0,
                  vegCost: 0,
                  eggCost: 0,
                  otherCost: 0,
                });
                setCampaignModalOpen(true);
              }}
            >
              Add Campaign
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
              placeholder="Search campaigns by name or state"
            />
          </div>
          {isCurrentCampaignLoading || (isAdmin && isCampaignsLoading) ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading campaigns...
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No campaigns available.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[1100px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedCampaigns.map((campaign: any) => {
                      const isExpanded = expandedCampaignId === campaign.id;
                      const isActive =
                        currentCampaign &&
                        campaign.id === currentCampaign.id &&
                        (campaign.state === 'STARTED' || campaign.state === 'FROZEN');
                      return (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>
                            {campaign.state === 'STARTED' ? (
                              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                                Started
                              </Badge>
                            ) : campaign.state === 'FROZEN' ? (
                              <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                                Frozen
                              </Badge>
                            ) : (
                              <Badge className="border-rose-200 bg-rose-50 text-rose-700" variant="outline">
                                Ended
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {campaign.startedAt
                              ? new Date(campaign.startedAt).toLocaleString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: '2-digit',
                                })
                              : '-'}
                          </TableCell>
                          <TableCell>{orderCountsByCampaign.get(campaign.id) || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {isAdmin && campaign.state === 'STARTED' && (
                                <>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={saving}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateState(campaign.id, 'FROZEN');
                                    }}
                                  >
                                    Freeze
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={saving}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateState(campaign.id, 'ENDED');
                                    }}
                                  >
                                    End
                                  </Button>
                                </>
                              )}
                              {isAdmin && campaign.state === 'FROZEN' && (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={saving}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateState(campaign.id, 'STARTED');
                                    }}
                                  >
                                    Start
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={saving}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateState(campaign.id, 'ENDED');
                                    }}
                                  >
                                    End
                                  </Button>
                                </>
                              )}
                              {isAdmin && campaign.state === 'ENDED' && !currentCampaign && (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={saving}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateState(campaign.id, 'STARTED');
                                    }}
                                  >
                                    Start
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-[90px]"
                                onClick={() =>
                                  setExpandedCampaignId(isExpanded ? null : campaign.id)
                                }
                              >
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="secondary"
                                  disabled={!isActive}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCampaign(campaign);
                                    setCampaignModalOpen(true);
                                  }}
                                  aria-label="Edit campaign"
                                >
                                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                                  Edit
                                </Button>
                              )}
                            </div>
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
                      value={campaignSortBy}
                      onValueChange={(value) =>
                        setCampaignSortBy(value as 'name' | 'state' | 'started')
                      }
                    >
                      <SelectTrigger className="h-8 w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="started">Started date</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="state">State</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Rows per page</span>
                    <Select
                      value={String(campaignRowsPerPage)}
                      onValueChange={(value) => {
                        const parsed = Number(value);
                        setCampaignRowsPerPage(parsed);
                        setCampaignPage(1);
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
                    {sortedCampaigns.length === 0
                      ? '0 of 0'
                      : `${(campaignPage - 1) * campaignRowsPerPage + 1}-${Math.min(
                          campaignPage * campaignRowsPerPage,
                          sortedCampaigns.length,
                        )} of ${sortedCampaigns.length}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCampaignPage((prev) => Math.max(1, prev - 1))}
                      disabled={campaignPage <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCampaignPage((prev) => Math.min(campaignPageCount, prev + 1))
                      }
                      disabled={campaignPage >= campaignPageCount}
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

      {expandedCampaignId && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {(campaignList || []).find((c: any) => c.id === expandedCampaignId)?.name ||
                  'Campaign Details'}
              </CardTitle>
              <CardDescription>Manage campaign state and orders.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const campaign = (campaignList || []).find((c: any) => c.id === expandedCampaignId);
                if (!campaign) return null;
                const isActive =
                  currentCampaign &&
                  campaign.id === currentCampaign.id &&
                  (campaign.state === 'STARTED' || campaign.state === 'FROZEN');
                return (
                  <>
                    {isActive && (
                      <Button
                        disabled={!canCreateOrders}
                        onClick={() => router.push('/dashboard?addOrder=1')}
                      >
                        Add Order
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setExpandedCampaignId(null)}>
                      Collapse
                    </Button>
                  </>
                );
              })()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const campaign = (campaignList || []).find((c: any) => c.id === expandedCampaignId);
              if (!campaign) return null;
              const visibleOrders = (orders || []).filter((o: any) => o.campaignId === campaign.id);
              const sortedOrders = [...visibleOrders].sort((a: any, b: any) => {
                if (expandedOrdersSortBy === 'name') {
                  const aName = `${a.customer?.firstName || ''} ${a.customer?.lastName || ''}`.trim();
                  const bName = `${b.customer?.firstName || ''} ${b.customer?.lastName || ''}`.trim();
                  return aName.localeCompare(bName);
                }
                const aDate = new Date(
                  expandedOrdersSortBy === 'created' ? a.createdAt || 0 : a.updatedAt || 0,
                ).getTime();
                const bDate = new Date(
                  expandedOrdersSortBy === 'created' ? b.createdAt || 0 : b.updatedAt || 0,
                ).getTime();
                return bDate - aDate;
              });
              const expandedOrdersPageCount = Math.max(
                1,
                Math.ceil(sortedOrders.length / expandedOrdersRowsPerPage),
              );
              const expandedOrdersStart = (expandedOrdersPage - 1) * expandedOrdersRowsPerPage;
              const pagedOrders = sortedOrders.slice(
                expandedOrdersStart,
                expandedOrdersStart + expandedOrdersRowsPerPage,
              );
              const pageStart = sortedOrders.length === 0 ? 0 : expandedOrdersStart + 1;
              const pageEnd = Math.min(
                expandedOrdersPage * expandedOrdersRowsPerPage,
                sortedOrders.length,
              );
              return (
                <>
                  <div className="text-sm font-medium">Orders</div>
                  {isOrdersLoading ? (
                    <div className="text-sm text-muted-foreground">Loading orders...</div>
                  ) : visibleOrders.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No orders for this campaign.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-full overflow-x-auto">
                        <Table className="min-w-[1100px] whitespace-nowrap text-sm [&_td]:py-2 [&_th]:py-2">
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>First Name</TableHead>
                              <TableHead>Last Name</TableHead>
                              <TableHead>Mobile</TableHead>
                              <TableHead>Created By</TableHead>
                              <TableHead>Edited By</TableHead>
                              <TableHead>Modified</TableHead>
                              <TableHead>Total Meals</TableHead>
                              <TableHead>Collection Point</TableHead>
                              <TableHead>Pickup By</TableHead>
                              <TableHead>Note</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pagedOrders.map((order: any, index: number) => {
                              const totalMeals =
                                Number(order.chickenQty || 0) +
                                Number(order.fishQty || 0) +
                                Number(order.vegQty || 0) +
                                Number(order.eggQty || 0) +
                                Number(order.otherQty || 0);
                              const createdBy = order.createdBy
                                ? `${order.createdBy.firstName} ${order.createdBy.lastName}`.trim()
                                : 'Unknown';
                              const updatedBy = order.updatedBy
                                ? `${order.updatedBy.firstName} ${order.updatedBy.lastName}`.trim()
                                : 'Unknown';
                              return (
                                <TableRow key={order.id}>
                                  <TableCell>{expandedOrdersStart + index + 1}</TableCell>
                                  <TableCell>{order.customer?.firstName || 'Unknown'}</TableCell>
                                  <TableCell>{order.customer?.lastName || 'Unknown'}</TableCell>
                                  <TableCell>
                                    {formatAuMobile(order.customer?.mobile || '') || 'Unknown'}
                                  </TableCell>
                                  <TableCell>{createdBy}</TableCell>
                                  <TableCell>{updatedBy}</TableCell>
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
                                  <TableCell>{totalMeals}</TableCell>
                                  <TableCell>{order.pickupLocation?.name || 'Unknown'}</TableCell>
                                  <TableCell>
                                    {order.pickupByCustomer
                                      ? `${order.pickupByCustomer.firstName} ${order.pickupByCustomer.lastName}`.trim()
                                      : `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim()}
                                  </TableCell>
                                  <TableCell>{order.note || '-'}</TableCell>
                                  <TableCell>
                                    {canEditOrders ? (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => startEdit(order)}
                                      >
                                        Edit
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        No access
                                      </span>
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
                              value={expandedOrdersSortBy}
                              onValueChange={(value) =>
                                setExpandedOrdersSortBy(
                                  value as 'created' | 'updated' | 'name'
                                )
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
                              value={String(expandedOrdersRowsPerPage)}
                              onValueChange={(value) => {
                                const parsed = Number(value);
                                setExpandedOrdersRowsPerPage(parsed);
                                setExpandedOrdersPage(1);
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
                              : `${pageStart}-${pageEnd} of ${sortedOrders.length}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExpandedOrdersPage((prev) => Math.max(1, prev - 1))
                              }
                              disabled={expandedOrdersPage <= 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExpandedOrdersPage((prev) =>
                                  Math.min(expandedOrdersPageCount, prev + 1)
                                )
                              }
                              disabled={expandedOrdersPage >= expandedOrdersPageCount}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={campaignModalOpen}
        onOpenChange={(open) => {
          setCampaignModalOpen(open);
          if (!open) {
            setEditingCampaign(null);
            setCampaignForm({
              name: '',
              chickenCost: 0,
              fishCost: 0,
              vegCost: 0,
              eggCost: 0,
              otherCost: 0,
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'Add Campaign'}</DialogTitle>
            <DialogDescription>
              {editingCampaign
                ? 'Update campaign details and meal costs.'
                : 'Create a new campaign with its meal costs.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCampaign} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                required
                disabled={!isAdmin}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="campaign-cost-chicken">Chicken Cost</Label>
                <Input
                  id="campaign-cost-chicken"
                  type="number"
                  min={0}
                  step="0.01"
                  value={campaignForm.chickenCost}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      chickenCost: Number(e.target.value),
                    })
                  }
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-cost-fish">Fish Cost</Label>
                <Input
                  id="campaign-cost-fish"
                  type="number"
                  min={0}
                  step="0.01"
                  value={campaignForm.fishCost}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      fishCost: Number(e.target.value),
                    })
                  }
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-cost-veg">Veg Cost</Label>
                <Input
                  id="campaign-cost-veg"
                  type="number"
                  min={0}
                  step="0.01"
                  value={campaignForm.vegCost}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      vegCost: Number(e.target.value),
                    })
                  }
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-cost-egg">Egg Cost</Label>
                <Input
                  id="campaign-cost-egg"
                  type="number"
                  min={0}
                  step="0.01"
                  value={campaignForm.eggCost}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      eggCost: Number(e.target.value),
                    })
                  }
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-cost-other">Other Cost</Label>
                <Input
                  id="campaign-cost-other"
                  type="number"
                  min={0}
                  step="0.01"
                  value={campaignForm.otherCost}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      otherCost: Number(e.target.value),
                    })
                  }
                  disabled={!isAdmin}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!isAdmin || campaignSaving}>
                {campaignSaving
                  ? editingCampaign
                    ? 'Saving...'
                    : 'Creating...'
                  : editingCampaign
                  ? 'Save Changes'
                  : 'Create Campaign'}
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setCampaignModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Order</DialogTitle>
            <DialogDescription>Create an order for the active campaign.</DialogDescription>
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem(
                        'campaignOrderDraft',
                        JSON.stringify({
                          customerSearch,
                          selectedCustomerId,
                          orderForm,
                        })
                      );
                    }
                    router.push('/customers/search');
                  }}
                  disabled={!canCreateOrders}
                >
                  Add Customer
                </Button>
              </div>
            </div>
            {customerSearch.trim().length > 0 && (
              <div className="rounded-md border">
                {isCustomersLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading customers...</div>
                ) : (customers || []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No customers found.</div>
                ) : (
                  (customers || []).map((c: any) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={selectedCustomerId === c.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start rounded-none"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearch('');
                        setOrderForm((prev) => ({
                          ...prev,
                          pickupByCustomerId: prev.pickupByCustomerId || c.id,
                        }));
                      }}
                      disabled={!canCreateOrders}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAuMobile(c.mobile || '')}
                        </div>
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
            <div className="space-y-2">
              <Label>Order Pickup By</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={pickupBySearch}
                  onChange={(e) => setPickupBySearch(e.target.value)}
                  placeholder="Search pickup person by name or mobile"
                  disabled={!canCreateOrders}
                />
              </div>
            </div>
            {pickupBySearch.trim().length > 0 && (
              <div className="rounded-md border">
                {isPickupByLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading customers...</div>
                ) : (pickupByCustomers || []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No customers found.</div>
                ) : (
                  (pickupByCustomers || []).map((c: any) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={orderForm.pickupByCustomerId === c.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start rounded-none"
                      onClick={() => {
                        setOrderForm({ ...orderForm, pickupByCustomerId: c.id });
                        setPickupByLabel(`${c.firstName} ${c.lastName}`.trim());
                        setPickupBySearch('');
                      }}
                      disabled={!canCreateOrders}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAuMobile(c.mobile || '')}
                        </div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Pickup by:{' '}
              {orderForm.pickupByCustomerId
                ? pickupByLabel || 'Selected'
                : selectedCustomerId
                ? 'Same as customer'
                : 'Not selected'}
            </div>
            {existingOrderForCustomer && (
              <div className="text-sm text-amber-700">
                This customer already has an order in this campaign. Editing existing order.
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
              {isLocationsLoading && (
                <p className="text-xs text-muted-foreground">Loading locations...</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="add-chicken">Chicken</Label>
                <Input
                  id="add-chicken"
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
                <Label htmlFor="add-fish">Fish</Label>
                <Input
                  id="add-fish"
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
                <Label htmlFor="add-veg">Veg</Label>
                <Input
                  id="add-veg"
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
                <Label htmlFor="add-egg">Egg</Label>
                <Input
                  id="add-egg"
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
                <Label htmlFor="add-other">Other</Label>
                <Input
                  id="add-other"
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
              <Label htmlFor="add-note">Order Note</Label>
              <Textarea
                id="add-note"
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>Update the existing order details.</DialogDescription>
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
              {isLocationsLoading && (
                <p className="text-xs text-muted-foreground">Loading locations...</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Order Pickup By</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={pickupBySearch}
                  onChange={(e) => setPickupBySearch(e.target.value)}
                  placeholder="Search pickup person by name or mobile"
                  disabled={!canEditOrders}
                />
              </div>
            </div>
            {pickupBySearch.trim().length > 0 && (
              <div className="rounded-md border">
                {isPickupByLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading customers...</div>
                ) : (pickupByCustomers || []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No customers found.</div>
                ) : (
                  (pickupByCustomers || []).map((c: any) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={editForm.pickupByCustomerId === c.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start rounded-none"
                      onClick={() => {
                        setEditForm({ ...editForm, pickupByCustomerId: c.id });
                        setEditPickupByLabel(`${c.firstName} ${c.lastName}`.trim());
                        setPickupBySearch('');
                      }}
                      disabled={!canEditOrders}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAuMobile(c.mobile || '')}
                        </div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Pickup by:{' '}
              {editForm.pickupByCustomerId ? editPickupByLabel || 'Selected' : 'Same as customer'}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="edit-chicken">Chicken</Label>
                <Input
                  id="edit-chicken"
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
                <Label htmlFor="edit-fish">Fish</Label>
                <Input
                  id="edit-fish"
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
                <Label htmlFor="edit-veg">Veg</Label>
                <Input
                  id="edit-veg"
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
                <Label htmlFor="edit-egg">Egg</Label>
                <Input
                  id="edit-egg"
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
                <Label htmlFor="edit-other">Other</Label>
                <Input
                  id="edit-other"
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
              <Label htmlFor="edit-note">Order Note</Label>
              <Textarea
                id="edit-note"
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
    </AppShell>
  );
}
