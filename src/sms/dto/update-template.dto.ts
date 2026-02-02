import { IsString } from 'class-validator';

export class UpdateTemplateDto {
  @IsString()
  body!: string;
}
