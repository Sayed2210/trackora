import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';

class MerchantDashboardCountsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  inTransit: number;

  @ApiProperty()
  delivered: number;

  @ApiProperty()
  returned: number;
}

class MerchantDashboardActivityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  trackingNumber: string;

  @ApiProperty({ enum: ShipmentStatus })
  status: ShipmentStatus;

  @ApiProperty()
  customerName: string;

  @ApiPropertyOptional()
  codAmount: number | null;

  @ApiProperty()
  createdAt: Date;
}

class MerchantSuccessRateDto {
  @ApiProperty()
  current: number;

  @ApiProperty()
  previous: number;

  @ApiProperty({ enum: ['up', 'down', 'flat'] })
  trend: 'up' | 'down' | 'flat';
}

class MerchantReturnReasonDto {
  @ApiProperty()
  reason: string;

  @ApiProperty()
  count: number;

  @ApiProperty()
  percentage: number;
}

class MerchantZonePerformanceDto {
  @ApiProperty()
  zone: string;

  @ApiProperty()
  delivered: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  rate: number;
}

class MerchantCodTrendDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  collected: number;
}

export class MerchantDashboardResponseDto {
  @ApiProperty({ type: MerchantDashboardCountsDto })
  counts: MerchantDashboardCountsDto;

  @ApiProperty()
  deliverySuccessRate: number;

  @ApiProperty()
  averageCodAmount: number;

  @ApiProperty({ type: [MerchantDashboardActivityDto] })
  recentActivity: MerchantDashboardActivityDto[];
}

export class MerchantAnalyticsResponseDto {
  @ApiProperty({ type: MerchantSuccessRateDto })
  successRate: MerchantSuccessRateDto;

  @ApiProperty({ type: [MerchantReturnReasonDto] })
  returnReasons: MerchantReturnReasonDto[];

  @ApiProperty({ type: [MerchantZonePerformanceDto] })
  zonePerformance: MerchantZonePerformanceDto[];

  @ApiProperty({ type: [MerchantCodTrendDto] })
  codTrend: MerchantCodTrendDto[];
}
