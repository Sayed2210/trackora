import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import {
  CreatePlanDto,
  ListPlansQueryDto,
  PlanIdParamDto,
  UpdatePlanDto,
} from '../dtos';
import { PlatformPlansService } from '../services/platform-plans.service';

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
  ip?: string;
  headers: { 'user-agent'?: string };
}

@ApiTags('Platform Plans')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform/plans')
export class PlatformPlansController {
  constructor(private readonly plansService: PlatformPlansService) {}

  @Get()
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_PLANS,
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({
    summary: 'List platform plans',
    description:
      'Returns paginated platform subscription plans with search, active/archive filters, and sorting. Requires one of `manage_plans`, `manage_subscriptions`, or `view_platform_analytics`.',
  })
  @ApiOkResponse({
    description: 'Paginated platform plan list.',
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
  async findAll(@Query() query: ListPlansQueryDto) {
    return this.plansService.findAll(query);
  }

  @Post()
  @PlatformPermissions(PERMISSIONS.MANAGE_PLANS)
  @DangerousAction('plan changes')
  @ApiOperation({
    summary: 'Create platform plan',
    description:
      'Creates a billable platform plan and optional feature entitlements. Requires `manage_plans` permission and is blocked during impersonation.',
  })
  @ApiCreatedResponse({ description: 'Platform plan created.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_plans`, or is impersonating.',
  })
  @ApiConflictResponse({
    description: 'Plan slug or unique plan data already exists.',
  })
  async create(
    @Body() dto: CreatePlanDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.plansService.create(dto, audit)
      : this.plansService.create(dto);
  }

  @Get(':id')
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_PLANS,
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({
    summary: 'Get platform plan details',
    description:
      'Returns platform plan configuration and entitlements. Requires one of `manage_plans`, `manage_subscriptions`, or `view_platform_analytics`.',
  })
  @ApiOkResponse({ description: 'Platform plan details.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks a required permission.',
  })
  @ApiNotFoundResponse({ description: 'Platform plan was not found.' })
  async findById(@Param() params: PlanIdParamDto) {
    return this.plansService.findById(params.id);
  }

  @Patch(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_PLANS)
  @DangerousAction('plan changes')
  @ApiOperation({
    summary: 'Update platform plan',
    description:
      'Updates pricing, limits, active state, or feature entitlements for a plan. Requires `manage_plans` permission and is blocked during impersonation.',
  })
  @ApiOkResponse({ description: 'Platform plan updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_plans`, or is impersonating.',
  })
  @ApiNotFoundResponse({ description: 'Platform plan was not found.' })
  @ApiConflictResponse({
    description: 'Plan slug or unique plan data already exists.',
  })
  async update(
    @Param() params: PlanIdParamDto,
    @Body() dto: UpdatePlanDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.plansService.update(params.id, dto, audit)
      : this.plansService.update(params.id, dto);
  }

  @Delete(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_PLANS)
  @DangerousAction('plan archive/delete')
  @ApiOperation({
    summary: 'Archive or delete platform plan safely',
    description:
      'Archives or deletes a plan only when allowed by existing subscriptions. Requires `manage_plans` permission and is blocked during impersonation.',
  })
  @ApiOkResponse({ description: 'Platform plan archived or deleted safely.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_plans`, or is impersonating.',
  })
  @ApiNotFoundResponse({ description: 'Platform plan was not found.' })
  @ApiConflictResponse({
    description:
      'Plan cannot be deleted because active subscriptions or other constraints exist.',
  })
  async remove(
    @Param() params: PlanIdParamDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.plansService.remove(params.id, audit)
      : this.plansService.remove(params.id);
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
