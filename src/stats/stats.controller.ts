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

  @Post('compare-campaigns')
  @Roles(Role.ADMIN)
  compareCampaigns(
    @Body()
    body: { baselineCampaignId?: string; compareCampaignIds?: string[] },
  ) {
    return this.statsService.compareCampaigns(
      body?.baselineCampaignId || '',
      body?.compareCampaignIds || [],
    );
  }
}
