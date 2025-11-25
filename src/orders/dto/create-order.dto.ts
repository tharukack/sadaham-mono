import { IsInt, IsString, Max, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  campaignId!: string;

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
}
