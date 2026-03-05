import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { normalizeAuMobile } from '../common/utils/phone';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

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
          { name: { contains: term, mode: 'insensitive' } },
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
        return this.prisma.customer
          .create({
            data: { ...dto, mobile: normalizedMobile, createdById: userId, updatedById: userId },
          })
          .then(async (created) => {
            await this.audit.log(userId, 'Customer', created.id, 'CUSTOMER_CREATED', {
              name: created.name,
              mobile: created.mobile,
              address: created.address || null,
            });
            return created;
          });
      });
    }
    return this.prisma.customer
      .create({
        data: { ...dto, createdById: userId, updatedById: userId },
      })
      .then(async (created) => {
        await this.audit.log(userId, 'Customer', created.id, 'CUSTOMER_CREATED', {
          name: created.name,
          mobile: created.mobile,
          address: created.address || null,
        });
        return created;
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
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        mobile: normalizedMobile || dto.mobile,
        updatedById: userId,
      },
    });
    await this.audit.log(userId, 'Customer', updated.id, 'CUSTOMER_UPDATED', {
      name: updated.name,
      mobile: updated.mobile,
      address: updated.address || null,
    });
    return updated;
  }

  async softDelete(id: string, userId: string) {
    const deleted = await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    });
    await this.audit.log(userId, 'Customer', deleted.id, 'CUSTOMER_DELETED', {});
    return deleted;
  }

  async restore(id: string, userId: string) {
    const restored = await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: null, updatedById: userId },
    });
    await this.audit.log(userId, 'Customer', restored.id, 'CUSTOMER_RESTORED', {});
    return restored;
  }
}
