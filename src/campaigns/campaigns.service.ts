import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.campaign.findMany({ orderBy: { startedAt: 'desc' } });
  }

  current() {
    return this.prisma.campaign.findFirst({ where: { state: 'STARTED' } });
  }

  create(dto: CreateCampaignDto) {
    return this.prisma.campaign.create({ data: dto });
  }

  update(id: string, dto: UpdateCampaignDto) {
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }
}
