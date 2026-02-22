import { IsString, Length, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @MinLength(10)
  otpToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
