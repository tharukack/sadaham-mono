
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api';
import { AppShell } from '../../components/layout/app-shell';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
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
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../components/ui/command';
import { useToast } from '../../components/ui/use-toast';

export default function CampaignPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [currentRole, setCurrentRole] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [editOriginalForm, setEditOriginalForm] = useState({
    pickupLocationId: '',
    chickenQty: 0,
    fishQty: 0,
    vegQty: 0,
    eggQty: 0,
    otherQty: 0,
  });
  const [addExistingOrderId, setAddExistingOrderId] = useState<string | null>(null);
  const [addOriginalForm, setAddOriginalForm] = useState({
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

  const { data: orders, isLoading: isOrdersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/orders')).data,
    enabled: !!currentCampaign,
  });

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

  const campaignList = useMemo(() => {
    if (isAdmin) return campaigns || [];
    return currentCampaign ? [currentCampaign] : [];
  }, [campaigns, currentCampaign, isAdmin]);

  const createCampaign = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      await api.post('/campaigns', { name });
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-current'] });
      toast({ title: 'Campaign created' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to create campaign',
        description: err?.response?.data?.message || 'Unable to create campaign.',
      });
    } finally {
      setSaving(false);
    }
  };

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
        <CardHeader>
          <CardTitle>Campaign List</CardTitle>
          <CardDescription>Expand a campaign to view its orders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCurrentCampaignLoading || (isAdmin && isCampaignsLoading) ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading campaigns...
            </div>
          ) : campaignList.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No campaigns available.
            </div>
          ) : (
            campaignList.map((campaign: any) => {
              const isExpanded = expandedCampaignId === campaign.id;
              const isActive =
                currentCampaign && campaign.id === currentCampaign.id &&
                (campaign.state === 'STARTED' || campaign.state === 'FROZEN');
              const canShowEndedControls = !currentCampaign;
              const visibleOrders = isExpanded
                ? (orders || []).filter((o: any) => o.campaignId === campaign.id)
                : [];
              return (
                <Card key={campaign.id}>
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>{campaign.name}</CardTitle>
                      <CardDescription>State: {campaign.state}</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && campaign.state === 'STARTED' && (
                        <>
                          <Button
                            variant="secondary"
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
                      {isAdmin && campaign.state === 'ENDED' && canShowEndedControls && (
                        <>
                          <Button
                            disabled={saving}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateState(campaign.id, 'STARTED');
                            }}
                          >
                            Start
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={saving}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateState(campaign.id, 'FROZEN');
                            }}
                          >
                            Freeze
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setExpandedCampaignId(isExpanded ? null : campaign.id)
                        }
                      >
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </Button>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-4">
                      {isActive && (
                        <Button disabled={!canCreateOrders} onClick={() => setShowAddModal(true)}>
                          Add Order
                        </Button>
                      )}
                      <div className="text-sm font-medium">Orders</div>
                      {isOrdersLoading ? (
                        <div className="text-sm text-muted-foreground">Loading orders...</div>
                      ) : visibleOrders.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No orders for this campaign.
                        </div>
                      ) : (
                        <Table>
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
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleOrders.map((order: any, index: number) => {
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
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>{order.customer?.firstName || 'Unknown'}</TableCell>
                                  <TableCell>{order.customer?.lastName || 'Unknown'}</TableCell>
                                  <TableCell>{order.customer?.mobile || 'Unknown'}</TableCell>
                                  <TableCell>{createdBy}</TableCell>
                                  <TableCell>{updatedBy}</TableCell>
                                  <TableCell>
                                    {order.updatedAt
                                      ? new Date(order.updatedAt).toLocaleString()
                                      : 'Unknown'}
                                  </TableCell>
                                  <TableCell>{totalMeals}</TableCell>
                                  <TableCell>{order.pickupLocation?.name || 'Unassigned'}</TableCell>
                                  <TableCell>
                                    {campaign.id === currentCampaign?.id && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={!canEditOrders}
                                        onClick={() => startEdit(order)}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>

      {isAdmin && !currentCampaign && (
        <Card>
          <CardHeader>
            <CardTitle>Start New Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createCampaign} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Campaign'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
