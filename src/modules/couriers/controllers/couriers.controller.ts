import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Body,
  ParseUUIDPipe,
  Req,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { CouriersService } from '../services/couriers.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { CreateCourierDto } from '../dtos/create-courier.dto';
import { UpdateZonesDto } from '../dtos/update-zones.dto';
import { QueryCouriersDto } from '../dtos/query-couriers.dto';
import { UpdateAvailabilityDto } from '../dtos/update-availability.dto';

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

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isAvailable', required: false, type: Boolean })
  @ApiQuery({ name: 'zoneCode', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Query() query: QueryCouriersDto) {
    return this.couriersService.findAll({
      search: query.search,
      isActive: this.parseBoolean(query.isActive),
      isAvailable: this.parseBoolean(query.isAvailable),
      zoneCode: query.zoneCode,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });
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
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.couriersService.updateAvailability(id, dto.isAvailable);
  }

  private parseBoolean(value?: string): boolean | undefined {
    if (value === undefined) return undefined;
    return value === 'true';
  }
}
