import { BadRequestException, Injectable } from '@nestjs/common';
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

  search(term: string, includeDeleted = false) {
    const normalizedTerm = normalizeAuMobile(term || '');
    return this.prisma.customer.findMany({
      where: {
        ...(includeDeleted ? {} : { deletedAt: null }),
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
    const normalizedMobile = normalizeAuMobile(dto.mobile || '');
    if (normalizedMobile) {
      const existing = this.prisma.customer.findFirst({
        where: { mobile: normalizedMobile },
        select: { id: true, deletedAt: true },
      });
      return existing.then((record) => {
        if (record) {
          if (record.deletedAt) {
            throw new BadRequestException(
              'Customer already in the system and deleted. Please restore the customer.',
            );
          }
          throw new BadRequestException('Customer already in the system.');
        }
        return this.prisma.customer.create({
          data: { ...dto, mobile: normalizedMobile, createdById: userId, updatedById: userId },
        });
      });
    }
    return this.prisma.customer.create({
      data: { ...dto, createdById: userId, updatedById: userId },
    });
  }

  async update(id: string, dto: UpdateCustomerDto, userId: string) {
    const normalizedMobile = normalizeAuMobile(dto.mobile || '');
    if (normalizedMobile) {
      const existing = await this.prisma.customer.findFirst({
        where: { mobile: normalizedMobile, NOT: { id } },
        select: { id: true, deletedAt: true },
      });
      if (existing) {
        if (existing.deletedAt) {
          throw new BadRequestException(
            'Customer already in the system and deleted. Please restore the customer.',
          );
        }
        throw new BadRequestException('Customer already in the system.');
      }
    }
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        mobile: normalizedMobile || dto.mobile,
        updatedById: userId,
      },
    });
  }

  softDelete(id: string, userId: string) {
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    });
  }

  restore(id: string, userId: string) {
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: null, updatedById: userId },
    });
  }
}
