import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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

  @Get('main-collectors')
  @Roles(Role.ADMIN)
  listMainCollectors() {
    return this.statsService.listMainCollectors();
  }

  @Post('main-collector-customers')
  @Roles(Role.ADMIN)
  mainCollectorCustomers(
    @Body()
    body: { mainCollectorId?: string; baselineCampaignId?: string; compareCampaignId?: string },
  ) {
    return this.statsService.mainCollectorCustomers(
      body?.mainCollectorId || '',
      body?.baselineCampaignId || '',
      body?.compareCampaignId || '',
    );
  }
}
