import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('campaigns')
@UseGuards(RolesGuard)
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.campaignsService.findAll();
  }

  @Get('current')
  findCurrent() {
    return this.campaignsService.current();
  }

  @Get('last-ended')
  @Roles(Role.ADMIN, Role.EDITOR, Role.VIEWER)
  findLastEnded() {
    return this.campaignsService.lastEnded();
  }

  @Get(':id/stats')
  @Roles(Role.ADMIN, Role.EDITOR, Role.VIEWER)
  stats(@Param('id') id: string) {
    return this.campaignsService.stats(id);
  }

  @Get(':id/orders')
  @Roles(Role.ADMIN, Role.EDITOR, Role.VIEWER)
  listOrders(@Param('id') id: string) {
    return this.campaignsService.listOrders(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }
}
