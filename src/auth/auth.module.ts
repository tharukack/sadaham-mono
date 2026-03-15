import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../common/utils/prisma.module';
import { SmsModule } from '../sms/sms.module';
import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../common/security/security.module';

@Module({
  imports: [PrismaModule, JwtModule.register({}), SmsModule, AuditModule, SecurityModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
