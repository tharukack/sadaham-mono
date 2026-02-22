import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizeAuMobile } from '../common/utils/phone';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { SmsService } from '../sms/sms.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private sms: SmsService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  findAll() {
    return this.prisma.user.findMany();
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  private generateTempPassword() {
    return randomBytes(12).toString('base64url').slice(0, 16);
  }

  async create(dto: CreateUserDto, actorUserId: string) {
    if (!actorUserId) {
      throw new BadRequestException('Missing authenticated user.');
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
    if (dto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: dto.email },
        select: { id: true },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already in the system.');
      }
    }
    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          mobile: normalizedMobile || dto.mobile,
          email: dto.email,
          address: dto.address,
          role: dto.role,
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

  async update(id: string, dto: UpdateUserDto, actorUserId?: string) {
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
    if (dto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
        select: { id: true },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already in the system.');
      }
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { ...dto, mobile: normalizedMobile || dto.mobile },
    });
    if (actorUserId) {
      await this.audit.log(actorUserId, 'User', id, 'USER_UPDATED', {
        updatedFields: Object.keys(dto),
      });
    }
    return updated;
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
