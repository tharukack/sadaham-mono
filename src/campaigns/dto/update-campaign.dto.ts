import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CampaignState } from '@prisma/client';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(CampaignState)
  state?: CampaignState;

  @IsOptional()
  @IsNumber()
  @Min(0)
  chickenCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fishCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vegCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  eggCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherCost?: number;
}
