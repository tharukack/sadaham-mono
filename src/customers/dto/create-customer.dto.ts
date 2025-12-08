import { IsMobilePhone, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @IsMobilePhone('en-AU')
  mobile!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  address?: string;
}
