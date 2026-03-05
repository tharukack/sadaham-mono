import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../common/utils/prisma.module';
import { SmsModule } from '../sms/sms.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, SmsModule, AuditModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
