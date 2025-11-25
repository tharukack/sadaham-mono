import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  pickupLocationId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  chickenQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  fishQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  vegQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  eggQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  otherQty?: number;
}
