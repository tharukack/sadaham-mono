import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.order.findMany({
      include: { customer: true, campaign: true, pickupLocation: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateOrderDto, userId: string) {
    return this.prisma.order.create({
      data: { ...dto, createdById: userId, updatedById: userId },
      include: { customer: true, pickupLocation: true, campaign: true },
    });
  }

  update(id: string, dto: UpdateOrderDto, userId: string) {
    return this.prisma.order.update({
      where: { id },
      data: { ...dto, updatedById: userId },
      include: { customer: true, pickupLocation: true, campaign: true },
    });
  }
}
