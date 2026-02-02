import { IsMobilePhone, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeAuMobile } from '../../common/utils/phone';

export class CreateCustomerDto {
  @IsMobilePhone('en-AU')
  @Transform(({ value }) => normalizeAuMobile(value))
  mobile!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  address?: string;
}
