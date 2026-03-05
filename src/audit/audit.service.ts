import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(actorUserId: string, entityType: string, entityId: string, action: string, diff?: any) {
    return this.prisma.auditLog.create({
      data: { actorUserId, entityType, entityId, action, diff },
    });
  }

  async list(params: { page: number; pageSize: number; sortDir: 'asc' | 'desc' }) {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSize =
      Number.isFinite(params.pageSize) && params.pageSize > 0
        ? Math.min(Math.floor(params.pageSize), 200)
        : 50;
    const skip = (page - 1) * pageSize;
    const where = { entityType: { in: ['Order', 'User', 'Customer', 'Campaign', 'PickupLocation'] } };

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: params.sortDir },
        skip,
        take: pageSize,
      }),
    ]);

    const userIds = Array.from(new Set(logs.map((log) => log.actorUserId).filter(Boolean)));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, email: true, mobile: true },
        })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    return {
      total,
      page,
      pageSize,
      items: logs.map((log) => ({
        ...log,
        actorUser: userById.get(log.actorUserId) || null,
      })),
    };
  }
}
