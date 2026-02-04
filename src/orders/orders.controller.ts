import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('orders')
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.EDITOR, Role.VIEWER)
  list(@Req() req: Request) {
    const user = (req as any).user;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }
    return this.ordersService.list(user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EDITOR, Role.VIEWER)
  getById(@Param('id') id: string) {
    return this.ordersService.getById(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.EDITOR)
  create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    const user = (req as any).user;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }
    return this.ordersService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.EDITOR)
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto, @Req() req: Request) {
    const user = (req as any).user;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }
    return this.ordersService.update(id, dto, user);
  }

  @Patch(':id/delete')
  @Roles(Role.ADMIN, Role.EDITOR)
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }
    return this.ordersService.softDelete(id, user);
  }

  @Patch(':id/restore')
  @Roles(Role.ADMIN, Role.EDITOR)
  restore(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }
    return this.ordersService.restore(id, user);
  }
}
