import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('customers')
@UseGuards(RolesGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  @Roles(Role.ADMIN)
  list() {
    return this.customersService.list();
  }

  @Get('search')
  @Roles(Role.ADMIN, Role.EDITOR)
  search(@Query('q') q: string) {
    return this.customersService.search(q || '');
  }

  @Post()
  @Roles(Role.ADMIN, Role.EDITOR)
  create(@Body() dto: CreateCustomerDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new ForbiddenException('Missing authenticated user');
    }
    return this.customersService.create(dto, userId);
  }

  @Post(':id')
  @Roles(Role.ADMIN, Role.EDITOR)
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new ForbiddenException('Missing authenticated user');
    }
    return this.customersService.update(id, dto, userId);
  }

  @Patch(':id/delete')
  @Roles(Role.ADMIN)
  softDelete(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new ForbiddenException('Missing authenticated user');
    }
    return this.customersService.softDelete(id, userId);
  }
}
