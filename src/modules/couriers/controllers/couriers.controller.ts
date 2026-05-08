import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Body,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CouriersService } from '../services/couriers.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { CreateCourierDto } from '../dtos/create-courier.dto';
import { UpdateZonesDto } from '../dtos/update-zones.dto';

interface RequestWithUser extends Request {
  user: { userId: string; role: UserRole };
}

@ApiTags('Couriers')
@ApiBearerAuth()
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async create(@Body() dto: CreateCourierDto, @Req() req: RequestWithUser) {
    return this.couriersService.create(dto, req.user.userId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.couriersService.findById(id);
  }

  @Patch(':id/zones')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async updateZones(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZonesDto,
  ) {
    return this.couriersService.updateZones(id, dto.zoneCodes);
  }

  @Patch(':id/availability')
  async updateAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isAvailable') isAvailable: boolean,
  ) {
    return this.couriersService.updateAvailability(id, isAvailable);
  }
}