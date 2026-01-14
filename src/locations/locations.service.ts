import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.pickupLocation.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateLocationDto) {
    return this.prisma.pickupLocation.create({ data: dto });
  }

  update(id: string, dto: UpdateLocationDto) {
    return this.prisma.pickupLocation.update({ where: { id }, data: dto });
  }
}
