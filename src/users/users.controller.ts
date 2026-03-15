import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '@prisma/client';
import { RateLimitService } from '../common/security/rate-limit.service';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private rateLimit: RateLimitService,
  ) {}

  private getClientIp(req: any) {
    const forwarded = req?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req?.ip || req?.socket?.remoteAddress || 'unknown';
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateUserDto, @Req() req: any) {
    const actorUserId = req?.user?.id;
    const actorRole = req?.user?.role as Role | undefined;
    if (dto.role === Role.SUPERADMIN && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can create superadmins.');
    }
    return this.usersService.create(dto, actorUserId, actorRole);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    const actorUserId = req?.user?.id;
    const actorRole = req?.user?.role as Role | undefined;
    if (dto.role === Role.SUPERADMIN && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can assign the superadmin role.');
    }
    return this.usersService.update(id, dto, actorUserId, actorRole);
  }

  @Post(':id/reset-password')
  @Roles(Role.ADMIN)
  resetPassword(@Param('id') id: string, @Req() req: any) {
    const actorUserId = req?.user?.id;
    const ip = this.getClientIp(req);
    this.rateLimit.assertAllowed(`users:reset-password:ip:${ip}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
      message: 'Too many password reset requests. Try again later.',
    });
    this.rateLimit.assertAllowed(`users:reset-password:actor:${actorUserId || 'unknown'}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
      message: 'Too many password reset requests from this account. Try again later.',
    });
    this.rateLimit.assertAllowed(`users:reset-password:target:${id}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
      blockMs: 30 * 60 * 1000,
      message: 'Too many password reset requests for this user. Try again later.',
    });
    return this.usersService.resetPassword(id, actorUserId);
  }
}
