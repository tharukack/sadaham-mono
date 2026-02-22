import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeAuMobile } from '../../common/utils/phone';
import { SmsMessageType } from '@prisma/client';

export class SendSmsDto {
  @IsString()
  body!: string;

  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((entry) => normalizeAuMobile(entry)) : value
  )
  to!: string[];

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(SmsMessageType)
  type?: SmsMessageType;

  @IsOptional()
  @IsString()
  batchId?: string;
}
