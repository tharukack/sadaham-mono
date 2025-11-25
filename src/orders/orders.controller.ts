import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
  list() {
    return this.ordersService.list();
  }

  @Post()
  @Roles(Role.ADMIN, Role.EDITOR)
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto, 'system');
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.EDITOR)
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto, 'system');
  }
}
