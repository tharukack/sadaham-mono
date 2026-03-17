import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RateLimitService } from '../common/security/rate-limit.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { clearAuthCookie, setAuthCookie } from './auth-cookie';

@Controller(['auth', ''])
export class AuthController {
  constructor(
    private authService: AuthService,
    private rateLimit: RateLimitService,
    private config: ConfigService,
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
  async verify(@Body() dto: VerifyOtpDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
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
    setAuthCookie(res, result.accessToken, this.config);
    return {
      user: result.user,
      mustChangePassword: result.mustChangePassword,
      redirect: result.redirect,
    };
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    return this.verify(dto, req, res);
  }

  @Get('me')
  me(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const user = req?.user;
    const sessionId = req?.sessionId;
    if (!user || !sessionId) {
      clearAuthCookie(res, this.config);
      throw new UnauthorizedException('Missing authenticated session');
    }
    return {
      user: this.authService.buildUserSummary(user),
      sessionId,
      mustChangePassword: Boolean(user.mustChangePassword),
      redirect: user.mustChangePassword ? '/change-password' : '/dashboard',
    };
  }

  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req?.user?.id;
    const sessionId = req?.sessionId;
    if (!userId || !sessionId) {
      clearAuthCookie(res, this.config);
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
    setAuthCookie(res, result.accessToken, this.config);
    return { mustChangePassword: result.mustChangePassword };
  }

  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const userId = req?.user?.id;
    const sessionId = req?.sessionId;
    clearAuthCookie(res, this.config);
    if (!userId || !sessionId) {
      return { ok: true };
    }
    return this.authService.logout(userId, sessionId);
  }
}
