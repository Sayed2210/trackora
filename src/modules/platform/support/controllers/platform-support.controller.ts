import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PlatformAnyPermissions, PlatformPermissions } from '@common/decorators/platform-permissions.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { EndImpersonationDto, SearchSupportTenantsQueryDto, StartImpersonationDto, TenantHealthParamDto } from '../dtos';
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
  @PlatformAnyPermissions(PERMISSIONS.IMPERSONATE_TENANT_ADMIN, PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({ summary: 'Search tenants for platform support' })
  async searchTenants(@Query() query: SearchSupportTenantsQueryDto) {
    return this.supportService.searchTenants(query);
  }

  @Get('support/tenants/:id/health')
  @PlatformAnyPermissions(
    PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
    PERMISSIONS.MANAGE_TENANTS,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({ summary: 'Get tenant support health summary' })
  async tenantHealth(@Param() params: TenantHealthParamDto, @Req() request: AuthenticatedRequest) {
    return this.supportService.getTenantHealth(
      params.id,
      request.user.permissions.includes(PERMISSIONS.VIEW_AUDIT_LOGS),
    );
  }

  @Post('tenants/:id/impersonate')
  @PlatformPermissions(PERMISSIONS.IMPERSONATE_TENANT_ADMIN)
  @ApiOperation({ summary: 'Start tenant user impersonation session' })
  async startImpersonation(
    @Param() params: TenantHealthParamDto,
    @Body() dto: StartImpersonationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.startImpersonation(params.id, dto, this.toContext(request));
  }

  @Post('impersonation/end')
  @PlatformPermissions(PERMISSIONS.IMPERSONATE_TENANT_ADMIN)
  @ApiOperation({ summary: 'End tenant user impersonation session' })
  async endImpersonation(@Body() dto: EndImpersonationDto, @Req() request: AuthenticatedRequest) {
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
