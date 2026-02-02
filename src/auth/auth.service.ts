import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/utils/prisma.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { addMinutes, isBefore } from 'date-fns';
import { randomInt } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
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
    const expiresAt = addMinutes(new Date(), 10);
    await this.prisma.otpCode.create({
      data: { userId: user.id, code: otpCode, expiresAt },
    });
    if (this.config.get<string>('TWILIO_BYPASS') === 'true') {
      return { message: 'OTP bypass enabled for testing', code: otpCode, expiresAt };
    }
    return { message: 'OTP sent via SMS', expiresAt };
  }

  async verify(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { mobile: dto.mobile } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // Bypass OTP for specific test account
    const bypassMobile = '0400000001';
    const bypassCode = '123456';

    if (dto.mobile === bypassMobile && dto.code === bypassCode) {
      await this.prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const session = await this.prisma.userSession.create({
        data: { userId: user.id },
      });
      const token = await this.jwt.signAsync(
        { sub: user.id, role: user.role },
        { secret: this.config.get<string>('JWT_SECRET'), expiresIn: '12h' },
      );
      return { token, sessionId: session.id, user, bypass: true, redirect: '/dashboard' };
    }

    const activeOtp = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!activeOtp || activeOtp.code !== dto.code) {
      throw new UnauthorizedException('Invalid OTP');
    }
    if (isBefore(activeOtp.expiresAt, new Date())) {
      throw new UnauthorizedException('OTP expired');
    }
    await this.prisma.otpCode.update({
      where: { id: activeOtp.id },
      data: { consumedAt: new Date() },
    });
    await this.prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const session = await this.prisma.userSession.create({
      data: { userId: user.id },
    });
    const token = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: '12h' },
    );
    return { token, sessionId: session.id, user, redirect: '/dashboard' };
  }
}
