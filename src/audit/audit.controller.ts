import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles(Role.ADMIN)
  list() {
    return this.auditService.list();
  }
}
