import { IsMobilePhone, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeAuMobile } from '../../common/utils/phone';

export class UpdateCustomerDto {
  @IsOptional()
  @IsMobilePhone('en-AU')
  @Transform(({ value }) => normalizeAuMobile(value))
  mobile?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
