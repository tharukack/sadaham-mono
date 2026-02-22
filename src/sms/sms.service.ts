import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { ConfigService } from '@nestjs/config';
import { SmsBatchStatus, SmsMessageType, SmsStatus } from '@prisma/client';
import twilio from 'twilio';
import { normalizeAuMobile, toE164AuMobile } from '../common/utils/phone';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { interpolateOrderTemplate } from './sms.utils';

@Injectable()
export class SmsService {
  private twilioClient: twilio.Twilio;
  private bypass: boolean;
  private workerEnabled: boolean;
  private workerIntervalMs: number;
  private workerLimit: number;
  private workerTimer: NodeJS.Timeout | null = null;
  private workerRunning = false;

  constructor(private prisma: PrismaService, config: ConfigService) {
    this.bypass = config.get<string>('TWILIO_BYPASS') === 'true';
    this.workerEnabled = config.get<string>('SMS_BATCH_WORKER') !== 'false';
    this.workerIntervalMs = Number(config.get<string>('SMS_BATCH_WORKER_INTERVAL_MS') || 5000);
    this.workerLimit = Number(config.get<string>('SMS_BATCH_WORKER_LIMIT') || 10);
    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID') || '';
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN') || '';
    if (accountSid && authToken && !this.bypass) {
      this.twilioClient = twilio(accountSid, authToken);
    }
  }

  onModuleInit() {
    if (!this.workerEnabled) return;
    if (this.workerTimer) return;
    const interval = Number.isFinite(this.workerIntervalMs) && this.workerIntervalMs > 0
      ? this.workerIntervalMs
      : 5000;
    this.workerTimer = setInterval(() => {
      void this.processRunningBatches();
    }, interval);
  }

  onModuleDestroy() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  private async processRunningBatches() {
    if (this.workerRunning) return;
    this.workerRunning = true;
    try {
      const batches = await this.prisma.smsBatch.findMany({
        where: {
          status: SmsBatchStatus.RUNNING,
          messages: { some: { status: SmsStatus.QUEUED } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!batches.length) return;
      const limit = Number.isFinite(this.workerLimit) && this.workerLimit > 0 ? this.workerLimit : 10;
      for (const batch of batches) {
        await this.processBatch(batch.id, limit);
      }
    } finally {
      this.workerRunning = false;
    }
  }

  listTemplates() {
    return this.prisma.smsTemplate.findMany();
  }

  getTemplateByName(name: string) {
    return this.prisma.smsTemplate.findUnique({ where: { name } });
  }

  createTemplate(dto: CreateTemplateDto) {
    return this.prisma.smsTemplate.create({ data: dto });
  }

  updateTemplate(id: string, dto: UpdateTemplateDto) {
    return this.prisma.smsTemplate.update({
      where: { id },
      data: { body: dto.body },
    });
  }

  async send(dto: SendSmsDto) {
    const sender = process.env.TWILIO_SENDER_ID;
    const messages = await Promise.all(
      dto.to.map(async (to) => {
        const normalizedTo = normalizeAuMobile(to) || to;
        const message = await this.prisma.smsMessage.create({
          data: {
            toMobile: normalizedTo,
            body: dto.body,
            campaignId: dto.campaignId,
            orderId: dto.orderId,
            customerId: dto.customerId,
            batchId: dto.batchId,
            status: this.bypass ? SmsStatus.SENT : SmsStatus.QUEUED,
            type: dto.type,
          },
        });
        if (this.twilioClient) {
          const toE164 = toE164AuMobile(normalizedTo);
          const callbackBase = process.env.PUBLIC_URL || '';
          const statusCallback = callbackBase
            ? `${callbackBase.replace(/\/$/, '')}/sms/status-callback`
            : undefined;
          const response = await this.twilioClient.messages.create({
            from: sender,
            to: toE164,
            body: dto.body,
            statusCallback,
          });
          await this.prisma.smsMessage.update({
            where: { id: message.id },
            data: {
              status: SmsStatus.SENT,
              providerMessageId: response.sid,
            },
          });
        }
        return normalizedTo;
      }),
    );
    return { sent: messages.length };
  }

  private mapTypeToTemplateName(type: SmsMessageType) {
    if (type === SmsMessageType.ORDER_REMINDER) return 'Order Reminder';
    if (type === SmsMessageType.THANK_YOU) return 'Thank You Note';
    if (type === SmsMessageType.ORDER_CONFIRMATION) return 'Order Confirmation';
    if (type === SmsMessageType.ORDER_MODIFIED) return 'Order Modified';
    return '';
  }

  private async buildBatchSummary(batchId: string) {
    const batch = await this.prisma.smsBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return null;
    }
    const groups = await this.prisma.smsMessage.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { _all: true },
    });
    const counts = {
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      total: 0,
    };
    groups.forEach((group) => {
      counts.total += group._count._all;
      switch (group.status) {
        case SmsStatus.QUEUED:
          counts.queued = group._count._all;
          break;
        case SmsStatus.SENT:
          counts.sent = group._count._all;
          break;
        case SmsStatus.DELIVERED:
          counts.delivered = group._count._all;
          break;
        case SmsStatus.FAILED:
          counts.failed = group._count._all;
          break;
        default:
          break;
      }
    });
    const completed = counts.total - counts.queued;
    const percent = counts.total ? Math.round((completed / counts.total) * 100) : 0;
    return {
      ...batch,
      counts,
      progress: {
        completed,
        total: counts.total,
        percent,
      },
      isComplete: counts.total === 0 ? batch.status === SmsBatchStatus.COMPLETED : counts.queued === 0,
      isSuccess:
        counts.total > 0 && counts.queued === 0 && counts.failed === 0 && batch.status === SmsBatchStatus.COMPLETED,
      templateName: this.mapTypeToTemplateName(batch.type),
    };
  }

