import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizeAuMobile } from '../common/utils/phone';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany();
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(dto: CreateUserDto) {
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
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          mobile: normalizedMobile || dto.mobile,
          email: dto.email,
          address: dto.address,
          role: dto.role,
          passwordHash,
        },
      });
      const mainCollectorId = dto.mainCollectorId ?? created.id;
      return tx.user.update({
        where: { id: created.id },
        data: { mainCollectorId },
      });
    });
  }

  async update(id: string, dto: UpdateUserDto) {
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
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, mobile: normalizedMobile || dto.mobile },
    });
  }
}
