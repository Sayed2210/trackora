import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ZonesService } from '../services/zones.service';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@modules/users/entities/user.entity';
import { ZoneLevel } from '../entities/zone.entity';
import { CreateZoneDto } from '../dtos/create-zone.dto';
import { UpdateZoneDto } from '../dtos/update-zone.dto';
import {
  PaginatedZonesResponseDto,
  ZoneResponseDto,
} from '../dtos/zone-response.dto';
// import { ListZonesDto } from '../dtos/list-zones.dto';

@ApiTags('Zones')
@ApiBearerAuth()
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  async create(@Body() dto: CreateZoneDto) {
    return this.zonesService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'level', required: false, enum: ZoneLevel })
  @ApiQuery({ name: 'parentId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: PaginatedZonesResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid zone query values.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async findAll(
    @Query('level') level?: ZoneLevel,
    @Query('parentId') parentId?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.zonesService.findAll({
      level,
      parentId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOkResponse({ type: ZoneResponseDto })
  @ApiBadRequestResponse({ description: 'Zone id must be a UUID.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiNotFoundResponse({ description: 'Zone was not found.' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.zonesService.findById(id);
  }

  @Get(':id/children')
  async findChildren(@Param('id', ParseUUIDPipe) id: string) {
    return this.zonesService.findChildren(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOkResponse({ type: ZoneResponseDto })
  @ApiBadRequestResponse({
    description: 'Zone id or update payload failed validation.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({ description: 'Operations admin role is required.' })
  @ApiNotFoundResponse({ description: 'Zone or parent zone was not found.' })
  @ApiConflictResponse({
    description: 'Zone code already exists or parent assignment is invalid.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.zonesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER)
  @ApiOkResponse({
    description: 'Zone deactivated successfully. Response body is empty.',
    content: {},
  })
  @ApiBadRequestResponse({ description: 'Zone id must be a UUID.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({ description: 'Operations admin role is required.' })
  @ApiNotFoundResponse({ description: 'Zone was not found.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.zonesService.remove(id);
  }
}
