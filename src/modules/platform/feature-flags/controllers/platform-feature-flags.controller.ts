import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import {
  PlatformAnyPermissions,
  PlatformPermissions,
} from '@common/decorators/platform-permissions.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import {
  FeatureFlagKeyParamDto,
  TenantFeatureFlagsParamDto,
  TenantIdParamDto,
  UpdateGlobalFeatureFlagDto,
  UpdateTenantFeatureFlagDto,
} from '../dtos';
import { PlatformFeatureFlagsService } from '../services/platform-feature-flags.service';

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
  ip?: string;
  headers: { 'user-agent'?: string };
}

@ApiTags('Platform Feature Flags')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller()
export class PlatformFeatureFlagsController {
  constructor(
    private readonly featureFlagsService: PlatformFeatureFlagsService,
  ) {}

  @Get('platform/feature-flags')
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_FEATURE_FLAGS,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({ summary: 'List global platform feature flags' })
  async findAllGlobal() {
    return this.featureFlagsService.findAllGlobal();
  }

  @Patch('platform/feature-flags/:key')
  @PlatformPermissions(PERMISSIONS.MANAGE_FEATURE_FLAGS)
  @ApiOperation({ summary: 'Update global platform feature flag default' })
  async updateGlobal(
    @Param() params: FeatureFlagKeyParamDto,
    @Body() dto: UpdateGlobalFeatureFlagDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit ? this.featureFlagsService.updateGlobal(params.key, dto, audit) : this.featureFlagsService.updateGlobal(params.key, dto);
  }

  @Get('platform/tenants/:id/feature-flags')
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_FEATURE_FLAGS,
    PERMISSIONS.MANAGE_TENANTS,
  )
  @ApiOperation({ summary: 'List effective tenant feature flags' })
  async findTenantFlags(@Param() params: TenantIdParamDto) {
    return this.featureFlagsService.findTenantFlags(params.id);
  }

  @Patch('platform/tenants/:id/feature-flags/:key')
  @PlatformPermissions(PERMISSIONS.MANAGE_FEATURE_FLAGS)
  @ApiOperation({ summary: 'Update or remove tenant feature flag override' })
  async updateTenantFlag(
    @Param() params: TenantFeatureFlagsParamDto,
    @Body() dto: UpdateTenantFeatureFlagDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    if (!audit) {
      return this.featureFlagsService.updateTenantFlag(
        params.id,
        params.key,
        dto,
        request?.user.userId,
      );
    }
    return this.featureFlagsService.updateTenantFlag(
      params.id,
      params.key,
      dto,
      request?.user.userId,
      audit,
    );
  }

  private toAuditContext(request?: AuthenticatedRequest) {
    if (!request?.headers) return undefined;
    return {
      user: request.user,
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
    };
  }
}
