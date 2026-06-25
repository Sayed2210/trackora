import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import {
  PlatformAnyPermissions,
  PlatformPermissions,
} from '@common/decorators/platform-permissions.decorator';
import { DangerousAction } from '@common/decorators/dangerous-action.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import {
  CancelSubscriptionDto,
  ChangeSubscriptionPlanDto,
  CreateSubscriptionDto,
  ListSubscriptionsQueryDto,
  RenewSubscriptionDto,
  SubscriptionIdParamDto,
  UpdateSubscriptionDto,
} from '../dtos';
import { PlatformSubscriptionsService } from '../services/platform-subscriptions.service';

interface AuthenticatedRequest {
  user: AuthenticatedRequestUser;
  ip?: string;
  headers: { 'user-agent'?: string };
}

@ApiTags('Platform Subscriptions')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform/subscriptions')
export class PlatformSubscriptionsController {
  constructor(
    private readonly subscriptionsService: PlatformSubscriptionsService,
  ) {}

  @Post()
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @DangerousAction('subscription creation')
  @ApiOperation({
    summary: 'Create subscription for a tenant',
    description:
      'Subscribes a tenant to a plan, creating the first subscription record and syncing the tenant current plan. Requires `manage_subscriptions` permission, a body `reason`, and is blocked during impersonation.',
  })
  @ApiCreatedResponse({ description: 'Subscription created.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_subscriptions`, or is impersonating.',
  })
  @ApiNotFoundResponse({
    description: 'Tenant or plan was not found.',
  })
  @ApiConflictResponse({
    description:
      'Tenant is cancelled, plan is inactive/archived, or tenant already has an active subscription.',
  })
  async create(
    @Body() dto: CreateSubscriptionDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.subscriptionsService.create(dto, audit)
      : this.subscriptionsService.create(dto);
  }

  @Get()
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({
    summary: 'List platform subscriptions',
    description:
      'Returns paginated tenant subscriptions with tenant, plan, status, payment, renewal-date, search, and sort filters. Requires one of `manage_subscriptions`, `view_billing`, or `view_platform_analytics`.',
  })
  @ApiOkResponse({
    description: 'Paginated platform subscription list.',
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
  async findAll(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptionsService.findAll(query);
  }

  @Get(':id')
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({
    summary: 'Get platform subscription details',
    description:
      'Returns subscription details for platform owner workflows. Requires one of `manage_subscriptions`, `view_billing`, or `view_platform_analytics`.',
  })
  @ApiOkResponse({ description: 'Platform subscription details.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks a required permission.',
  })
  @ApiNotFoundResponse({ description: 'Subscription was not found.' })
  async findById(@Param() params: SubscriptionIdParamDto) {
    return this.subscriptionsService.findById(params.id);
  }

  @Patch(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @DangerousAction('subscription changes')
  @ApiOperation({
    summary: 'Update platform subscription',
    description:
      'Updates subscription dates, status, payment status, or metadata. Requires `manage_subscriptions` permission, a body `reason`, and is blocked during impersonation.',
  })
  @ApiOkResponse({ description: 'Platform subscription updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_subscriptions`, or is impersonating.',
  })
  @ApiNotFoundResponse({ description: 'Subscription was not found.' })
  @ApiConflictResponse({
    description:
      'Subscription update conflicts with current plan, tenant, or billing state.',
  })
  async update(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: UpdateSubscriptionDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.subscriptionsService.update(params.id, dto, audit)
      : this.subscriptionsService.update(params.id, dto);
  }

  @Post(':id/change-plan')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @DangerousAction('subscription plan changes')
  @ApiOperation({
    summary: 'Change subscription plan',
    description:
      'Changes the plan assigned to a subscription. Requires `manage_subscriptions` permission, a body `reason`, and is blocked during impersonation.',
  })
  @ApiOkResponse({ description: 'Subscription plan changed.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_subscriptions`, or is impersonating.',
  })
  @ApiNotFoundResponse({
    description: 'Subscription or target plan was not found.',
  })
  @ApiConflictResponse({
    description: 'Plan change conflicts with current subscription state.',
  })
  async changePlan(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: ChangeSubscriptionPlanDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.subscriptionsService.changePlan(params.id, dto, audit)
      : this.subscriptionsService.changePlan(params.id, dto);
  }

  @Post(':id/cancel')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @DangerousAction('subscription cancellation')
  @ApiOperation({
    summary: 'Cancel subscription',
    description:
      'Cancels a tenant subscription immediately or at period end. Requires `manage_subscriptions` permission, a body `reason`, and is blocked during impersonation.',
  })
  @ApiOkResponse({ description: 'Subscription cancelled.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_subscriptions`, or is impersonating.',
  })
  @ApiNotFoundResponse({ description: 'Subscription was not found.' })
  @ApiConflictResponse({
    description: 'Subscription cannot be cancelled from its current state.',
  })
  async cancel(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: CancelSubscriptionDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.subscriptionsService.cancel(params.id, dto, audit)
      : this.subscriptionsService.cancel(params.id, dto);
  }

  @Post(':id/renew')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @DangerousAction('subscription renewal')
  @ApiOperation({
    summary: 'Renew subscription',
    description:
      'Renews a tenant subscription period and optional payment state. Requires `manage_subscriptions` permission, a body `reason`, and is blocked during impersonation.',
  })
  @ApiOkResponse({ description: 'Subscription renewed.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user, lacks `manage_subscriptions`, or is impersonating.',
  })
  @ApiNotFoundResponse({ description: 'Subscription was not found.' })
  @ApiConflictResponse({
    description: 'Subscription cannot be renewed from its current state.',
  })
  async renew(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: RenewSubscriptionDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit
      ? this.subscriptionsService.renew(params.id, dto, audit)
      : this.subscriptionsService.renew(params.id, dto);
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
