import { IsString } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  name!: string;

  @IsString()
  address!: string;

  @IsString()
  distributorName!: string;

  @IsString()
  distributorMobile!: string;
}
