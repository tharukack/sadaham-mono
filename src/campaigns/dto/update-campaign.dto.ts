import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CampaignState } from '@prisma/client';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(CampaignState)
  state?: CampaignState;
}
