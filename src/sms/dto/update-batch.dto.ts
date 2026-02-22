import { IsEnum } from 'class-validator';
import { SmsBatchStatus } from '@prisma/client';

export class UpdateBatchDto {
  @IsEnum(SmsBatchStatus)
  status!: SmsBatchStatus;
}
