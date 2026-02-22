import { IsBoolean, IsEmail, IsEnum, IsMobilePhone, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { normalizeAuMobile } from '../../common/utils/phone';

export class CreateUserDto {
  @IsMobilePhone('en-AU')
  @Transform(({ value }) => normalizeAuMobile(value))
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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  mainCollectorId?: string;
}
