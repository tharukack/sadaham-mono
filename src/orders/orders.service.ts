import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CampaignState, Role, User } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async list(user: User) {
    if (user.role === Role.ADMIN) {
      return this.prisma.order.findMany({
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
    }

    const current = await this.prisma.campaign.findFirst({
      where: { state: { in: [CampaignState.STARTED, CampaignState.FROZEN] } },
      orderBy: { startedAt: 'desc' },
    });
    if (!current) {
      return [];
    }
    return this.prisma.order.findMany({
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
        return this.prisma.order.update({
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
      }
      return existing;
    }

    return this.prisma.order.create({
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

    return this.prisma.order.update({
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
