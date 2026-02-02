import { IsBoolean, IsEmail, IsEnum, IsMobilePhone, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { normalizeAuMobile } from '../../common/utils/phone';

export class UpdateUserDto {
  @IsMobilePhone('en-AU')
  @Transform(({ value }) => normalizeAuMobile(value))
  @IsOptional()
  mobile?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
