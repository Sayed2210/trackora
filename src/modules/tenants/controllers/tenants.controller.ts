import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
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

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
  ip?: string;
  headers: { 'user-agent'?: string };
}

@ApiTags('Platform Tenants')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @PlatformPermissions(PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({ summary: 'Create tenant' })
  async create(@Body() dto: CreatePlatformTenantDto, @Req() request?: AuthenticatedRequest) {
    const audit = this.toAuditContext(request);
    return audit ? this.tenantsService.create(dto, audit) : this.tenantsService.create(dto);
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
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit ? this.tenantsService.update(id, dto, audit) : this.tenantsService.update(id, dto);
  }

  @Patch(':id/status')
  @PlatformPermissions(PERMISSIONS.SUSPEND_TENANTS)
  @ApiOperation({ summary: 'Change tenant status' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePlatformTenantStatusDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit ? this.tenantsService.changeStatus(id, dto, audit) : this.tenantsService.changeStatus(id, dto);
  }

  private toAuditContext(request?: AuthenticatedRequest) {
    if (!request) return undefined;
    return {
      user: request.user,
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
    };
  }
}
