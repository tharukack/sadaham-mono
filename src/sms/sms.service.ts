import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { ConfigService } from '@nestjs/config';
import { SmsBatchStatus, SmsMessageType, SmsStatus } from '@prisma/client';
import { normalizeAuMobile } from '../common/utils/phone';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { interpolateOrderTemplate } from './sms.utils';

type MobileMessageSendResult = {
  to?: string;
  status?: string;
  message_id?: string;
  custom_ref?: string;
  error?: string;
};

type MobileMessageSendResponse = {
  status?: string;
  send_id?: number;
  results?: MobileMessageSendResult[];
};

@Injectable()
export class SmsService {
  private readonly customerMessagesKey = 'customer_messages_enabled';
  private workerEnabled: boolean;
  private workerIntervalMs: number;
  private workerLimit: number;
  private workerTimer: NodeJS.Timeout | null = null;
  private workerRunning = false;
  private readonly mobileMessageApiUrl = 'https://api.mobilemessage.com.au/v1/messages';
  private readonly mobileMessageUsername: string;
  private readonly mobileMessagePassword: string;
  private readonly mobileMessageSenderId: string;

  constructor(private prisma: PrismaService, config: ConfigService) {
    this.workerEnabled = config.get<string>('SMS_BATCH_WORKER') !== 'false';
    this.workerIntervalMs = Number(config.get<string>('SMS_BATCH_WORKER_INTERVAL_MS') || 5000);
    this.workerLimit = Number(config.get<string>('SMS_BATCH_WORKER_LIMIT') || 10);
    this.mobileMessageUsername = config.get<string>('MM_USERNAME') || '';
    this.mobileMessagePassword = config.get<string>('MM_PASSWORD') || '';
    this.mobileMessageSenderId =
      config.get<string>('MM_SENDER_ID') ||
      config.get<string>('TWILIO_SENDER_ID') ||
      '';
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

  private isMobileMessageConfigured() {
    return Boolean(
      this.mobileMessageUsername && this.mobileMessagePassword && this.mobileMessageSenderId,
    );
  }

  private hasUnicode(text: string) {
    return /[^\u0000-\u007f]/.test(text);
  }

  private getMobileMessageAuthHeader() {
    const credentials = Buffer.from(
      `${this.mobileMessageUsername}:${this.mobileMessagePassword}`,
      'utf8',
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  private async sendViaMobileMessage(messages: Array<{ to: string; body: string; customRef: string }>) {
    if (!this.isMobileMessageConfigured()) {
      throw new Error('Mobile Message is not configured. Set MM_USERNAME, MM_PASSWORD, and MM_SENDER_ID.');
    }

    const response = await fetch(this.mobileMessageApiUrl, {
      method: 'POST',
      headers: {
        Authorization: this.getMobileMessageAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        enable_unicode: messages.some((message) => this.hasUnicode(message.body)),
        messages: messages.map((message) => ({
          to: message.to,
          message: message.body,
          sender: this.mobileMessageSenderId,
          custom_ref: message.customRef,
          unicode: this.hasUnicode(message.body) || undefined,
        })),
      }),
    });

    let payload: MobileMessageSendResponse | null = null;
    try {
      payload = (await response.json()) as MobileMessageSendResponse;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const remoteError = payload?.status || response.statusText || 'SMS send failed.';
      throw new Error(remoteError);
    }

    return payload;
  }

  private async sendSingleMessageRecord(message: { id: string; toMobile: string; body: string }) {
    try {
      const response = await this.sendViaMobileMessage([
        {
          to: message.toMobile,
          body: message.body,
          customRef: message.id,
        },
      ]);
      const result = response?.results?.[0];
      const wasSuccessful = result?.status === 'success' && !!result?.message_id;
      await this.prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          status: wasSuccessful ? SmsStatus.SENT : SmsStatus.FAILED,
          providerMessageId: result?.message_id || null,
          lastError: wasSuccessful ? null : result?.error || 'SMS send failed.',
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

  async send(dto: SendSmsDto) {
    const createdMessages = await Promise.all(
      dto.to.map(async (to) => {
        const normalizedTo = normalizeAuMobile(to) || to;
        return this.prisma.smsMessage.create({
          data: {
            toMobile: normalizedTo,
            body: dto.body,
            campaignId: dto.campaignId,
            orderId: dto.orderId,
            customerId: dto.customerId,
            batchId: dto.batchId,
            status: SmsStatus.SENT,
            type: dto.type,
          },
        });
      }),
    );

    try {
      const response = await this.sendViaMobileMessage(
        createdMessages.map((message) => ({
          to: message.toMobile,
          body: message.body,
          customRef: message.id,
        })),
      );
      const resultsByRef = new Map(
        (response?.results || []).map((result) => [result.custom_ref || '', result]),
      );
      await Promise.all(
        createdMessages.map(async (message) => {
          const result = resultsByRef.get(message.id);
          const wasSuccessful = result?.status === 'success' && !!result?.message_id;
          await this.prisma.smsMessage.update({
            where: { id: message.id },
            data: {
              status: wasSuccessful ? SmsStatus.SENT : SmsStatus.FAILED,
              providerMessageId: result?.message_id || null,
              lastError: wasSuccessful ? null : result?.error || 'SMS send failed.',
            },
          });
        }),
      );
    } catch (err: any) {
      await Promise.all(
        createdMessages.map((message) =>
          this.prisma.smsMessage.update({
            where: { id: message.id },
            data: {
              status: SmsStatus.FAILED,
              lastError: err?.message || 'SMS send failed.',
            },
          }),
        ),
      );
    }

    return { sent: createdMessages.length };
  }

  async getCustomerMessagesEnabled() {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: this.customerMessagesKey },
    });
    if (!setting) return true;
    return setting.value === 'true';
  }

  async setCustomerMessagesEnabled(enabled: boolean) {
    return this.prisma.appSetting.upsert({
      where: { key: this.customerMessagesKey },
      update: { value: enabled ? 'true' : 'false' },
      create: { key: this.customerMessagesKey, value: enabled ? 'true' : 'false' },
    });
  }

  private mapTypeToTemplateName(type: SmsMessageType) {
    if (type === 'ORDER_REMINDER') return 'Order Reminder';
    if (type === 'THANK_YOU') return 'Thank You Note';
    if (type === 'ORDER_CONFIRMATION') return 'Order Confirmation';
    if (type === 'ORDER_MODIFIED') return 'Order Modified';
    if (type === 'ORDER_DELETED') return 'Order Deleted';
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
    if (type !== 'ORDER_REMINDER' && type !== 'THANK_YOU') {
      throw new BadRequestException('Unsupported SMS batch type.');
    }
    const batchType = type as 'ORDER_REMINDER' | 'THANK_YOU';
    const existing = await this.prisma.smsBatch.findUnique({
      where: { campaignId_type: { campaignId, type: batchType } },
    });
    if (existing) {
      return this.buildBatchSummary(existing.id);
    }
    const templateName = this.mapTypeToTemplateName(batchType);
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
          type: batchType,
          status: SmsBatchStatus.COMPLETED,
          createdById: userId,
          completedAt: new Date(),
        },
      });
      return this.buildBatchSummary(batch.id);
    }

    const existingMessages = await this.prisma.smsMessage.findMany({
      where: { campaignId, type: batchType, orderId: { in: orders.map((order) => order.id) } },
      select: { orderId: true },
    });
    const seenOrders = new Set(existingMessages.map((msg) => msg.orderId).filter(Boolean));
    const eligibleOrders = orders.filter(
      (order) => order.customer?.mobile && !seenOrders.has(order.id),
    );

    const batch = await this.prisma.smsBatch.create({
      data: {
        campaignId,
        type: batchType,
        status: eligibleOrders.length ? SmsBatchStatus.RUNNING : SmsBatchStatus.COMPLETED,
        createdById: userId,
        startedAt: eligibleOrders.length ? new Date() : null,
        completedAt: eligibleOrders.length ? null : new Date(),
      },
    });

    if (eligibleOrders.length) {
      for (const order of eligibleOrders) {
        await this.send({
          to: [order.customer?.mobile || ''],
          body: interpolateOrderTemplate(template.body, order),
          campaignId: order.campaignId,
          orderId: order.id,
          customerId: order.customerId,
          batchId: batch.id,
          type: batchType,
        });
      }
    }
    await this.prisma.smsBatch.update({
      where: { id: batch.id },
      data: { status: SmsBatchStatus.COMPLETED, completedAt: new Date() },
    });

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
    await this.prisma.smsMessage.update({
      where: { id: message.id },
      data: {
        status: SmsStatus.SENT,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });

    await this.sendSingleMessageRecord(message);
  }

  async processBatch(id: string, limit = 10) {
    const batch = await this.prisma.smsBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new BadRequestException('SMS batch not found.');
    }
    return this.buildBatchSummary(id);
  }

  async retryFailedBatch(id: string) {
    const batch = await this.prisma.smsBatch.findUnique({ where: { id } });
    if (!batch) {
      throw new BadRequestException('SMS batch not found.');
    }
    const failedMessages = await this.prisma.smsMessage.findMany({
      where: { batchId: id, status: SmsStatus.FAILED },
      orderBy: { createdAt: 'asc' },
    });
    for (const message of failedMessages) {
      await this.sendMessageRecord(message);
    }
    await this.prisma.smsBatch.update({
      where: { id },
      data: { status: SmsBatchStatus.COMPLETED, completedAt: new Date() },
    });
    return this.buildBatchSummary(id);
  }

  async retryMessage(id: string) {
    const message = await this.prisma.smsMessage.findUnique({ where: { id } });
    if (!message) return { ok: false };
    await this.prisma.smsMessage.update({
      where: { id: message.id },
      data: {
        status: SmsStatus.SENT,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });

    await this.sendSingleMessageRecord(message);

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
