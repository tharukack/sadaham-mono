import { IsMobilePhone, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsMobilePhone('en-AU')
  mobile!: string;

  @IsString()
  @Length(4, 128)
  password!: string;
}
