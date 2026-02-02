import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { normalizeAuMobile } from '../common/utils/phone';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.customer.findMany({
      where: { deletedAt: null },
      include: { orders: true },
    });
  }

  search(term: string) {
    const normalizedTerm = normalizeAuMobile(term || '');
    return this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { mobile: { contains: term } },
          ...(normalizedTerm && normalizedTerm !== term
            ? [{ mobile: { contains: normalizedTerm } }]
            : []),
        ],
      },
      include: { createdBy: true },
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

  softDelete(id: string, userId: string) {
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    });
  }
}
