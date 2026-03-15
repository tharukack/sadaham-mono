import { IsBoolean } from 'class-validator';

export class UpdateSmsSettingsDto {
  @IsBoolean()
  enabled!: boolean;
}
