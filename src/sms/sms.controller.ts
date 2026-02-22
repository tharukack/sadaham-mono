import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SmsService } from './sms.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { Request } from 'express';
import twilio from 'twilio';
import { ConfigService } from '@nestjs/config';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

@Controller('sms')
@UseGuards(RolesGuard)
export class SmsController {
  constructor(private smsService: SmsService, private configService: ConfigService) {}

  @Get('templates')
  @Roles(Role.ADMIN)
  listTemplates() {
    return this.smsService.listTemplates();
  }

  @Post('templates')
  @Roles(Role.ADMIN)
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.smsService.createTemplate(dto);
  }

  @Patch('templates/:id')
  @Roles(Role.ADMIN)
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.smsService.updateTemplate(id, dto);
  }

  @Post('send')
  @Roles(Role.ADMIN)
  send(@Body() dto: SendSmsDto) {
    return this.smsService.send(dto);
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.EDITOR, Role.VIEWER)
  stats(@Query('campaignId') campaignId?: string) {
    return this.smsService.stats(campaignId);
  }

  @Get('batches')
  @Roles(Role.ADMIN)
  listBatches(@Query('campaignId') campaignId?: string) {
    if (!campaignId) {
      return [];
    }
    return this.smsService.listBatches(campaignId);
  }

  @Get('batches/:id')
  @Roles(Role.ADMIN)
  getBatch(@Param('id') id: string) {
    return this.smsService.getBatch(id);
  }

  @Post('batches')
  @Roles(Role.ADMIN)
  createBatch(@Body() dto: CreateBatchDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.smsService.createBatch(dto.campaignId, dto.type, user?.id);
  }

  @Patch('batches/:id')
  @Roles(Role.ADMIN)
  updateBatch(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.smsService.updateBatchStatus(id, dto.status);
  }

  @Post('batches/:id/process')
  @Roles(Role.ADMIN)
  processBatch(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 10;
    return this.smsService.processBatch(id, Number.isNaN(parsed) ? 10 : parsed);
  }

  @Post('batches/:id/retry-failed')
  @Roles(Role.ADMIN)
  retryFailed(@Param('id') id: string) {
    return this.smsService.retryFailedBatch(id);
  }

  @Post('status-callback')
  async statusCallback(@Req() req: Request, @Body() body: Record<string, any>) {
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
    const publicUrl = this.configService.get<string>('PUBLIC_URL') || '';
    if (authToken && publicUrl) {
      const signature = String(req.headers['x-twilio-signature'] || '');
      const url = `${publicUrl.replace(/\/$/, '')}/sms/status-callback`;
      const isValid = twilio.validateRequest(authToken, signature, url, body);
      if (!isValid) {
        return { ok: false };
      }
    }
    return this.smsService.handleStatusCallback(body);
  }

  @Post('retry/:id')
  @Roles(Role.ADMIN)
  retry(@Param('id') id: string) {
    return this.smsService.retryMessage(id);
  }
}
