import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles(Role.SUPERADMIN)
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.auditService.list({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
      sortDir: sortDir === 'asc' ? 'asc' : 'desc',
    });
  }
}
