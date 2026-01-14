import { Controller, Get } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  health() {
    return { status: 'ok' };
  }

  @Get('login')
  loginPlaceholder() {
    return { message: 'Login page not implemented in API' };
  }
}
