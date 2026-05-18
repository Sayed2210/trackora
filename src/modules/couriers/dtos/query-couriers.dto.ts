import { IsOptional, IsString, IsBooleanString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryCouriersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  isAvailable?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zoneCode?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsString()
  limit?: string;
}
