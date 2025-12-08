import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.customer.findMany({ include: { orders: true } });
  }

  search(term: string) {
    return this.prisma.customer.findMany({
      where: {
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { mobile: { contains: term } },
        ],
      },
    });
  }

  create(dto: CreateCustomerDto, userId: string) {
    return this.prisma.customer.create({
      data: { ...dto, createdById: userId, updatedById: userId },
    });
  }

  update(id: string, dto: UpdateCustomerDto, userId: string) {
    return this.prisma.customer.update({
      where: { id },
      data: { ...dto, updatedById: userId },
    });
  }
}
