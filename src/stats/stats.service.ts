import { BadRequestException, Injectable } from '@nestjs/common';
import { SmsStatus } from '@prisma/client';
import { PrismaService } from '../common/utils/prisma.service';

type OrdersTimelinePoint = { date: string; orders: number };
type CustomerLite = { customerId: string; mobile: string; firstName: string; lastName: string };
type MealTotals = {
  chicken: number;
  fish: number;
  veg: number;
  egg: number;
  other: number;
  totalMeals: number;
};

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  private formatSydneyDate(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  }

  private getTimelineStart(startedAt: Date, endedAt?: Date | null) {
    const end = endedAt ?? new Date();
    const durationMs = Math.abs(end.getTime() - startedAt.getTime());
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    if (durationDays <= 30) return startedAt;
    return new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  }

  private median(values: number[]) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  private classifySmsType(body?: string | null) {
    const text = (body || '').toLowerCase();
    if (!text) return 'bulk';
    if (text.includes('otp') || (text.includes('code') && /\d{4,6}/.test(text))) {
      return 'otp';
    }
    if (text.includes('order') || text.includes('pickup')) {
      return 'orderConfirmation';
    }
    return 'bulk';
  }

  private toMealTotals(order: {
    chickenQty: number | null;
    fishQty: number | null;
    vegQty: number | null;
    eggQty: number | null;
    otherQty: number | null;
  }): MealTotals {
    const chicken = order.chickenQty || 0;
    const fish = order.fishQty || 0;
    const veg = order.vegQty || 0;
    const egg = order.eggQty || 0;
    const other = order.otherQty || 0;
    return {
      chicken,
      fish,
      veg,
      egg,
      other,
      totalMeals: chicken + fish + veg + egg + other,
    };
  }

  async statsByCampaigns(campaignIds: string[]) {
    const ids = Array.from(new Set((campaignIds || []).filter(Boolean)));
    if (ids.length === 0) {
      throw new BadRequestException('At least one campaign is required.');
    }

    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: ids } },
      orderBy: { startedAt: 'desc' },
    });

    if (!campaigns.length) {
      throw new BadRequestException('Campaigns not found.');
    }

    const orders = await this.prisma.order.findMany({
      where: { campaignId: { in: ids }, deletedAt: null },
      select: {
        id: true,
        campaignId: true,
        pickupLocationId: true,
        createdAt: true,
        updatedAt: true,
        chickenQty: true,
        fishQty: true,
        vegQty: true,
        eggQty: true,
        otherQty: true,
        customerId: true,
        pickupLocation: { select: { id: true, name: true, distributorName: true } },
        customer: { select: { id: true, address: true, mobile: true } },
      },
    });

    const smsMessages = await this.prisma.smsMessage.findMany({
      where: { campaignId: { in: ids } },
      select: {
        id: true,
        campaignId: true,
        status: true,
        createdAt: true,
        lastError: true,
        body: true,
      },
    });

    const ordersByCampaign = new Map<string, typeof orders>();
    orders.forEach((order) => {
      const existing = ordersByCampaign.get(order.campaignId) || [];
      existing.push(order);
      ordersByCampaign.set(order.campaignId, existing);
    });

    const smsByCampaign = new Map<string, typeof smsMessages>();
    smsMessages.forEach((sms) => {
      const existing = smsByCampaign.get(sms.campaignId || '') || [];
      existing.push(sms);
      smsByCampaign.set(sms.campaignId || '', existing);
    });

    const combinedMealsPerOrder: number[] = [];
    const combinedOrdersTimeline = new Map<string, number>();
    const combinedSmsTimeline = new Map<string, { delivered: number; failed: number }>();
    const combinedPickup = new Map<
      string,
      { locationId: string; name: string; distributorName: string; orders: number; meals: number }
    >();
    const combinedMeals = { chicken: 0, fish: 0, veg: 0, egg: 0, other: 0 };
    const combinedSmsSummary = {
      total: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      byType: { otp: 0, orderConfirmation: 0, bulk: 0 },
      failureReasons: new Map<string, { count: number; sampleIds: string[] }>(),
    };

    const latestEnd = campaigns.reduce<Date>((acc, campaign) => {
      const end = campaign.endedAt ?? new Date();
      return end > acc ? end : acc;
    }, campaigns[0]?.endedAt ?? new Date());
    const combinedStart = this.getTimelineStart(
      campaigns.reduce((acc, campaign) => (campaign.startedAt < acc ? campaign.startedAt : acc), campaigns[0].startedAt),
      latestEnd,
    );

    const campaignStats = campaigns.map((campaign) => {
      const campaignOrders = ordersByCampaign.get(campaign.id) || [];
      const campaignSms = smsByCampaign.get(campaign.id) || [];

      const totalOrders = campaignOrders.length;
      let totalMeals = 0;
      const mealsByType = { chicken: 0, fish: 0, veg: 0, egg: 0, other: 0 };
      const mealsPerOrder: number[] = [];
      const pickupMap = new Map<
        string,
        { locationId: string; name: string; distributorName: string; orders: number; meals: number }
      >();

      const missingPickup = campaignOrders.filter(
        (order) => !order.pickupLocationId || order.pickupLocationId.trim() === '',
      ).length;

      const missingAddressCustomers = new Set<string>();
      let invalidMeals = 0;
      let postFreezeEdits = 0;

      campaignOrders.forEach((order) => {
        const mealTotal =
          (order.chickenQty || 0) +
          (order.fishQty || 0) +
          (order.vegQty || 0) +
          (order.eggQty || 0) +
          (order.otherQty || 0);
        totalMeals += mealTotal;
        mealsByType.chicken += order.chickenQty || 0;
        mealsByType.fish += order.fishQty || 0;
        mealsByType.veg += order.vegQty || 0;
        mealsByType.egg += order.eggQty || 0;
        mealsByType.other += order.otherQty || 0;
        mealsPerOrder.push(mealTotal);
        combinedMealsPerOrder.push(mealTotal);
        combinedMeals.chicken += order.chickenQty || 0;
        combinedMeals.fish += order.fishQty || 0;
        combinedMeals.veg += order.vegQty || 0;
        combinedMeals.egg += order.eggQty || 0;
        combinedMeals.other += order.otherQty || 0;

        if (!order.customer?.address || order.customer.address.trim() === '') {
          missingAddressCustomers.add(order.customerId);
        }

        const hasInvalidMeal =
          [order.chickenQty, order.fishQty, order.vegQty, order.eggQty, order.otherQty].some(
            (qty) => qty < 0 || qty > 1000,
          );
        if (hasInvalidMeal) invalidMeals += 1;

        if (campaign.frozenAt) {
          if (order.createdAt > campaign.frozenAt || order.updatedAt > campaign.frozenAt) {
            postFreezeEdits += 1;
          }
        }

        const pickupId = order.pickupLocationId || 'unknown';
        const pickup = pickupMap.get(pickupId) || {
          locationId: pickupId,
          name: order.pickupLocation?.name || 'Unknown',
          distributorName: order.pickupLocation?.distributorName || 'Unknown',
          orders: 0,
          meals: 0,
        };
        pickup.orders += 1;
        pickup.meals += mealTotal;
        pickupMap.set(pickupId, pickup);

        const combinedPickupEntry = combinedPickup.get(pickupId) || {
          locationId: pickupId,
          name: order.pickupLocation?.name || 'Unknown',
          distributorName: order.pickupLocation?.distributorName || 'Unknown',
          orders: 0,
          meals: 0,
        };
        combinedPickupEntry.orders += 1;
        combinedPickupEntry.meals += mealTotal;
        combinedPickup.set(pickupId, combinedPickupEntry);
      });

      const avgMealsPerOrder = totalOrders ? totalMeals / totalOrders : 0;
      const medianMealsPerOrder = this.median(mealsPerOrder);
      const maxMealsInOrder = mealsPerOrder.length ? Math.max(...mealsPerOrder) : 0;

      const timelineStart = this.getTimelineStart(campaign.startedAt, campaign.endedAt);
      const dailyOrdersMap = new Map<string, number>();
      campaignOrders.forEach((order) => {
        if (order.createdAt < timelineStart) return;
        const dateKey = this.formatSydneyDate(order.createdAt);
        dailyOrdersMap.set(dateKey, (dailyOrdersMap.get(dateKey) || 0) + 1);
      });
      const ordersTimeline = Array.from(dailyOrdersMap.entries())
        .map(([date, ordersCount]) => ({ date, orders: ordersCount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      ordersTimeline.forEach((point) => {
        combinedOrdersTimeline.set(
          point.date,
          (combinedOrdersTimeline.get(point.date) || 0) + point.orders,
        );
      });

      const peakOrderDay = ordersTimeline.reduce(
        (acc, current) => {
          if (!acc) return current;
          if (current.orders > acc.orders) return current;
          return acc;
        },
        null as OrdersTimelinePoint | null,
      )?.date;

      const smsSummary = {
        total: campaignSms.length,
        queued: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
      };
      const smsByType = { otp: 0, orderConfirmation: 0, bulk: 0 };
      const smsFailureReasons = new Map<string, { count: number; sampleIds: string[] }>();
      const smsTimelineMap = new Map<string, { delivered: number; failed: number }>();

      campaignSms.forEach((sms) => {
        switch (sms.status) {
          case SmsStatus.QUEUED:
            smsSummary.queued += 1;
            break;
          case SmsStatus.SENT:
            smsSummary.sent += 1;
            break;
          case SmsStatus.DELIVERED:
            smsSummary.delivered += 1;
            break;
          case SmsStatus.FAILED:
            smsSummary.failed += 1;
            break;
          default:
            break;
        }

        const type = this.classifySmsType(sms.body);
        smsByType[type] += 1;

        if (sms.status === SmsStatus.FAILED) {
          const reason = (sms.lastError || 'Unknown').trim() || 'Unknown';
          const existing = smsFailureReasons.get(reason) || { count: 0, sampleIds: [] };
          existing.count += 1;
          if (existing.sampleIds.length < 3) {
            existing.sampleIds.push(sms.id);
          }
          smsFailureReasons.set(reason, existing);

          const combinedReason = combinedSmsSummary.failureReasons.get(reason) || {
            count: 0,
            sampleIds: [],
          };
          combinedReason.count += 1;
          if (combinedReason.sampleIds.length < 3) {
            combinedReason.sampleIds.push(sms.id);
          }
          combinedSmsSummary.failureReasons.set(reason, combinedReason);
        }

        const inTimelineRange = sms.createdAt >= timelineStart;
        if (inTimelineRange) {
          const dateKey = this.formatSydneyDate(sms.createdAt);
          const bucket = smsTimelineMap.get(dateKey) || { delivered: 0, failed: 0 };
          if (sms.status === SmsStatus.DELIVERED) bucket.delivered += 1;
          if (sms.status === SmsStatus.FAILED) bucket.failed += 1;
          smsTimelineMap.set(dateKey, bucket);
        }

        if (sms.createdAt >= combinedStart) {
          const dateKey = this.formatSydneyDate(sms.createdAt);
          const bucket = combinedSmsTimeline.get(dateKey) || { delivered: 0, failed: 0 };
          if (sms.status === SmsStatus.DELIVERED) bucket.delivered += 1;
          if (sms.status === SmsStatus.FAILED) bucket.failed += 1;
          combinedSmsTimeline.set(dateKey, bucket);
        }

        combinedSmsSummary.total += 1;
        if (sms.status === SmsStatus.QUEUED) combinedSmsSummary.queued += 1;
        if (sms.status === SmsStatus.SENT) combinedSmsSummary.sent += 1;
        if (sms.status === SmsStatus.DELIVERED) combinedSmsSummary.delivered += 1;
        if (sms.status === SmsStatus.FAILED) combinedSmsSummary.failed += 1;
        combinedSmsSummary.byType[this.classifySmsType(sms.body)] += 1;
      });

      const smsTimeline = Array.from(smsTimelineMap.entries())
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const pickupRows = Array.from(pickupMap.values()).sort((a, b) => b.orders - a.orders);
      const topMealType = Object.entries(mealsByType).reduce(
        (acc, [meal, total]) => {
          if (!acc) return { meal, total };
          if (total > acc.total) return { meal, total };
          return acc;
        },
        null as { meal: string; total: number } | null,
      )?.meal;
      const topPickupLocation = pickupRows[0]?.name;

      const campaignEnd = campaign.endedAt ?? new Date();
      const durationMs = Math.abs(campaignEnd.getTime() - campaign.startedAt.getTime());
      const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

      const topMeals = [...pickupRows].sort((a, b) => b.meals - a.meals);

      return {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          state: campaign.state,
          startedAt: campaign.startedAt,
          frozenAt: campaign.frozenAt,
          endedAt: campaign.endedAt,
        },
        orders: {
          totalOrders,
          totalMeals,
          avgMealsPerOrder,
          medianMealsPerOrder,
          maxMealsInOrder,
          peakOrderDay: peakOrderDay || null,
          timeline: ordersTimeline,
        },
        meals: {
          totals: mealsByType,
        },
        pickupLocations: {
          rows: pickupRows,
          topOrders: pickupRows.slice(0, 10),
          topMeals: topMeals.slice(0, 10),
        },
        sms: {
          ...smsSummary,
          deliveryRate: smsSummary.total ? smsSummary.delivered / smsSummary.total : 0,
          failureRate: smsSummary.total ? smsSummary.failed / smsSummary.total : 0,
          byType: smsByType,
          timeline: smsTimeline,
          failureReasons: Array.from(smsFailureReasons.entries())
            .map(([reason, data]) => ({ reason, count: data.count, sampleIds: data.sampleIds }))
            .sort((a, b) => b.count - a.count),
        },
        dataQuality: {
          missingPickup,
          missingAddress: missingAddressCustomers.size,
          invalidMeals,
          postFreezeEdits,
          duplicateMobiles: false,
        },
        compare: {
          durationDays,
          topMealType: topMealType || 'N/A',
          topPickupLocation: topPickupLocation || 'N/A',
        },
      };
    });

    const combinedOrdersTimelineList = Array.from(combinedOrdersTimeline.entries())
      .map(([date, ordersCount]) => ({ date, orders: ordersCount }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const combinedSmsTimelineList = Array.from(combinedSmsTimeline.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const combinedPickupRows = Array.from(combinedPickup.values()).sort((a, b) => b.orders - a.orders);
    const combinedPickupByMeals = [...combinedPickupRows].sort((a, b) => b.meals - a.meals);

    const combinedTotalOrders = campaignStats.reduce((sum, stat) => sum + stat.orders.totalOrders, 0);
    const combinedTotalMeals = campaignStats.reduce((sum, stat) => sum + stat.orders.totalMeals, 0);
    const combinedAvgMealsPerOrder = combinedTotalOrders ? combinedTotalMeals / combinedTotalOrders : 0;
    const combinedMedianMealsPerOrder = this.median(combinedMealsPerOrder);
    const combinedMaxMealsInOrder = combinedMealsPerOrder.length
      ? Math.max(...combinedMealsPerOrder)
      : 0;
    const combinedPeakOrderDay = combinedOrdersTimelineList.reduce(
      (acc, current) => {
        if (!acc) return current;
        if (current.orders > acc.orders) return current;
        return acc;
      },
      null as OrdersTimelinePoint | null,
    )?.date;

    return {
      campaigns: campaignStats,
      combined: {
        orders: {
          totalOrders: combinedTotalOrders,
          totalMeals: combinedTotalMeals,
          avgMealsPerOrder: combinedAvgMealsPerOrder,
          medianMealsPerOrder: combinedMedianMealsPerOrder,
          maxMealsInOrder: combinedMaxMealsInOrder,
          peakOrderDay: combinedPeakOrderDay || null,
          timeline: combinedOrdersTimelineList,
        },
        meals: {
          totals: combinedMeals,
        },
        pickupLocations: {
          rows: combinedPickupRows,
          topOrders: combinedPickupRows.slice(0, 10),
          topMeals: combinedPickupByMeals.slice(0, 10),
        },
        sms: {
          total: combinedSmsSummary.total,
          queued: combinedSmsSummary.queued,
          sent: combinedSmsSummary.sent,
          delivered: combinedSmsSummary.delivered,
          failed: combinedSmsSummary.failed,
          deliveryRate: combinedSmsSummary.total
            ? combinedSmsSummary.delivered / combinedSmsSummary.total
            : 0,
          failureRate: combinedSmsSummary.total
            ? combinedSmsSummary.failed / combinedSmsSummary.total
            : 0,
          byType: combinedSmsSummary.byType,
          timeline: combinedSmsTimelineList,
          failureReasons: Array.from(combinedSmsSummary.failureReasons.entries())
            .map(([reason, data]) => ({ reason, count: data.count, sampleIds: data.sampleIds }))
            .sort((a, b) => b.count - a.count),
        },
      },
    };
  }

  async compareCampaigns(baselineCampaignId: string, compareCampaignIds: string[]) {
    const baselineId = (baselineCampaignId || '').trim();
    const compareIds = Array.from(
      new Set((compareCampaignIds || []).filter((id) => id && id !== baselineId)),
    );
    if (!baselineId) {
      throw new BadRequestException('Baseline campaign is required.');
    }
    if (!compareIds.length) {
      throw new BadRequestException('At least one compare campaign is required.');
    }

    const allIds = [baselineId, ...compareIds];
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: allIds } },
    });
    if (campaigns.length !== allIds.length) {
      throw new BadRequestException('Campaigns not found.');
    }

    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

    const orders = await this.prisma.order.findMany({
      where: { campaignId: { in: allIds }, deletedAt: null },
      select: {
        campaignId: true,
        customerId: true,
        chickenQty: true,
        fishQty: true,
        vegQty: true,
        eggQty: true,
        otherQty: true,
        customer: { select: { id: true, mobile: true, firstName: true, lastName: true } },
      },
    });

    const ordersByCampaign = new Map<string, typeof orders>();
    orders.forEach((order) => {
      const list = ordersByCampaign.get(order.campaignId) || [];
      list.push(order);
      ordersByCampaign.set(order.campaignId, list);
    });

    const buildCustomerMap = (campaignId: string) => {
      const campaignOrders = ordersByCampaign.get(campaignId) || [];
      const map = new Map<string, { customer: CustomerLite; meals: MealTotals }>();
      campaignOrders.forEach((order) => {
        if (!order.customer) return;
        map.set(order.customerId, {
          customer: {
            customerId: order.customer.id,
            mobile: order.customer.mobile || '',
            firstName: order.customer.firstName || '',
            lastName: order.customer.lastName || '',
          },
          meals: this.toMealTotals(order),
        });
      });
      return map;
    };

    const baselineMap = buildCustomerMap(baselineId);
    const baselineCustomers = Array.from(baselineMap.keys());

    const presenceDiff = compareIds.map((compareId) => {
      const compareMap = buildCustomerMap(compareId);
      const compareCustomers = Array.from(compareMap.keys());

      const newlyAddedCustomers: CustomerLite[] = [];
      const didNotOrderCustomers: CustomerLite[] = [];

      compareCustomers.forEach((customerId) => {
        if (!baselineMap.has(customerId)) {
          const entry = compareMap.get(customerId);
          if (entry) newlyAddedCustomers.push(entry.customer);
        }
      });

      baselineCustomers.forEach((customerId) => {
        if (!compareMap.has(customerId)) {
          const entry = baselineMap.get(customerId);
          if (entry) didNotOrderCustomers.push(entry.customer);
        }
      });

      return {
        compareCampaignId: compareId,
        newlyAddedCustomers,
        didNotOrderCustomers,
        counts: {
          baselineCustomers: baselineCustomers.length,
          compareCustomers: compareCustomers.length,
          newlyAdded: newlyAddedCustomers.length,
          didNotOrder: didNotOrderCustomers.length,
        },
      };
    });

    const perCustomerDelta = compareIds.map((compareId) => {
      const compareMap = buildCustomerMap(compareId);
      const compareTotalMeals = Array.from(compareMap.values()).reduce(
        (sum, entry) => sum + entry.meals.totalMeals,
        0,
      );

      const union = new Set<string>([...baselineMap.keys(), ...compareMap.keys()]);
      const rows = Array.from(union).map((customerId) => {
        const baselineEntry = baselineMap.get(customerId);
        const compareEntry = compareMap.get(customerId);
        const baselineMeals = baselineEntry?.meals ?? {
          chicken: 0,
          fish: 0,
          veg: 0,
          egg: 0,
          other: 0,
          totalMeals: 0,
        };
        const compareMeals = compareEntry?.meals ?? {
          chicken: 0,
          fish: 0,
          veg: 0,
          egg: 0,
          other: 0,
          totalMeals: 0,
        };
        const deltaMeals = {
          chicken: compareMeals.chicken - baselineMeals.chicken,
          fish: compareMeals.fish - baselineMeals.fish,
          veg: compareMeals.veg - baselineMeals.veg,
          egg: compareMeals.egg - baselineMeals.egg,
          other: compareMeals.other - baselineMeals.other,
          totalMeals: compareMeals.totalMeals - baselineMeals.totalMeals,
        };

        let classification: 'NEW' | 'DROPPED' | 'INCREASED' | 'DECREASED' | 'UNCHANGED' = 'UNCHANGED';
        if (!baselineEntry && compareEntry) {
          classification = 'NEW';
        } else if (baselineEntry && !compareEntry) {
          classification = 'DROPPED';
        } else if (compareMeals.totalMeals > baselineMeals.totalMeals) {
          classification = 'INCREASED';
        } else if (compareMeals.totalMeals < baselineMeals.totalMeals) {
          classification = 'DECREASED';
        }

        const customer = (compareEntry || baselineEntry)?.customer || {
          customerId,
          mobile: '',
          firstName: '',
          lastName: '',
        };

        return {
          customerId,
          mobile: customer.mobile,
          firstName: customer.firstName,
          lastName: customer.lastName,
          baseline: {
            hasOrder: !!baselineEntry,
            ...baselineMeals,
          },
          compare: {
            hasOrder: !!compareEntry,
            ...compareMeals,
          },
          delta: deltaMeals,
          deltaPct: {
            totalMealsPct:
              baselineMeals.totalMeals === 0
                ? null
                : (deltaMeals.totalMeals / baselineMeals.totalMeals) * 100,
          },
          classification,
        };
      });

      rows.sort((a, b) => Math.abs(b.delta.totalMeals) - Math.abs(a.delta.totalMeals));

      const summary = rows.reduce(
        (acc, row) => {
          acc.totalBaselineMeals += row.baseline.totalMeals;
          acc.totalCompareMeals += row.compare.totalMeals;
          acc.netMealChange += row.delta.totalMeals;
          switch (row.classification) {
            case 'NEW':
              acc.newCount += 1;
              break;
            case 'DROPPED':
              acc.droppedCount += 1;
              break;
            case 'INCREASED':
              acc.increasedCount += 1;
              break;
            case 'DECREASED':
              acc.decreasedCount += 1;
              break;
            case 'UNCHANGED':
              acc.unchangedCount += 1;
              break;
            default:
              break;
          }
          return acc;
        },
        {
          newCount: 0,
          droppedCount: 0,
          increasedCount: 0,
          decreasedCount: 0,
          unchangedCount: 0,
          netMealChange: 0,
          totalBaselineMeals: 0,
          totalCompareMeals: 0,
        },
      );

      return {
        compareCampaignId: compareId,
        rows,
        summary,
      };
    });

    const baseline = campaignById.get(baselineId);
    const compares = compareIds.map((id) => campaignById.get(id)).filter(Boolean);

    return {
      baseline: baseline
        ? {
            id: baseline.id,
            name: baseline.name,
            startedAt: baseline.startedAt,
            endedAt: baseline.endedAt,
            state: baseline.state,
          }
        : null,
      compares: compares.map((campaign) => ({
        id: campaign!.id,
        name: campaign!.name,
        startedAt: campaign!.startedAt,
        endedAt: campaign!.endedAt,
        state: campaign!.state,
      })),
      presenceDiff,
      perCustomerDelta,
    };
  }
}
