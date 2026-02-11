import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '@prisma/client';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(RolesGuard)
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Post('campaigns')
  @Roles(Role.ADMIN)
  statsByCampaigns(@Body() body: { campaignIds?: string[] }) {
    return this.statsService.statsByCampaigns(body?.campaignIds || []);
  }
}
