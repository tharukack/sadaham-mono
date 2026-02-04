import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { ConfigService } from '@nestjs/config';
import { SmsStatus } from '@prisma/client';
import twilio from 'twilio';
import { normalizeAuMobile, toE164AuMobile } from '../common/utils/phone';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class SmsService {
  private twilioClient: twilio.Twilio;
  private bypass: boolean;

  constructor(private prisma: PrismaService, config: ConfigService) {
    this.bypass = config.get<string>('TWILIO_BYPASS') === 'true';
    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID') || '';
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN') || '';
    if (accountSid && authToken && !this.bypass) {
      this.twilioClient = twilio(accountSid, authToken);
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
            status: this.bypass ? SmsStatus.SENT : SmsStatus.QUEUED,
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
