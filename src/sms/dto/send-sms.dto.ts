import { IsArray, IsOptional, IsString } from 'class-validator';

export class SendSmsDto {
  @IsString()
  body!: string;

  @IsArray()
  to!: string[];

  @IsOptional()
  @IsString()
  campaignId?: string;
}
