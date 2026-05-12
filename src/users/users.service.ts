import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { normalizeAuMobile } from '../common/utils/phone';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { SmsService } from '../sms/sms.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private sms: SmsService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  private generateTempPassword() {
    return randomBytes(6).toString('base64url').slice(0, 8);
  }

  private canRoleViewDispatch(role: Role, canViewDispatch?: boolean | null) {
    return role === Role.ADMIN || role === Role.SUPERADMIN || Boolean(canViewDispatch);
  }

  private withEffectiveDispatchAccess<T extends { role: Role; canViewDispatch?: boolean | null }>(
    user: T,
  ) {
    return {
      ...user,
      canViewDispatch: this.canRoleViewDispatch(user.role, user.canViewDispatch),
    };
  }

  async findAll() {
    const users = await this.prisma.user.findMany();
    return users.map((user) => this.withEffectiveDispatchAccess(user));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.withEffectiveDispatchAccess(user) : null;
  }

  async create(dto: CreateUserDto, actorUserId: string, actorRole?: Role) {
    if (!actorUserId) {
      throw new BadRequestException('Missing authenticated user.');
    }
    if (dto.role === Role.SUPERADMIN && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can create superadmins.');
    }
    const normalizedMobile = normalizeAuMobile(dto.mobile || '');
    if (normalizedMobile) {
      const existing = await this.prisma.user.findFirst({
        where: { mobile: normalizedMobile },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException('User already in the system.');
      }
    }
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName ?? '',
          mobile: normalizedMobile || dto.mobile,
          email: dto.email,
          address: dto.address,
          role: dto.role,
          canViewDispatch: this.canRoleViewDispatch(dto.role, dto.canViewDispatch),
          passwordHash,
          mustChangePassword: true,
          isActive: dto.isActive ?? true,
        },
      });
      const mainCollectorId = dto.mainCollectorId ?? created.id;
      const updated = await tx.user.update({
        where: { id: created.id },
        data: { mainCollectorId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mobile: true,
          email: true,
          address: true,
          role: true,
          canViewDispatch: true,
          isActive: true,
          mainCollectorId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          entityType: 'User',
          entityId: updated.id,
          action: 'USER_CREATED',
          diff: {
            id: updated.id,
            role: updated.role,
            mobile: updated.mobile,
            email: updated.email,
            isActive: updated.isActive,
            canViewDispatch: updated.canViewDispatch,
            mainCollectorId: updated.mainCollectorId,
          },
        },
      });
      return { user: updated, tempPassword };
    });
    const loginLink = this.config.get<string>('PUBLIC_URL')
      ? `${this.config.get<string>('PUBLIC_URL')!.replace(/\/$/, '')}/login`
      : 'https://yourdomain.com/login';
    await this.sms.send({
      to: [normalizedMobile || dto.mobile],
      body: `Welcome ${dto.firstName}.\nUsername: ${normalizedMobile || dto.mobile}\nTemp password: ${tempPassword}\nLogin: ${loginLink}\nYou will be asked to verify OTP and change your password.`,
    });
    return result;
  }

  async update(id: string, dto: UpdateUserDto, actorUserId?: string, actorRole?: Role) {
    const existingUser = await this.prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      throw new BadRequestException('User not found.');
    }
    if (existingUser.role === Role.SUPERADMIN && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can edit superadmin users.');
    }
    if (dto.role === Role.SUPERADMIN && actorRole !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can assign the superadmin role.');
    }
    const normalizedMobile = normalizeAuMobile(dto.mobile || '');
    if (normalizedMobile) {
      const existing = await this.prisma.user.findFirst({
        where: { mobile: normalizedMobile, NOT: { id } },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException('User already in the system.');
      }
    }
    const nextRole = dto.role ?? existingUser.role;
    const nextCanViewDispatch = this.canRoleViewDispatch(
      nextRole,
      dto.canViewDispatch ?? existingUser.canViewDispatch,
    );
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        role: nextRole,
        mobile: normalizedMobile || dto.mobile,
        canViewDispatch: nextCanViewDispatch,
      },
    });
    if (actorUserId) {
      await this.audit.log(actorUserId, 'User', id, 'USER_UPDATED', {
        updatedFields: Object.keys(dto),
      });
    }
    return this.withEffectiveDispatchAccess(updated);
  }

  async resetPassword(id: string, actorUserId: string) {
    if (!actorUserId) {
      throw new BadRequestException('Missing authenticated user.');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
    await this.prisma.userSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log(actorUserId, 'User', id, 'USER_PASSWORD_RESET', {
      userId: id,
      mobile: user.mobile,
      role: user.role,
    });
    const loginLink = this.config.get<string>('PUBLIC_URL') || 'https://yourdomain.com/login';
    await this.sms.send({
      to: [user.mobile],
      body: `Your password has been reset.\nUsername: ${user.mobile}\nTemp password: ${tempPassword}\nLogin: ${loginLink}\nYou will be asked to verify OTP and change your password.`,
    });
    return { userId: id, tempPassword };
  }
}
