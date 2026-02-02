import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SmsService } from './sms.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('sms')
@UseGuards(RolesGuard)
export class SmsController {
  constructor(private smsService: SmsService) {}

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
}
