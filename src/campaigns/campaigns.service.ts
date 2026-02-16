import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignState } from '@prisma/client';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.campaign.findMany({ orderBy: { startedAt: 'desc' } });
  }

  current() {
    return this.prisma.campaign.findFirst({
      where: { state: { in: ['STARTED', 'FROZEN'] } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async listOrders(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new BadRequestException('Campaign not found.');
    }
    const orders = await this.prisma.order.findMany({
      where: { campaignId: id },
      include: { customer: true, pickupByCustomer: true, pickupLocation: true, createdBy: true, updatedBy: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!orders.length) return orders;
    const smsMessages = await this.prisma.smsMessage.findMany({
      where: { orderId: { in: orders.map((order) => order.id) } },
    });
    const smsByOrder = smsMessages.reduce<Record<string, any[]>>((acc, message) => {
      if (!message.orderId) return acc;
      acc[message.orderId] = acc[message.orderId] || [];
      acc[message.orderId].push(message);
      return acc;
    }, {});
    return orders.map((order) => ({
      ...order,
      smsMessages: smsByOrder[order.id] || [],
    }));
  }

  lastEnded() {
    return this.prisma.campaign.findFirst({
      where: { state: CampaignState.ENDED },
      orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }],
    });
  }

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

  private buildSmsStats(groups: { status: string; _count: { _all: number } }[]) {
    const summary = {
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    };
    groups.forEach((group) => {
      switch (group.status) {
        case 'QUEUED':
          summary.queued = group._count._all;
          break;
        case 'SENT':
          summary.sent = group._count._all;
          break;
        case 'DELIVERED':
          summary.delivered = group._count._all;
          break;
        case 'FAILED':
          summary.failed = group._count._all;
          break;
        default:
          break;
      }
    });
    return summary;
  }

  async stats(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new BadRequestException('Campaign not found.');
    }

    const totalOrders = await this.prisma.order.count({
      where: { campaignId: id, deletedAt: null },
    });

    const mealTotals = await this.prisma.order.aggregate({
      where: { campaignId: id, deletedAt: null },
      _sum: {
        chickenQty: true,
        fishQty: true,
        vegQty: true,
        eggQty: true,
        otherQty: true,
      },
    });

    const pickupGroups = await this.prisma.order.groupBy({
      by: ['pickupLocationId'],
      where: { campaignId: id, deletedAt: null },
      _count: { _all: true },
    });
    const pickupIds = pickupGroups.map((group) => group.pickupLocationId);
    const pickupLocations = await this.prisma.pickupLocation.findMany({
      where: { id: { in: pickupIds } },
      select: { id: true, name: true },
    });
    const pickupNameById = new Map(pickupLocations.map((loc) => [loc.id, loc.name]));

    const campaignEnd = campaign.endedAt ?? new Date();
    const campaignDurationMs = Math.abs(campaignEnd.getTime() - campaign.startedAt.getTime());
    const campaignDays = Math.ceil(campaignDurationMs / (1000 * 60 * 60 * 24));
    const startDate =
      campaignDays <= 30
        ? campaign.startedAt
        : new Date(campaignEnd.getTime() - 29 * 24 * 60 * 60 * 1000);

    const orderDates = await this.prisma.order.findMany({
      where: {
        campaignId: id,
        deletedAt: null,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
    });

    const dailyOrderMap = new Map<string, number>();
    orderDates.forEach((order) => {
      const day = this.formatSydneyDate(order.createdAt);
      dailyOrderMap.set(day, (dailyOrderMap.get(day) || 0) + 1);
    });
    const dailyOrders = Array.from(dailyOrderMap.entries())
      .map(([date, orders]) => ({ date, orders }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const smsGroups = await this.prisma.smsMessage.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: { _all: true },
    });

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        state: campaign.state,
        eventDate: campaign.eventDate,
        startedAt: campaign.startedAt,
        frozenAt: campaign.frozenAt,
        endedAt: campaign.endedAt,
        chickenCost: campaign.chickenCost,
        fishCost: campaign.fishCost,
        vegCost: campaign.vegCost,
        eggCost: campaign.eggCost,
        otherCost: campaign.otherCost,
      },
      orders: {
        totalOrders,
        totalCustomers: totalOrders,
        byPickupLocation: pickupGroups.map((group) => ({
          locationId: group.pickupLocationId,
          locationName: pickupNameById.get(group.pickupLocationId) || 'Unknown',
          orders: group._count._all,
        })),
        mealTotals: {
          chicken: mealTotals._sum.chickenQty ?? 0,
          fish: mealTotals._sum.fishQty ?? 0,
          veg: mealTotals._sum.vegQty ?? 0,
          egg: mealTotals._sum.eggQty ?? 0,
          other: mealTotals._sum.otherQty ?? 0,
        },
        dailyOrders,
      },
      sms: this.buildSmsStats(smsGroups),
    };
  }

  async create(dto: CreateCampaignDto) {
    const activeCampaign = await this.prisma.campaign.findFirst({
      where: { state: { in: ['STARTED', 'FROZEN'] } },
    });
    if (activeCampaign) {
      throw new BadRequestException('Active campaign already exists. End it before creating a new one.');
    }
    const data = {
      ...dto,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
    };
    return this.prisma.campaign.create({ data });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new BadRequestException('Campaign not found.');
    }

    if (dto.state) {
      const target = dto.state as CampaignState;
      const current = campaign.state as CampaignState;
      const allowedTransitions: Record<CampaignState, CampaignState[]> = {
        STARTED: [CampaignState.FROZEN, CampaignState.ENDED],
        FROZEN: [CampaignState.STARTED, CampaignState.ENDED],
        ENDED: [CampaignState.STARTED, CampaignState.FROZEN],
      };
      if (target === current) {
        return this.prisma.campaign.update({ where: { id }, data: dto });
      }
      if (!allowedTransitions[current].includes(target)) {
        throw new BadRequestException(`Invalid campaign state transition: ${current} -> ${target}.`);
      }

      if (target === CampaignState.FROZEN) {
        if (current !== CampaignState.STARTED) {
          throw new BadRequestException('Only STARTED campaigns can be frozen.');
        }
        const missingPickupCount = await this.prisma.order.count({
          where: {
            campaignId: id,
            deletedAt: null,
            OR: [{ pickupLocationId: '' }],
          },
        });
        if (missingPickupCount > 0) {
          throw new BadRequestException(
            `Cannot freeze campaign. ${missingPickupCount} orders are missing pickup locations.`,
          );
        }
      }

      if (target === CampaignState.STARTED || target === CampaignState.FROZEN) {
        const activeCampaign = await this.prisma.campaign.findFirst({
          where: {
            state: { in: ['STARTED', 'FROZEN'] },
            id: { not: id },
          },
        });
        if (activeCampaign) {
          throw new BadRequestException('Another active campaign exists. End it before starting this one.');
        }
      }

      if (target === CampaignState.ENDED) {
        dto = { ...dto, endedAt: new Date() } as UpdateCampaignDto & { endedAt: Date };
      }
      if (target === CampaignState.STARTED) {
        dto = { ...dto, endedAt: null } as UpdateCampaignDto & { endedAt: null };
      }
      if (target === CampaignState.FROZEN) {
        dto = { ...dto, frozenAt: new Date() } as UpdateCampaignDto & { frozenAt: Date };
      }
    }

    const data = {
      ...dto,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
    };
    return this.prisma.campaign.update({ where: { id }, data });
  }
}