  async listBatches(campaignId: string) {
    const batches = await this.prisma.smsBatch.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
    });
    const summaries = await Promise.all(batches.map((batch) => this.buildBatchSummary(batch.id)));
    return summaries.filter(Boolean);
  }

  async getBatch(id: string) {
    return this.buildBatchSummary(id);
  }

  async createBatch(campaignId: string, type: SmsMessageType, userId?: string) {
    if (![SmsMessageType.ORDER_REMINDER, SmsMessageType.THANK_YOU].includes(type)) {
      throw new BadRequestException('Unsupported SMS batch type.');
    }
    const existing = await this.prisma.smsBatch.findUnique({
      where: { campaignId_type: { campaignId, type } },
    });
    if (existing) {
      return this.buildBatchSummary(existing.id);
    }
    const templateName = this.mapTypeToTemplateName(type);
    const template = templateName ? await this.getTemplateByName(templateName) : null;
    if (!template?.body) {
      throw new BadRequestException('SMS template is not configured.');
    }

    const orders = await this.prisma.order.findMany({
      where: { campaignId, deletedAt: null },
      include: {
        customer: true,
        pickupByCustomer: true,
        campaign: true,
        pickupLocation: true,
        createdBy: { include: { mainCollector: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!orders.length) {
      const batch = await this.prisma.smsBatch.create({
        data: {
          campaignId,
          type,
          status: SmsBatchStatus.COMPLETED,
          createdById: userId,
          completedAt: new Date(),
        },
      });
      return this.buildBatchSummary(batch.id);
    }

    const existingMessages = await this.prisma.smsMessage.findMany({
      where: { campaignId, type, orderId: { in: orders.map((order) => order.id) } },
      select: { orderId: true },
    });
    const seenOrders = new Set(existingMessages.map((msg) => msg.orderId).filter(Boolean));
    const eligibleOrders = orders.filter(
      (order) => order.customer?.mobile && !seenOrders.has(order.id),
    );

    const batch = await this.prisma.smsBatch.create({
      data: {
        campaignId,
        type,
        status: eligibleOrders.length ? SmsBatchStatus.RUNNING : SmsBatchStatus.COMPLETED,
        createdById: userId,
        startedAt: eligibleOrders.length ? new Date() : null,
        completedAt: eligibleOrders.length ? null : new Date(),
      },
    });

    if (eligibleOrders.length) {
      const messages = eligibleOrders.map((order) => {
        const normalizedTo = normalizeAuMobile(order.customer?.mobile || '') || order.customer?.mobile || '';
        return {
          batchId: batch.id,
          campaignId: order.campaignId,
          orderId: order.id,
          customerId: order.customerId,
          toMobile: normalizedTo,
          body: interpolateOrderTemplate(template.body, order),
          status: this.bypass ? SmsStatus.SENT : SmsStatus.QUEUED,
          type,
        };
      });
      await this.prisma.smsMessage.createMany({ data: messages });
      if (this.bypass) {
        await this.prisma.smsBatch.update({
          where: { id: batch.id },
          data: { status: SmsBatchStatus.COMPLETED, completedAt: new Date() },
        });
      }
    }

    return this.buildBatchSummary(batch.id);
  }

  async updateBatchStatus(id: string, status: SmsBatchStatus) {
    const batch = await this.prisma.smsBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new BadRequestException('SMS batch not found.');
    }
    const data: Record<string, any> = { status };
    if (status === SmsBatchStatus.RUNNING && !batch.startedAt) {
      data.startedAt = new Date();
    }
    if (status === SmsBatchStatus.COMPLETED) {
      data.completedAt = new Date();
    }
    await this.prisma.smsBatch.update({ where: { id }, data });
    return this.buildBatchSummary(id);
  }

  private async sendMessageRecord(message: any) {
    const toE164 = toE164AuMobile(message.toMobile);
    const callbackBase = process.env.PUBLIC_URL || '';
    const statusCallback = callbackBase
      ? `${callbackBase.replace(/\/$/, '')}/sms/status-callback`
      : undefined;
    await this.prisma.smsMessage.update({
      where: { id: message.id },
      data: {
        status: this.bypass ? SmsStatus.SENT : SmsStatus.QUEUED,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });

    if (!this.twilioClient) {
      if (this.bypass) {
        await this.prisma.smsMessage.update({
          where: { id: message.id },
          data: { status: SmsStatus.SENT },
        });
      }
      return;
    }

    try {
      const response = await this.twilioClient.messages.create({
        from: process.env.TWILIO_SENDER_ID,
        to: toE164,
        body: message.body,
        statusCallback,
      });
      await this.prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          status: SmsStatus.SENT,
          providerMessageId: response.sid,
        },
      });
    } catch (err: any) {
      await this.prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          status: SmsStatus.FAILED,
          lastError: err?.message || 'SMS send failed.',
        },
      });
    }
  }

  async processBatch(id: string, limit = 10) {
    const batch = await this.prisma.smsBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new BadRequestException('SMS batch not found.');
    }
    if (batch.status !== SmsBatchStatus.RUNNING) {
      return this.buildBatchSummary(id);
    }
    const messages = await this.prisma.smsMessage.findMany({
      where: { batchId: id, status: SmsStatus.QUEUED },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    for (const message of messages) {
      const latest = await this.prisma.smsBatch.findUnique({ where: { id } });
      if (!latest || latest.status !== SmsBatchStatus.RUNNING) {
        break;
      }
      await this.sendMessageRecord(message);
    }

    const summary = await this.buildBatchSummary(id);
    if (summary && summary.counts.queued === 0 && batch.status === SmsBatchStatus.RUNNING) {
      await this.prisma.smsBatch.update({
        where: { id },
        data: { status: SmsBatchStatus.COMPLETED, completedAt: new Date() },
      });
    }
    return this.buildBatchSummary(id);
  }

  async retryFailedBatch(id: string) {
    const batch = await this.prisma.smsBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new BadRequestException('SMS batch not found.');
    }
    await this.prisma.smsMessage.updateMany({
      where: { batchId: id, status: SmsStatus.FAILED },
      data: {
        status: SmsStatus.QUEUED,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });
    await this.prisma.smsBatch.update({
      where: { id },
      data: { status: SmsBatchStatus.RUNNING, completedAt: null },
    });
    return this.processBatch(id, 10);
  }

  async handleStatusCallback(payload: Record<string, any>) {
    const status = String(payload.MessageStatus || '').toLowerCase();
    const sid = String(payload.MessageSid || '');
    if (!sid) {
      return { ok: true };
    }

    const mapped =
      status === 'delivered'
        ? SmsStatus.DELIVERED
        : status === 'sent'
        ? SmsStatus.SENT
        : status === 'failed' || status === 'undelivered'
        ? SmsStatus.FAILED
        : status === 'queued' || status === 'accepted' || status === 'sending'
        ? SmsStatus.QUEUED
        : undefined;

    if (!mapped) {
      return { ok: true };
    }

    await this.prisma.smsMessage.updateMany({
      where: { providerMessageId: sid },
      data: { status: mapped },
    });

    return { ok: true };
  }

  async retryMessage(id: string) {
    const message = await this.prisma.smsMessage.findUnique({ where: { id } });
    if (!message) return { ok: false };
    const toE164 = toE164AuMobile(message.toMobile);
    const callbackBase = process.env.PUBLIC_URL || '';
    const statusCallback = callbackBase
      ? `${callbackBase.replace(/\/$/, '')}/sms/status-callback`
      : undefined;

    await this.prisma.smsMessage.update({
      where: { id: message.id },
      data: {
        status: SmsStatus.QUEUED,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });

    if (this.twilioClient) {
      const response = await this.twilioClient.messages.create({
        from: process.env.TWILIO_SENDER_ID,
        to: toE164,
        body: message.body,
        statusCallback,
      });
      await this.prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          status: SmsStatus.SENT,
          providerMessageId: response.sid,
        },
      });
    }

    return { ok: true };
  }

  async stats(campaignId?: string) {
    const groups = await this.prisma.smsMessage.groupBy({
      by: ['status'],
      where: campaignId ? { campaignId } : undefined,
      _count: { _all: true },
    });

    const summary = {
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    };

    groups.forEach((group) => {
      switch (group.status) {
        case SmsStatus.QUEUED:
          summary.queued = group._count._all;
          break;
        case SmsStatus.SENT:
          summary.sent = group._count._all;
          break;
        case SmsStatus.DELIVERED:
          summary.delivered = group._count._all;
          break;
        case SmsStatus.FAILED:
          summary.failed = group._count._all;
          break;
        default:
          break;
      }
    });

    return summary;
  }
}
