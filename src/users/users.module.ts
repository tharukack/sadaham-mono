import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../common/utils/prisma.module';
import { SmsModule } from '../sms/sms.module';
import { AuditModule } from '../audit/audit.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, SmsModule, AuditModule, ConfigModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
