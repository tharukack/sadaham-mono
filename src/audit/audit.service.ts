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

  list() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
