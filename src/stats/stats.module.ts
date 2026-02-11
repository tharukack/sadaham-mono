import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/utils/prisma.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [PrismaModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
