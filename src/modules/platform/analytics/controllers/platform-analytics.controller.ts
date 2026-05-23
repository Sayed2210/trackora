import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import { AnalyticsShipmentsQueryDto, AnalyticsUsageQueryDto } from '../dtos';
import { PlatformAnalyticsService } from '../services/platform-analytics.service';

@ApiTags('Platform Analytics')
@ApiBearerAuth()
@UseGuards(PlatformOnlyGuard)
@Controller('platform/analytics')
export class PlatformAnalyticsController {
  constructor(private readonly analyticsService: PlatformAnalyticsService) {}

  @Get('overview')
  @PlatformPermissions(PERMISSIONS.VIEW_PLATFORM_ANALYTICS)
  @ApiOperation({
    summary: 'Get platform analytics overview',
    description:
      'Returns platform-level operational overview metrics for the owner dashboard. Requires `view_platform_analytics` permission.',
  })
  @ApiOkResponse({ description: 'Platform analytics overview.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `view_platform_analytics`.',
  })
  async overview() {
    return this.analyticsService.getOverview();
  }

  @Get('usage')
  @PlatformPermissions(PERMISSIONS.VIEW_PLATFORM_ANALYTICS)
  @ApiOperation({
    summary: 'Get platform usage trend analytics',
    description:
      'Returns platform usage trends filtered by date range, tenant, group interval, and metric hint. Requires `view_platform_analytics` permission.',
  })
  @ApiOkResponse({ description: 'Platform usage trend analytics.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `view_platform_analytics`.',
  })
  async usage(@Query() query: AnalyticsUsageQueryDto) {
    return this.analyticsService.getUsage(query);
  }

  @Get('revenue')
  @PlatformAnyPermissions(
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    PERMISSIONS.VIEW_BILLING,
  )
  @ApiOperation({
    summary: 'Get platform revenue overview analytics',
    description:
      'Returns platform revenue analytics for owner and billing dashboards. Requires `view_platform_analytics` or `view_billing` permission.',
  })
  @ApiOkResponse({ description: 'Platform revenue analytics.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks a required permission.',
  })
  async revenue() {
    return this.analyticsService.getRevenue();
  }

  @Get('shipments')
  @PlatformPermissions(PERMISSIONS.VIEW_PLATFORM_ANALYTICS)
  @ApiOperation({
    summary: 'Get platform shipment analytics',
    description:
      'Returns platform shipment analytics filtered by date range, tenant, and shipment status. Requires `view_platform_analytics` permission.',
  })
  @ApiOkResponse({ description: 'Platform shipment analytics.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiForbiddenResponse({
    description:
      'Authenticated user is not a platform user or lacks `view_platform_analytics`.',
  })
  async shipments(@Query() query: AnalyticsShipmentsQueryDto) {
    return this.analyticsService.getShipments(query);
  }
}
