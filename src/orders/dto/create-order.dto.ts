import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsString()
  customerId!: string;

  @IsString()
  pickupLocationId!: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  chickenQty!: number;

  @IsInt()
  @Min(0)
  @Max(1000)
  fishQty!: number;

  @IsInt()
  @Min(0)
  @Max(1000)
  vegQty!: number;

  @IsInt()
  @Min(0)
  @Max(1000)
  eggQty!: number;

  @IsInt()
  @Min(0)
  @Max(1000)
  otherQty!: number;

  @IsOptional()
  @IsString()
  pickupByCustomerId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
