import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PlatformPermissions } from '@common/decorators/platform-permissions.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import {
  ChangePlatformTenantStatusDto,
  CreatePlatformTenantDto,
  ListPlatformTenantsDto,
  UpdatePlatformTenantDto,
} from '../dtos';
import { TenantsService } from '../services/tenants.service';

@ApiTags('Platform Tenants')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @PlatformPermissions(PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({ summary: 'Create tenant' })
  async create(@Body() dto: CreatePlatformTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @PlatformPermissions(PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({ summary: 'List tenants' })
  async findAll(@Query() query: ListPlatformTenantsDto) {
    return this.tenantsService.findAll(query);
  }

  @Get(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({ summary: 'Update tenant profile' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  @Patch(':id/status')
  @PlatformPermissions(PERMISSIONS.SUSPEND_TENANTS)
  @ApiOperation({ summary: 'Change tenant status' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePlatformTenantStatusDto,
  ) {
    return this.tenantsService.changeStatus(id, dto);
  }
}
