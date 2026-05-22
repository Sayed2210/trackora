import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { AnalyticsDateRangeQueryDto } from './analytics-date-range-query.dto';

export class AnalyticsShipmentsQueryDto extends AnalyticsDateRangeQueryDto {
  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;
}
