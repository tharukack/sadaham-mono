import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsDateString()
  eventDate!: string;

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
