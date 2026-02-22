import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller(['auth', ''])
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify')
  verify(@Body() dto: VerifyOtpDto) {
    return this.authService.verify(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verify(dto);
  }

  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    const userId = req?.user?.id;
    const sessionId = req?.sessionId;
    if (!userId || !sessionId) {
      throw new UnauthorizedException('Missing authenticated session');
    }
    return this.authService.changePassword(userId, sessionId, dto);
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
