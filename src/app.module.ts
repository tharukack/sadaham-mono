import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CustomersModule } from './customers/customers.module';
import { LocationsModule } from './locations/locations.module';
import { OrdersModule } from './orders/orders.module';
import { SmsModule } from './sms/sms.module';
import { AuditModule } from './audit/audit.module';
import { PrismaModule } from './common/utils/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CampaignsModule,
    CustomersModule,
    LocationsModule,
    OrdersModule,
    SmsModule,
    AuditModule,
  ],
})
export class AppModule {}
