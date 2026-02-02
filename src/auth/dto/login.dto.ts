import { IsMobilePhone, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeAuMobile } from '../../common/utils/phone';

export class LoginDto {
  @IsMobilePhone('en-AU')
  @Transform(({ value }) => normalizeAuMobile(value))
  mobile!: string;

  @IsString()
  @Length(4, 128)
  password!: string;
}
