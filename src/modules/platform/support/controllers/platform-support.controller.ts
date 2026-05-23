import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import {
  EndImpersonationDto,
  SearchSupportTenantsQueryDto,
  StartImpersonationDto,
  TenantHealthParamDto,
} from '../dtos';
import { PlatformSupportService } from '../services/platform-support.service';

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
  ip?: string;
  headers: { 'user-agent'?: string };
}

@ApiTags('Platform Support')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform')
export class PlatformSupportController {
  constructor(private readonly supportService: PlatformSupportService) {}

  @Get('support/tenants/search')
  @PlatformAnyPermissions(
    PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
    PERMISSIONS.MANAGE_TENANTS,
  )
  @ApiOperation({
    summary: 'Search tenants for platform support',
    description:
      'Searches tenants for support workflows and impersonation selection. Requires `impersonate_tenant_admin` or `manage_tenants` permission.',
  })
  @ApiOkResponse({
    description: 'Paginated support tenant search results.',
    schema: {
      example: {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks a required permission.',
  })
  async searchTenants(@Query() query: SearchSupportTenantsQueryDto) {
    return this.supportService.searchTenants(query);
  }

  @Get('support/tenants/:id/health')
  @PlatformAnyPermissions(
    PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
    PERMISSIONS.MANAGE_TENANTS,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({
    summary: 'Get tenant support health summary',
    description:
      'Returns tenant operational health for support triage. Audit details are included only when the caller also has `view_audit_logs`. Requires `impersonate_tenant_admin`, `manage_tenants`, or `view_platform_analytics`.',
  })
  @ApiOkResponse({ description: 'Tenant support health summary.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks a required permission.',
  })
  @ApiNotFoundResponse({ description: 'Tenant was not found.' })
  async tenantHealth(
    @Param() params: TenantHealthParamDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.getTenantHealth(
      params.id,
      request.user.permissions.includes(PERMISSIONS.VIEW_AUDIT_LOGS),
    );
  }

  @Post('tenants/:id/impersonate')
  @PlatformPermissions(PERMISSIONS.IMPERSONATE_TENANT_ADMIN)
  @ApiOperation({
    summary: 'Start tenant user impersonation session',
    description:
      'Starts a time-limited, audited impersonation session for tenant support. Requires `impersonate_tenant_admin` permission and a reason. Does not expose tenant user credentials.',
  })
  @ApiCreatedResponse({ description: 'Impersonation session started.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `impersonate_tenant_admin`.',
  })
  @ApiNotFoundResponse({ description: 'Tenant or target user was not found.' })
  @ApiConflictResponse({
    description:
      'Impersonation cannot start because target tenant/user state is restricted.',
  })
  async startImpersonation(
    @Param() params: TenantHealthParamDto,
    @Body() dto: StartImpersonationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.startImpersonation(
      params.id,
      dto,
      this.toContext(request),
    );
  }

  @Post('impersonation/end')
  @PlatformPermissions(PERMISSIONS.IMPERSONATE_TENANT_ADMIN)
  @ApiOperation({
    summary: 'End tenant user impersonation session',
    description:
      'Ends an active audited impersonation session. Requires `impersonate_tenant_admin` permission.',
  })
  @ApiCreatedResponse({ description: 'Impersonation session ended.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `impersonate_tenant_admin`.',
  })
  @ApiNotFoundResponse({ description: 'Impersonation session was not found.' })
  async endImpersonation(
    @Body() dto: EndImpersonationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.endImpersonation(dto, this.toContext(request));
  }

  private toContext(request: AuthenticatedRequest) {
    return {
      user: request.user,
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
    };
  }
}
