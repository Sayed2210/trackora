import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Body,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CouriersService } from '../services/couriers.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import {
  CourierResponseDto,
  CreateCourierDto,
} from '../dtos/create-courier.dto';
import { UpdateZonesDto } from '../dtos/update-zones.dto';
import { QueryCouriersDto } from '../dtos/query-couriers.dto';
import { UpdateAvailabilityDto } from '../dtos/update-availability.dto';
import { PaginatedCouriersResponseDto } from '../dtos/courier-list-response.dto';
import { EffectiveTenantId } from '@common/tenant/effective-tenant';

@ApiTags('Couriers')
@ApiBearerAuth()
@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiCreatedResponse({
    description: 'Courier and linked user account created.',
    type: CourierResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed, vehicleType is invalid, required fields are missing, or zoneCodes include inactive/unknown zones.',
  })
  @ApiConflictResponse({
    description: 'Phone number or email is already registered.',
  })
  async create(
    @Body() dto: CreateCourierDto,
    @EffectiveTenantId() tenantId: string,
  ): Promise<CourierResponseDto> {
    return this.couriersService.create(dto, tenantId);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isAvailable', required: false, type: Boolean })
  @ApiQuery({ name: 'zoneCode', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: PaginatedCouriersResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid courier query values.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({ description: 'Operations admin role is required.' })
  async findAll(
    @Query() query: QueryCouriersDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.couriersService.findAll(tenantId, {
      search: query.search,
      isActive: this.parseBoolean(query.isActive),
      isAvailable: this.parseBoolean(query.isAvailable),
      zoneCode: query.zoneCode,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });
  }

  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.couriersService.findById(id, tenantId);
  }

  @Patch(':id/zones')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async updateZones(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZonesDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.couriersService.updateZones(id, dto.zoneCodes, tenantId);
  }

  @Patch(':id/availability')
  async updateAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAvailabilityDto,
    @EffectiveTenantId() tenantId: string,
  ) {
    return this.couriersService.updateAvailability(
      id,
      dto.isAvailable,
      tenantId,
    );
  }

  private parseBoolean(value?: string): boolean | undefined {
    if (value === undefined) return undefined;
    return value === 'true';
  }
}
