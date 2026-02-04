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
    const totalOrders =
      mealCounts.chicken + mealCounts.fish + mealCounts.veg + mealCounts.egg + mealCounts.other;
    const replacements: Record<string, string> = {
      '{{firstName}}': order.customer?.firstName || '',
      '{{lastName}}': order.customer?.lastName || '',
      '{{pickupLocation}}': order.pickupLocation?.name || '',
      '{{pickupAddress}}': order.pickupLocation?.address || '',
      '{{campaignName}}': order.campaign?.name || '',
      '{{nooforders}}': String(totalOrders),
      '{{numberofchicken}}': String(mealCounts.chicken),
      '{{numberoffish}}': String(mealCounts.fish),
      '{{numberofveg}}': String(mealCounts.veg),
      '{{numberofegg}}': String(mealCounts.egg),
      '{{numberofothers}}': String(mealCounts.other),
    };
    let result = body;
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
    await this.smsService.send({
      body,
      to: [mobile],
      campaignId: order.campaignId,
      orderId: order.id,
      customerId: order.customerId,
    });
  }

  async list(user: User) {
    if (user.role === Role.ADMIN) {
      const orders = await this.prisma.order.findMany({
        include: {
          customer: true,
          pickupByCustomer: true,
          campaign: true,
          pickupLocation: true,
          createdBy: true,
          updatedBy: true,
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
        createdBy: true,
        updatedBy: true,
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
        createdBy: true,
        updatedBy: true,
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
      where: { state: CampaignState.STARTED },
      orderBy: { startedAt: 'desc' },
    });
    if (!current) {
      throw new BadRequestException('No active campaign to create orders.');
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
        createdBy: true,
        updatedBy: true,
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
            createdBy: true,
            updatedBy: true,
          },
        });
        await this.sendOrderConfirmation(restored);
        return restored;
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
        createdBy: true,
        updatedBy: true,
      },
    });
    await this.sendOrderConfirmation(created);
    return created;
  }

  async update(id: string, dto: UpdateOrderDto, user: User) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        campaign: true,
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        createdBy: true,
        updatedBy: true,
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
        createdBy: true,
        updatedBy: true,
      },
    });
    await this.sendOrderConfirmation(updated);
    return updated;
  }

  async softDelete(id: string, user: User) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        campaign: true,
        customer: true,
        pickupByCustomer: true,
        pickupLocation: true,
        createdBy: true,
        updatedBy: true,
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
        createdBy: true,
        updatedBy: true,
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
        createdBy: true,
        updatedBy: true,
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
        createdBy: true,
        updatedBy: true,
      },
    });
  }
}
