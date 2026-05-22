import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@common/constants/permissions.constant';
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
  ) {
    return this.subscriptionsService.update(params.id, dto);
  }

  @Post(':id/change-plan')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @ApiOperation({ summary: 'Change subscription plan' })
  async changePlan(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: ChangeSubscriptionPlanDto,
  ) {
    return this.subscriptionsService.changePlan(params.id, dto);
  }

  @Post(':id/cancel')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancel(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptionsService.cancel(params.id, dto);
  }

  @Post(':id/renew')
  @PlatformPermissions(PERMISSIONS.MANAGE_SUBSCRIPTIONS)
  @ApiOperation({ summary: 'Renew subscription' })
  async renew(
    @Param() params: SubscriptionIdParamDto,
    @Body() dto: RenewSubscriptionDto,
  ) {
    return this.subscriptionsService.renew(params.id, dto);
  }
}
