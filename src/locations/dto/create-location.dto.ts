import { IsOptional, IsString } from 'class-validator';

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
  @IsString()
  distributorCustomerId?: string;

  @IsOptional()
  @IsString()
  transporterCustomerId?: string;
}
