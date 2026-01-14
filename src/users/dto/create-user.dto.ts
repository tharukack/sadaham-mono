import { IsEmail, IsEnum, IsMobilePhone, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsMobilePhone('en-AU')
  mobile!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsEnum(Role)
  role!: Role;

  @MinLength(6)
  password!: string;
}
