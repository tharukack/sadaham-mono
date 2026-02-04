import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeAuMobile } from '../../common/utils/phone';

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
}
