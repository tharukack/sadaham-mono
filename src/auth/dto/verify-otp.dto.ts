import { IsMobilePhone, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsMobilePhone('en-AU')
  mobile!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
