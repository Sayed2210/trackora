import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get platform analytics overview' })
  async overview() {
    return this.analyticsService.getOverview();
  }

  @Get('usage')
  @PlatformPermissions(PERMISSIONS.VIEW_PLATFORM_ANALYTICS)
  @ApiOperation({ summary: 'Get platform usage trend analytics' })
  async usage(@Query() query: AnalyticsUsageQueryDto) {
    return this.analyticsService.getUsage(query);
  }

  @Get('revenue')
  @PlatformAnyPermissions(
    PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    PERMISSIONS.VIEW_BILLING,
  )
  @ApiOperation({ summary: 'Get platform revenue overview analytics' })
  async revenue() {
    return this.analyticsService.getRevenue();
  }

  @Get('shipments')
  @PlatformPermissions(PERMISSIONS.VIEW_PLATFORM_ANALYTICS)
  @ApiOperation({ summary: 'Get platform shipment analytics' })
  async shipments(@Query() query: AnalyticsShipmentsQueryDto) {
    return this.analyticsService.getShipments(query);
  }
}
