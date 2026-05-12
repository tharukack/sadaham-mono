import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/utils/prisma.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { addMinutes, isBefore } from 'date-fns';
import { randomInt } from 'crypto';
import { SmsService } from '../sms/sms.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly maxActiveSessionsPerUser = 5;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private sms: SmsService,
    private audit: AuditService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { mobile: dto.mobile } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const otpCode = String(randomInt(100000, 999999));
    const expiresAt = addMinutes(new Date(), 5);
    const otp = await this.prisma.otpCode.create({
      data: { userId: user.id, code: otpCode, expiresAt },
    });
    await this.sms.send({
      to: [user.mobile],
      body: `Your verification code is ${otpCode}. It expires in 5 minutes.`,
    });
    return { message: 'OTP sent via SMS', expiresAt, otpToken: otp.id, next: 'VERIFY_OTP' };
  }

  buildUserSummary(user: {
    id: string;
    firstName: string;
    lastName: string;
    mobile: string;
    email: string | null;
    address: string | null;
    role: any;
    isActive: boolean;
    canViewDispatch?: boolean | null;
    mainCollectorId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      mobile: user.mobile,
      email: user.email,
      address: user.address,
      role: user.role,
      isActive: user.isActive,
      canViewDispatch:
        user.role === 'ADMIN' || user.role === 'SUPERADMIN' || Boolean(user.canViewDispatch),
      mainCollectorId: user.mainCollectorId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async verify(dto: VerifyOtpDto) {
    const activeOtp = await this.prisma.otpCode.findFirst({
      where: { id: dto.otpToken, consumedAt: null },
      include: { user: true },
    });
    if (!activeOtp || activeOtp.code !== dto.code) {
      throw new UnauthorizedException('Invalid OTP');
    }
    if (isBefore(activeOtp.expiresAt, new Date())) {
      throw new UnauthorizedException('OTP expired');
    }
    const user = activeOtp.user;
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.otpCode.update({
      where: { id: activeOtp.id },
      data: { consumedAt: new Date() },
    });
    const session = await this.prisma.userSession.create({
      data: { userId: user.id },
    });
    const activeSessions = await this.prisma.userSession.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const sessionsToRevoke = activeSessions.slice(this.maxActiveSessionsPerUser);
    if (sessionsToRevoke.length > 0) {
      await this.prisma.userSession.updateMany({
        where: { id: { in: sessionsToRevoke.map((item) => item.id) } },
        data: { revokedAt: new Date() },
      });
    }
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, sessionId: session.id, mustChangePassword: user.mustChangePassword },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: '24h' },
    );
    const userSummary = this.buildUserSummary(user);
    return {
      accessToken,
      sessionId: session.id,
      user: userSummary,
      mustChangePassword: user.mustChangePassword,
      redirect: user.mustChangePassword ? '/change-password' : '/dashboard',
    };
  }

  async changePassword(userId: string, sessionId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }
    if (user.mustChangePassword) {
      // Forced password setup uses the authenticated session as proof instead of re-entering the old password.
    } else {
      const valid = dto.currentPassword
        ? await bcrypt.compare(dto.currentPassword, user.passwordHash)
        : false;
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await this.audit.log(userId, 'User', userId, 'PASSWORD_CHANGED', {});
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, sessionId, mustChangePassword: false },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: '24h' },
    );
    return { accessToken, mustChangePassword: false };
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log(userId, 'UserSession', sessionId, 'SESSION_REVOKED', {});
    return { ok: true };
  }
}
