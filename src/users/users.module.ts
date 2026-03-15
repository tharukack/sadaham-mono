import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../common/utils/prisma.module';
import { SmsModule } from '../sms/sms.module';
import { AuditModule } from '../audit/audit.module';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from '../common/security/security.module';

@Module({
  imports: [PrismaModule, SmsModule, AuditModule, ConfigModule, SecurityModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
