import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { AlertTriangle, Check, Clock, Dot, RotateCcw, X } from 'lucide-react';
import { formatAuMobile } from '../lib/phone';
import { api } from '../lib/api';
import { useEffect, useState } from 'react';

type CampaignLike = {
  name?: string;
  state?: string;
  chickenCost?: number;
  fishCost?: number;
  vegCost?: number;
  eggCost?: number;
  otherCost?: number;
};

type OrderDetailsModalProps = {
  order: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignFallback?: CampaignLike | null;
};

export function OrderDetailsModal({
  order,
  open,
  onOpenChange,
  campaignFallback,
}: OrderDetailsModalProps) {
  if (!order) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const formatDateTime = (value?: string | Date | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatReadablePhone = (value?: string | null) => {
    if (!value) return '-';
    const normalized = formatAuMobile(value);
    const digits = normalized.replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('0')) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    if (digits.length === 9) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return normalized;
  };

  const getMealDetails = (orderValue: any) => {
    const meals = [
      { label: 'Chicken', qty: Number(orderValue.chickenQty || 0) },
      { label: 'Fish', qty: Number(orderValue.fishQty || 0) },
      { label: 'Veg', qty: Number(orderValue.vegQty || 0) },
      { label: 'Egg', qty: Number(orderValue.eggQty || 0) },
      { label: 'Other', qty: Number(orderValue.otherQty || 0) },
    ];
    const total = meals.reduce((sum, meal) => sum + meal.qty, 0);
    return { total, meals: meals.filter((meal) => meal.qty > 0) };
  };

  const getOrderCost = (orderValue: any) => {
    const campaign = orderValue.campaign || campaignFallback || {};
    const chickenCost = campaign.chickenCost || 0;
    const fishCost = campaign.fishCost || 0;
    const vegCost = campaign.vegCost || 0;
    const eggCost = campaign.eggCost || 0;
    const otherCost = campaign.otherCost || 0;
    return (
      Number(orderValue.chickenQty || 0) * chickenCost +
      Number(orderValue.fishQty || 0) * fishCost +
      Number(orderValue.vegQty || 0) * vegCost +
      Number(orderValue.eggQty || 0) * eggCost +
      Number(orderValue.otherQty || 0) * otherCost
    );
  };

  const mealDetails = getMealDetails(order);
  const totalCost = getOrderCost(order);
  const customerName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim();
  const pickupByName = order.pickupByCustomer
    ? `${order.pickupByCustomer.firstName} ${order.pickupByCustomer.lastName}`.trim()
    : customerName || '-';
  const campaignName = order.campaign?.name || campaignFallback?.name || 'Current Campaign';
  const campaignState = order.campaign?.state || campaignFallback?.state || '-';
  const createdByName = order.createdBy
    ? `${order.createdBy.firstName} ${order.createdBy.lastName}`.trim()
    : '-';
  const mainCollectorName = order.createdBy?.mainCollector
    ? `${order.createdBy.mainCollector.firstName || ''} ${order.createdBy.mainCollector.lastName || ''}`.trim()
    : '';
  const mainCollectorLabel = mainCollectorName || createdByName || '-';
  const [smsLocal, setSmsLocal] = useState<any[]>([]);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSmsLocal(Array.isArray(order.smsMessages) ? order.smsMessages : []);
  }, [order]);

  useEffect(() => {
    if (!open || !order?.id) return;
    let isActive = true;
    const load = async () => {
      try {
        const res = await api.get(`/orders/${order.id}`);
        if (!isActive) return;
        setSmsLocal(Array.isArray(res.data?.smsMessages) ? res.data.smsMessages : []);
      } catch {
        if (!isActive) return;
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [open, order?.id]);

  const latestConfirmation = smsLocal
    .slice()
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
  const confirmationStatus =
    latestConfirmation?.status === 'FAILED'
      ? 'failed'
      : latestConfirmation?.status === 'QUEUED'
      ? 'scheduled'
      : latestConfirmation?.status
      ? 'sent'
      : 'not_sent';
  const confirmationTimestamp = latestConfirmation?.createdAt || null;
  const confirmationId = latestConfirmation?.id || null;

  const smsRows = [
    {
      name: 'Order Confirmation',
      status: confirmationStatus,
      timestamp: confirmationTimestamp,
      messageId: confirmationId,
    },
    { name: 'Order Reminder', status: 'not_sent', timestamp: null },
    { name: 'Thank You', status: 'not_sent', timestamp: null },
  ];

  const retrySms = async (messageId: string) => {
    if (!messageId) return;
    setRetryingIds((prev) => new Set(Array.from(prev).concat(messageId)));
    setSmsLocal((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, status: 'QUEUED', updatedAt: new Date().toISOString() } : msg
      )
    );
    await api.post(`/sms/retry/${messageId}`);
    setRetryingIds((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
  };
  const smsStatus = 'Active';
  const statusConfig: Record<string, { label: string; icon: JSX.Element; className: string }> = {
    sent: {
      label: 'Sent',
      icon: <Check className="h-3.5 w-3.5" aria-hidden="true" />,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    scheduled: {
      label: 'Queued',
      icon: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    not_sent: {
      label: 'Not Sent',
      icon: <Dot className="h-3.5 w-3.5" aria-hidden="true" />,
      className: 'border-slate-200 bg-slate-50 text-slate-700',
    },
    failed: {
      label: 'Failed',
      icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[80vh] w-[80vw] max-w-[80vw] max-h-[80vh] overflow-hidden p-0 sm:w-[75vw] sm:max-w-4xl md:w-[70vw] md:max-w-4xl lg:w-[60vw] lg:max-w-5xl [&>button]:hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="sticky top-0 z-10 border-b bg-background">
            <div className="flex items-center justify-between px-3 pt-0 sm:px-4">
              <DialogTitle className="text-lg">Order Details</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="px-3 pb-3 sm:px-4">
              <Card className="shadow-sm">
                <CardContent className="grid gap-2 p-3 md:grid-cols-[1.4fr_1fr]">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Customer</div>
                    <div className="text-lg font-semibold">{customerName || 'Customer'}</div>
                  </div>
                  <div className="grid gap-1 text-sm md:text-right">
                    <div className="font-medium">
                      {formatReadablePhone(
                        (order.customer as any)?.phone || order.customer?.mobile || null
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {order.customer?.address || '-'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="px-3 pb-3 sm:px-4">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Entered By</Badge>
                  <span className="text-foreground">{createdByName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Entered On</Badge>
                  <span className="text-foreground">{formatDateTime(order.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Last Updated</Badge>
                  <span className="text-foreground">{formatDateTime(order.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Status</Badge>
                  <span className="text-foreground">{order.deletedAt ? 'Deleted' : 'Active'}</span>
                </div>
              </div>
            </div>
            <div className="px-3 pb-3 sm:px-4">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Total Orders
                </span>
                <span className="font-medium">{mealDetails.total}</span>
                {mealDetails.meals.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No meals selected.</span>
                ) : (
                  mealDetails.meals.map((meal) => (
                    <Badge key={meal.label} variant="secondary">
                      {meal.label} {meal.qty}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3 sm:px-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="shadow-sm">
                <CardContent className="p-3 text-sm">
                  <div className="mb-3 border-b pb-2 text-sm font-semibold uppercase text-muted-foreground">
                    Order Summary
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Campaign</span>
                      <span className="text-right font-medium">{campaignName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Campaign State</span>
                      <span className="text-right font-medium">{campaignState}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Total Cost</span>
                      <span className="text-right font-semibold">${totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Order Entered User</span>
                      <span className="text-right font-medium">{createdByName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Main Collector</span>
                      <span className="text-right font-medium">{mainCollectorLabel}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3 text-sm">
                  <div className="mb-3 flex items-center justify-between border-b pb-2">
                    <div className="text-sm font-semibold uppercase text-muted-foreground">
                      SMS Campaign
                    </div>
                    <Badge variant="outline">{smsStatus}</Badge>
                  </div>
                        <div className="space-y-2">
                          {smsRows.map((row: any) => {
                            const config = statusConfig[row.status];
                            const timestampLabel = row.timestamp
                              ? formatDateTime(row.timestamp)
                              : '-';
                            return (
                              <div
                                key={row.name}
                                className="grid items-center gap-2 rounded-md border px-3 py-2 md:grid-cols-[1.2fr_1fr_auto]"
                              >
                                <div className="min-w-0 font-medium sm:min-w-[160px]">
                                  {row.name}
                                </div>
                                <div className="text-xs text-muted-foreground md:text-center">
                                  {timestampLabel}
                                </div>
                                <div className="flex items-center gap-2 justify-self-start md:justify-self-end">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${config.className}`}
                                  >
                                    {config.icon}
                                    {config.label}
                                  </span>
                                  {row.status === 'failed' ? (
                                    <Button
                                      size="icon"
                                      variant="secondary"
                                      onClick={() => retrySms(row.messageId)}
                                      disabled={retryingIds.has(row.messageId)}
                                      aria-label="Retry SMS"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3 text-sm">
                  <div className="mb-3 border-b pb-2 text-sm font-semibold uppercase text-muted-foreground">
                    Pickup Details
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Pickup Location</span>
                      <span className="text-right font-medium">
                        {order.pickupLocation?.name || 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Pickup By</span>
                      <span className="text-right font-medium">{pickupByName || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Address</span>
                      <span className="text-right font-medium">
                        {order.pickupLocation?.address || '-'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3 text-sm">
                  <div className="mb-3 border-b pb-2 text-sm font-semibold uppercase text-muted-foreground">
                    Notes
                  </div>
                  {order.note ? (
                    <div className="whitespace-pre-wrap text-sm text-foreground">{order.note}</div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                        <Dot className="h-4 w-4" aria-hidden="true" />
                      </span>
                      No notes added.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
