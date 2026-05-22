import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AnalyticsDateRangeQueryDto } from './analytics-date-range-query.dto';

export enum AnalyticsGroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class AnalyticsUsageQueryDto extends AnalyticsDateRangeQueryDto {
  @ApiPropertyOptional({ enum: AnalyticsGroupBy, default: AnalyticsGroupBy.DAY })
  @IsOptional()
  @IsEnum(AnalyticsGroupBy)
  groupBy?: AnalyticsGroupBy;

  @ApiPropertyOptional({ description: 'Optional metric hint for clients' })
  @IsOptional()
  @IsString()
  metric?: string;
}
