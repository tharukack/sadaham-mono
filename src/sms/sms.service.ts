import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { ConfigService } from '@nestjs/config';
import { SmsStatus } from '@prisma/client';
import twilio from 'twilio';

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

  createTemplate(dto: CreateTemplateDto) {
    return this.prisma.smsTemplate.create({ data: dto });
  }

  async send(dto: SendSmsDto) {
    const sender = process.env.TWILIO_SENDER_ID;
    const messages = await Promise.all(
      dto.to.map(async (to) => {
        await this.prisma.smsMessage.create({
          data: {
            toMobile: to,
            body: dto.body,
            campaignId: dto.campaignId,
            status: this.bypass ? SmsStatus.SENT : undefined,
          },
        });
        if (this.twilioClient) {
          await this.twilioClient.messages.create({ from: sender, to, body: dto.body });
        }
        return to;
      }),
    );
    return { sent: messages.length };
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
