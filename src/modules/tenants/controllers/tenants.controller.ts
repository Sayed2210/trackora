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
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PlatformPermissions } from '@common/decorators/platform-permissions.decorator';
import { DangerousAction } from '@common/decorators/dangerous-action.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import {
  ChangePlatformTenantStatusDto,
  CreatePlatformTenantDto,
  ListPlatformTenantsDto,
  OnboardPlatformTenantDto,
  OnboardPlatformTenantResponseDto,
  UpdatePlatformTenantDto,
} from '../dtos';
import { TenantsService } from '../services/tenants.service';
import { TenantOnboardingService } from '../services/tenant-onboarding.service';

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
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly onboardingService: TenantOnboardingService,
  ) {}

  @Post('onboard')
  @PlatformPermissions(
    PERMISSIONS.MANAGE_TENANTS,
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
  )
  @DangerousAction('tenant onboarding')
  @ApiOperation({
    summary: 'Onboard a tenant atomically',
    description:
      'Creates a tenant, an admin/owner user, a subscription, and links the tenant to the plan in a single ACID transaction. Requires both `manage_tenants` and `manage_subscriptions` permissions. The returned `credentials.temporaryPassword` is shown once and never persisted in plaintext.',
  })
  @ApiCreatedResponse({
    description: 'Tenant onboarded successfully.',
    type: OnboardPlatformTenantResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `manage_tenants` / `manage_subscriptions`.',
  })
  @ApiNotFoundResponse({ description: 'Plan was not found.' })
  @ApiConflictResponse({
    description:
      'Tenant slug already exists, owner phone/email already registered, or plan is not active.',
  })
  async onboard(
    @Body() dto: OnboardPlatformTenantDto,
    @Req() request?: AuthenticatedRequest,
  ): Promise<OnboardPlatformTenantResponseDto> {
    const audit = this.toAuditContext(request);
    return this.onboardingService.onboard(dto, audit);
  }

  @Post()
  @PlatformPermissions(PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({
    summary: 'Create tenant',
    description:
      'Creates a tenant workspace for the platform. Requires `manage_tenants` permission.',
  })
  @ApiCreatedResponse({
    description: 'Tenant created.',
    schema: {
      example: {
        id: 'tenant-uuid',
        name: 'Cairo Express',
        slug: 'cairo-express',
        status: 'TRIAL',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `manage_tenants`.',
  })
  @ApiConflictResponse({
    description: 'Tenant slug or unique tenant data already exists.',
  })
  async create(
    @Body() dto: CreatePlatformTenantDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.tenantsService.create(dto, audit)
      : this.tenantsService.create(dto);
  }

  @Get()
  @PlatformPermissions(PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({
    summary: 'List tenants',
    description:
      'Returns paginated tenant records with optional search/status filters. Requires `manage_tenants` permission.',
  })
  @ApiOkResponse({
    description: 'Paginated tenant list.',
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
      'Authenticated user is not a platform user or lacks `manage_tenants`.',
  })
  async findAll(@Query() query: ListPlatformTenantsDto) {
    return this.tenantsService.findAll(query);
  }

  @Get(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({
    summary: 'Get tenant by ID',
    description:
      'Returns a single tenant profile for platform administration. Requires `manage_tenants` permission.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Tenant ID.' })
  @ApiOkResponse({ description: 'Tenant details.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `manage_tenants`.',
  })
  @ApiNotFoundResponse({ description: 'Tenant was not found.' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_TENANTS)
  @ApiOperation({
    summary: 'Update tenant profile',
    description:
      'Updates tenant profile fields. Requires `manage_tenants` permission.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Tenant ID.' })
  @ApiOkResponse({ description: 'Tenant updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `manage_tenants`.',
  })
  @ApiNotFoundResponse({ description: 'Tenant was not found.' })
  @ApiConflictResponse({
    description: 'Tenant slug or unique tenant data already exists.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformTenantDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.tenantsService.update(id, dto, audit)
      : this.tenantsService.update(id, dto);
  }

  @Patch(':id/status')
  @PlatformPermissions(PERMISSIONS.SUSPEND_TENANTS)
  @DangerousAction('tenant status changes')
  @ApiOperation({
    summary: 'Change tenant status',
    description:
      'Dangerous action used to activate, suspend, or close a tenant. Requires `suspend_tenants` permission and is blocked during impersonation.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Tenant ID.' })
  @ApiOkResponse({ description: 'Tenant status changed.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `suspend_tenants`, or is impersonating.',
  })
  @ApiNotFoundResponse({ description: 'Tenant was not found.' })
  @ApiConflictResponse({
    description: 'Requested tenant status transition is not allowed.',
  })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePlatformTenantStatusDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.tenantsService.changeStatus(id, dto, audit)
      : this.tenantsService.changeStatus(id, dto);
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
