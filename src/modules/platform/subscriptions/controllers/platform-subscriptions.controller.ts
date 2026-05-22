import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import {
  PlatformAnyPermissions,
  PlatformPermissions,
} from '@common/decorators/platform-permissions.decorator';
import { PlatformOnlyGuard } from '@common/guards/platform-only.guard';
import {
  CancelSubscriptionDto,
  ChangeSubscriptionPlanDto,
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
  constructor(private readonly subscriptionsService: PlatformSubscriptionsService) {}

  @Get()
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({ summary: 'List platform subscriptions' })
  async findAll(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptionsService.findAll(query);
  }

  @Get(':id')
  @PlatformAnyPermissions(
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_BILLING,
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
  )
  @ApiOperation({ summary: 'Get platform subscription details' })
  async findById(@Param() params: SubscriptionIdParamDto) {
    return this.subscriptionsService.findById(params.id);
  }

  @Patch(':id')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @ApiOperation({ summary: 'Update platform subscription' })
  async update(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: UpdateSubscriptionDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit ? this.subscriptionsService.update(params.id, dto, audit) : this.subscriptionsService.update(params.id, dto);
  }

  @Post(':id/change-plan')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @ApiOperation({ summary: 'Change subscription plan' })
  async changePlan(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: ChangeSubscriptionPlanDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit ? this.subscriptionsService.changePlan(params.id, dto, audit) : this.subscriptionsService.changePlan(params.id, dto);
  }

  @Post(':id/cancel')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancel(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: CancelSubscriptionDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit ? this.subscriptionsService.cancel(params.id, dto, audit) : this.subscriptionsService.cancel(params.id, dto);
  }

  @Post(':id/renew')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @ApiOperation({ summary: 'Renew subscription' })
  async renew(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: RenewSubscriptionDto,
    @Req() request?: AuthenticatedRequest,
  ) {
    const audit = this.toAuditContext(request);
    return audit ? this.subscriptionsService.renew(params.id, dto, audit) : this.subscriptionsService.renew(params.id, dto);
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
