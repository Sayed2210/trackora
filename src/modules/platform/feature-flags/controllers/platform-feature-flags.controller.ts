import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import {
  PlatformAnyPermissions,
  PlatformPermissions,
} from '@common/decorators/platform-permissions.decorator';
import { DangerousAction } from '@common/decorators/dangerous-action.decorator';
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
  @ApiOperation({
    summary: 'List global platform feature flags',
    description:
      'Returns platform feature flag defaults. Requires `manage_feature_flags` or `view_platform_analytics` permission.',
  })
  @ApiOkResponse({
    description: 'Global feature flag defaults.',
    schema: { example: [{ key: 'advanced_analytics', enabled: true }] },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks a required permission.',
  })
  async findAllGlobal() {
    return this.featureFlagsService.findAllGlobal();
  }

  @Patch('platform/feature-flags/:key')
  @PlatformPermissions(PERMISSIONS.MANAGE_FEATURE_FLAGS)
  @DangerousAction('feature flag changes')
  @ApiOperation({
    summary: 'Update global platform feature flag default',
    description:
      'Updates the platform-wide default for an existing feature flag. Requires `manage_feature_flags` permission, a body `reason`, and is blocked during impersonation.',
  })
  @ApiOkResponse({ description: 'Global feature flag default updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_feature_flags`, or is impersonating.',
  })
  @ApiNotFoundResponse({ description: 'Feature flag key was not found.' })
  async updateGlobal(
    @Param() params: FeatureFlagKeyParamDto,
    @Body() dto: UpdateGlobalFeatureFlagDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.featureFlagsService.updateGlobal(params.key, dto, audit)
      : this.featureFlagsService.updateGlobal(params.key, dto);
  }

  @Get('platform/tenants/:id/feature-flags')
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_FEATURE_FLAGS,
    PERMISSIONS.MANAGE_TENANTS,
  )
  @ApiOperation({
    summary: 'List effective tenant feature flags',
    description:
      'Returns effective feature flags for a tenant, including tenant overrides. Requires `manage_feature_flags` or `manage_tenants` permission.',
  })
  @ApiOkResponse({
    description: 'Effective tenant feature flags.',
    schema: {
      example: [{ key: 'advanced_analytics', enabled: true, source: 'GLOBAL' }],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks a required permission.',
  })
  @ApiNotFoundResponse({ description: 'Tenant was not found.' })
  async findTenantFlags(@Param() params: TenantIdParamDto) {
    return this.featureFlagsService.findTenantFlags(params.id);
  }

  @Patch('platform/tenants/:id/feature-flags/:key')
  @PlatformPermissions(PERMISSIONS.MANAGE_FEATURE_FLAGS)
  @DangerousAction('tenant feature flag changes')
  @ApiOperation({
    summary: 'Update or remove tenant feature flag override',
    description:
      'Sets a tenant-specific feature flag override, or removes it when `enabled` is null. Requires `manage_feature_flags` permission, a body `reason`, and is blocked during impersonation.',
  })
  @ApiOkResponse({
    description: 'Tenant feature flag override updated or removed.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_feature_flags`, or is impersonating.',
  })
  @ApiNotFoundResponse({
    description: 'Tenant or feature flag key was not found.',
  })
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
