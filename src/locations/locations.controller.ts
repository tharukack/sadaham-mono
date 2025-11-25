import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
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
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }
}
