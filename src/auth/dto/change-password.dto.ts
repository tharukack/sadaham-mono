import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  currentPassword?: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
