import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RateLimitService } from '../common/security/rate-limit.service';

@Controller(['auth', ''])
export class AuthController {
  constructor(
    private authService: AuthService,
    private rateLimit: RateLimitService,
  ) {}

  private getClientIp(req: any) {
    const forwarded = req?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req?.ip || req?.socket?.remoteAddress || 'unknown';
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ip = this.getClientIp(req);
    const mobile = String(dto.mobile || '').trim() || 'unknown';
    this.rateLimit.assertAllowed(`auth:login:ip:${ip}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
      message: 'Too many login attempts. Try again later.',
    });
    this.rateLimit.assertAllowed(`auth:login:mobile:${mobile}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
      message: 'Too many login attempts for this user. Try again later.',
    });
    const result = await this.authService.login(dto);
    this.rateLimit.reset(`auth:login:mobile:${mobile}`);
    return result;
  }

  @Post('verify')
  async verify(@Body() dto: VerifyOtpDto, @Req() req: any) {
    const ip = this.getClientIp(req);
    const otpToken = String(dto.otpToken || '').trim() || 'unknown';
    this.rateLimit.assertAllowed(`auth:verify:ip:${ip}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
      message: 'Too many OTP verification attempts. Try again later.',
    });
    this.rateLimit.assertAllowed(`auth:verify:token:${otpToken}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
      message: 'Too many OTP attempts for this code. Try again later.',
    });
    const result = await this.authService.verify(dto);
    this.rateLimit.reset(`auth:verify:token:${otpToken}`);
    return result;
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    return this.verify(dto, req);
  }

  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    const userId = req?.user?.id;
    const sessionId = req?.sessionId;
    if (!userId || !sessionId) {
      throw new UnauthorizedException('Missing authenticated session');
    }
    const ip = this.getClientIp(req);
    this.rateLimit.assertAllowed(`auth:change-password:ip:${ip}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
      message: 'Too many password change attempts. Try again later.',
    });
    this.rateLimit.assertAllowed(`auth:change-password:user:${userId}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
      message: 'Too many password change attempts for this account. Try again later.',
    });
    const result = await this.authService.changePassword(userId, sessionId, dto);
    this.rateLimit.reset(`auth:change-password:user:${userId}`);
    return result;
  }

  @Post('logout')
  logout(@Req() req: any) {
    const userId = req?.user?.id;
    const sessionId = req?.sessionId;
    if (!userId || !sessionId) {
      throw new UnauthorizedException('Missing authenticated session');
    }
    return this.authService.logout(userId, sessionId);
  }
}
