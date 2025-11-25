import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/utils/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

@Injectable()
export class SmsService {
  private twilioClient: twilio.Twilio;

  constructor(private prisma: PrismaService, config: ConfigService) {
    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID') || '';
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN') || '';
    if (accountSid && authToken) {
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
}
