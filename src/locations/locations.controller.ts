import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('locations')
@UseGuards(RolesGuard)
export class LocationsController {
  constructor(private locationsService: LocationsService) {}

  @Get()
  list() {
    return this.locationsService.list();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateLocationDto, @Req() req: any) {
    return this.locationsService.create(dto, req?.user?.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto, @Req() req: any) {
    return this.locationsService.update(id, dto, req?.user?.id);
  }
}
