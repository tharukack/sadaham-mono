import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { promises as fs } from 'fs';
import path from 'path';

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

  async listBackups(params: { page: number; pageSize: number; sortDir: 'asc' | 'desc' }) {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSize =
      Number.isFinite(params.pageSize) && params.pageSize > 0
        ? Math.min(Math.floor(params.pageSize), 200)
        : 50;

    const runtimeDir = process.env.BACKUP_RUNTIME_DIR || path.resolve(process.cwd(), '.backup-runtime');
    const eventsFile = path.join(runtimeDir, 'backup-events.jsonl');
    const stateFile = path.join(runtimeDir, 'backup-state.json');

    const [eventsContent, stateContent] = await Promise.all([
      this.readOptionalFile(eventsFile),
      this.readOptionalFile(stateFile),
    ]);

    const items = eventsContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const left = new Date(a.checkedAt || a.uploadedAt || 0).getTime();
        const right = new Date(b.checkedAt || b.uploadedAt || 0).getTime();
        return params.sortDir === 'asc' ? left - right : right - left;
      });

    const total = items.length;
    const start = (page - 1) * pageSize;
    const pagedItems = items.slice(start, start + pageSize);
    const state = stateContent ? this.tryParseJson(stateContent) : null;

    return {
      total,
      page,
      pageSize,
      state,
      items: pagedItems,
    };
  }

  private async readOptionalFile(filePath: string) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }

  private tryParseJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}