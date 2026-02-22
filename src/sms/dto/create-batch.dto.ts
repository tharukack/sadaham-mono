import { IsEnum, IsString } from 'class-validator';
import { SmsMessageType } from '@prisma/client';

export class CreateBatchDto {
  @IsString()
  campaignId!: string;

  @IsEnum(SmsMessageType)
  type!: SmsMessageType;
}
