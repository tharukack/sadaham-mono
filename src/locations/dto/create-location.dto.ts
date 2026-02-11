import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  name!: string;

  @IsString()
  address!: string;

  @IsString()
  distributorName!: string;

  @IsString()
  distributorMobile!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryTimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  distributionPriority?: number;

  @IsOptional()
  @IsString()
  timeOfDispatch?: string;

  @IsOptional()
  @IsString()
  distributorCustomerId?: string;

  @IsOptional()
  @IsString()
  transporterCustomerId?: string;
}
