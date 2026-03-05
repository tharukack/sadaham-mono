import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list() {
    return this.prisma.pickupLocation.findMany({
      orderBy: { name: 'asc' },
      include: { transporterCustomer: true, distributorCustomer: true },
    });
  }

  async create(dto: CreateLocationDto, actorUserId?: string) {
    const created = await this.prisma.pickupLocation.create({ data: dto });
    if (actorUserId) {
      await this.audit.log(actorUserId, 'PickupLocation', created.id, 'PICKUP_LOCATION_CREATED', {
        name: created.name,
        address: created.address,
        distributorName: created.distributorName,
        distributorMobile: created.distributorMobile,
        deliveryTimeMinutes: created.deliveryTimeMinutes,
        distributionPriority: created.distributionPriority,
      });
    }
    return created;
  }

  async update(id: string, dto: UpdateLocationDto, actorUserId?: string) {
    const updated = await this.prisma.pickupLocation.update({ where: { id }, data: dto });
    if (actorUserId) {
      await this.audit.log(actorUserId, 'PickupLocation', updated.id, 'PICKUP_LOCATION_UPDATED', {
        name: updated.name,
        address: updated.address,
        distributorName: updated.distributorName,
        distributorMobile: updated.distributorMobile,
        deliveryTimeMinutes: updated.deliveryTimeMinutes,
        distributionPriority: updated.distributionPriority,
      });
    }
    return updated;
  }
}
