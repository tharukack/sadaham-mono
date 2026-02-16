import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CampaignState, Role, User } from '@prisma/client';
import { SmsService } from '../sms/sms.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService, private smsService: SmsService) {}

  private interpolateTemplate(body: string, order: any) {
    const mealCounts = {
      chicken: Number(order.chickenQty || 0),
      fish: Number(order.fishQty || 0),
      veg: Number(order.vegQty || 0),
      egg: Number(order.eggQty || 0),
      other: Number(order.otherQty || 0),
    };
    const mealCosts = {
      chicken: Number(order.campaign?.chickenCost || 0),
      fish: Number(order.campaign?.fishCost || 0),
      veg: Number(order.campaign?.vegCost || 0),
      egg: Number(order.campaign?.eggCost || 0),
      other: Number(order.campaign?.otherCost || 0),
    };
    const totalOrders =
      mealCounts.chicken + mealCounts.fish + mealCounts.veg + mealCounts.egg + mealCounts.other;
    const pickupByName = order.pickupByCustomer
      ? `${order.pickupByCustomer.firstName || ''} ${order.pickupByCustomer.lastName || ''}`.trim()
      : '';
    const customerName = order.customer
      ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim()
      : '';
    const createdByName = order.createdBy
      ? `${order.createdBy.firstName || ''} ${order.createdBy.lastName || ''}`.trim()
      : '';
    const createdByMobile = order.createdBy?.mobile || '';
    const mainCollectorName = order.createdBy?.mainCollector
      ? `${order.createdBy.mainCollector.firstName || ''} ${order.createdBy.mainCollector.lastName || ''}`.trim()
      : '';
    const mainCollectorLabel = mainCollectorName || createdByName;
    const mainCollectorMobile = order.createdBy?.mainCollector?.mobile || order.createdBy?.mobile || '';
    const pickupBySameAsCustomer =
      (order.pickupByCustomer?.id && order.customer?.id
        ? order.pickupByCustomer.id === order.customer.id
        : false) || (pickupByName && customerName && pickupByName === customerName);
    const notes = (order.note || '').toString().trim();
    const eventDate = order.campaign?.eventDate ? new Date(order.campaign.eventDate) : null;
    const eventDateLabel = eventDate ? eventDate.toISOString().slice(0, 10) : '';
    const lastDateForChanges = eventDate
      ? new Date(eventDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : '';
    const totalCost =
      mealCounts.chicken * mealCosts.chicken +
      mealCounts.fish * mealCosts.fish +
      mealCounts.veg * mealCosts.veg +
      mealCounts.egg * mealCosts.egg +
      mealCounts.other * mealCosts.other;
    const replacements: Record<string, string> = {
      '{{firstName}}': order.customer?.firstName || '',
      '{{lastName}}': order.customer?.lastName || '',
      '{{pickupLocation}}': order.pickupLocation?.name || '',
      '{{pickupAddress}}': order.pickupLocation?.address || '',
      '{{distributorName}}': order.pickupLocation?.distributorName || '',
      '{{distributorMobile}}': order.pickupLocation?.distributorMobile || '',
      '{{distributorAddress}}': order.pickupLocation?.address || '',
      '{{enteredByName}}': createdByName,
      '{{enteredByMobile}}': createdByMobile,
      '{{mainCollectorName}}': mainCollectorLabel || '',
      '{{mainCollectorMobile}}': mainCollectorMobile,
      '{{eventDate}}': eventDateLabel,
      '{{lastDateForChanges}}': lastDateForChanges,
      '{{totalCost}}': totalCost.toFixed(2),
      '{{campaignName}}': order.campaign?.name || '',
      '{{totalOrders}}': String(totalOrders),
      '{{chickenQty}}': String(mealCounts.chicken),
      '{{fishQty}}': String(mealCounts.fish),
      '{{vegQty}}': String(mealCounts.veg),
      '{{eggQty}}': String(mealCounts.egg),
      '{{otherQty}}': String(mealCounts.other),
      '{{chickenCost}}': String(mealCosts.chicken),
      '{{fishCost}}': String(mealCosts.fish),
      '{{vegCost}}': String(mealCosts.veg),
      '{{eggCost}}': String(mealCosts.egg),
      '{{otherCost}}': String(mealCosts.other),
      '{{notes}}': notes,
      '{{pickupBy}}': pickupByName,
      // Legacy placeholders (keep for backward compatibility)
      '{{nooforders}}': String(totalOrders),
      '{{numberofchicken}}': String(mealCounts.chicken),
      '{{numberoffish}}': String(mealCounts.fish),
      '{{numberofveg}}': String(mealCounts.veg),
      '{{numberofegg}}': String(mealCounts.egg),
      '{{numberofothers}}': String(mealCounts.other),
    };
    const optionalLineTokens: Array<{ tokens: string[]; omit: boolean }> = [
      { tokens: ['{{totalOrders}}', '{{nooforders}}'], omit: totalOrders === 0 },
      { tokens: ['{{chickenQty}}', '{{numberofchicken}}'], omit: mealCounts.chicken === 0 },
      { tokens: ['{{fishQty}}', '{{numberoffish}}'], omit: mealCounts.fish === 0 },
      { tokens: ['{{vegQty}}', '{{numberofveg}}'], omit: mealCounts.veg === 0 },
      { tokens: ['{{eggQty}}', '{{numberofegg}}'], omit: mealCounts.egg === 0 },
      { tokens: ['{{otherQty}}', '{{numberofothers}}'], omit: mealCounts.other === 0 },
      { tokens: ['{{notes}}'], omit: notes.length === 0 },
      { tokens: ['{{lastDateForChanges}}'], omit: !lastDateForChanges },
      { tokens: ['{{pickupBy}}'], omit: pickupBySameAsCustomer },
    ];
    const lines = body.split(/\r?\n/);
    const filtered: string[] = [];
    lines.forEach((line) => {
      const tokenRule = optionalLineTokens.find((rule) =>
        rule.tokens.some((token) => line.includes(token))
      );
      if (!tokenRule) {
        filtered.push(line);
        return;
      }
      if (!tokenRule.omit) {
        filtered.push(line);
        return;
      }
      if (tokenRule.tokens.includes('{{notes}}') || tokenRule.tokens.includes('{{pickupBy}}')) {
        const prev = filtered[filtered.length - 1];
        if (prev !== undefined && prev.trim().length === 0) {
          filtered.pop();
        }
      }
    });
    let result = filtered.join('\n');
    Object.entries(replacements).forEach(([token, value]) => {
      result = result.split(token).join(value);
    });
    return result;
  }

  private async sendOrderConfirmation(order: any) {
    const mobile = order?.customer?.mobile;
    if (!mobile) return;
    const template = await this.smsService.getTemplateByName('Order Confirmation');
    if (!template?.body) return;
    const body = this.interpolateTemplate(template.body, order);
    try {
      await this.smsService.send({
        body,
        to: [mobile],
        campaignId: order.campaignId,
        orderId: order.id,
        customerId: order.customerId,
      });
      return;
    } catch (err: any) {
      const message = err?.message || 'SMS send failed.';
      // Do not fail order creation if SMS fails.
      console.warn('[SMS] Order confirmation failed:', message);
      return message;
    }
  }

  private async sendOrderModified(order: any) {
    const mobile = order?.customer?.mobile;
    if (!mobile) return;
    const template = await this.smsService.getTemplateByName('Order Modified');
    if (!template?.body) return;
    const body = this.interpolateTemplate(template.body, order);
    try {
      await this.smsService.send({
        body,
        to: [mobile],
        campaignId: order.campaignId,
        orderId: order.id,
        customerId: order.customerId,
      });
      return;
    } catch (err: any) {
      const message = err?.message || 'SMS send failed.';
      // Do not fail order updates if SMS fails.
      console.warn('[SMS] Order modified failed:', message);
      return message;
    }
  }

  async list(user: User) {
    if (user.role === Role.ADMIN) {
      const orders = await this.prisma.order.findMany({
        include: {
          customer: true,
          pickupByCustomer: true,
          campaign: true,
          pickupLocation: true,
          createdBy: { include: { mainCollector: true } },
          updatedBy: { include: { mainCollector: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return this.attachSmsMessages(orders);
    }

    const current = await this.prisma.campaign.findFirst({
      where: { state: { in: [CampaignState.STARTED, CampaignState.FROZEN] } },
      orderBy: { startedAt: 'desc' },
    });
    if (!current) {
      return [];
    }
    const orders = await this.prisma.order.findMany({
      where: { campaignId: current.id },
      include: {
        customer: true,
        pickupByCustomer: true,
        campaign: true,
        pickupLocation: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.attachSmsMessages(orders);
  }

  async getById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        pickupByCustomer: true,
        campaign: true,
        pickupLocation: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
    });
    if (!order) return null;
    const [withSms] = await this.attachSmsMessages([order]);
    return withSms;
  }

  private async attachSmsMessages(orders: any[]) {
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

  async create(dto: CreateOrderDto, user: User) {
    const current = await this.prisma.campaign.findFirst({
      where: { state: { in: [CampaignState.STARTED, CampaignState.FROZEN] } },
      orderBy: { startedAt: 'desc' },
    });
    if (!current) {
      throw new BadRequestException('No active campaign to create orders.');
    }
    if (current.state === CampaignState.FROZEN && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can create orders in frozen campaigns.');
    }
    if (dto.campaignId && dto.campaignId !== current.id) {
      throw new BadRequestException('Orders can only be created for the current campaign.');
    }

    const existing = await this.prisma.order.findUnique({
      where: {
        campaignId_customerId: {
          campaignId: current.id,
          customerId: dto.customerId,
        },
      },
      include: {
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        campaign: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
    });
    if (existing) {
      if (existing.deletedAt) {
        const restored = await this.prisma.order.update({
          where: { id: existing.id },
          data: {
            pickupLocationId: dto.pickupLocationId,
            chickenQty: dto.chickenQty,
            fishQty: dto.fishQty,
            vegQty: dto.vegQty,
            eggQty: dto.eggQty,
            otherQty: dto.otherQty,
            pickupByCustomerId: dto.pickupByCustomerId ?? dto.customerId,
            note: dto.note ?? null,
            deletedAt: null,
            updatedById: user.id,
          },
          include: {
            customer: true,
            pickupByCustomer: true,
            pickupLocation: true,
            campaign: true,
            createdBy: { include: { mainCollector: true } },
            updatedBy: { include: { mainCollector: true } },
          },
        });
        const smsError = await this.sendOrderConfirmation(restored);
        return smsError ? { ...restored, smsError } : restored;
      }
      return existing;
    }

    const created = await this.prisma.order.create({
      data: {
        campaignId: current.id,
        customerId: dto.customerId,
        pickupByCustomerId: dto.pickupByCustomerId ?? dto.customerId,
        pickupLocationId: dto.pickupLocationId,
        chickenQty: dto.chickenQty,
        fishQty: dto.fishQty,
        vegQty: dto.vegQty,
        eggQty: dto.eggQty,
        otherQty: dto.otherQty,
        note: dto.note ?? null,
        createdById: user.id,
        updatedById: user.id,
      },
      include: {
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        campaign: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
    });
    const smsError = await this.sendOrderConfirmation(created);
    return smsError ? { ...created, smsError } : created;
  }

  async update(id: string, dto: UpdateOrderDto, user: User) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        campaign: true,
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
    });
    if (!order) {
      throw new BadRequestException('Order not found.');
    }
    if (order.deletedAt) {
      throw new BadRequestException('Deleted orders cannot be edited.');
    }
    const state = order.campaign.state as CampaignState;
    if (state === CampaignState.ENDED) {
      throw new ForbiddenException('Orders are read-only for ended campaigns.');
    }
    if (state === CampaignState.FROZEN && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can edit orders in frozen campaigns.');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        ...dto,
        pickupByCustomerId: dto.pickupByCustomerId ?? order.pickupByCustomerId ?? order.customerId,
        note: dto.note ?? order.note,
        updatedById: user.id,
      },
      include: {
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        campaign: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
    });
    const smsError = await this.sendOrderModified(updated);
    return smsError ? { ...updated, smsError } : updated;
  }

  async softDelete(id: string, user: User) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        campaign: true,
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
    });
    if (!order) {
      throw new BadRequestException('Order not found.');
    }
    if (order.deletedAt) {
      return order;
    }
    const state = order.campaign.state as CampaignState;
    if (state === CampaignState.ENDED) {
      throw new ForbiddenException('Orders are read-only for ended campaigns.');
    }
    if (state === CampaignState.FROZEN && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can edit orders in frozen campaigns.');
    }

    return this.prisma.order.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: user.id },
      include: {
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        campaign: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
    });
  }

  async restore(id: string, user: User) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        campaign: true,
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
    });
    if (!order) {
      throw new BadRequestException('Order not found.');
    }
    if (!order.deletedAt) {
      return order;
    }
    const state = order.campaign.state as CampaignState;
    if (state === CampaignState.ENDED) {
      throw new ForbiddenException('Orders are read-only for ended campaigns.');
    }
    if (state === CampaignState.FROZEN && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can edit orders in frozen campaigns.');
    }

    return this.prisma.order.update({
      where: { id },
      data: { deletedAt: null, updatedById: user.id },
      include: {
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        campaign: true,
        createdBy: { include: { mainCollector: true } },
        updatedBy: { include: { mainCollector: true } },
      },
    });
  }
}
