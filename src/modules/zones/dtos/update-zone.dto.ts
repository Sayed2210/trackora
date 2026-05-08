import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ZoneLevel } from '../entities/zone.entity';

export class UpdateZoneDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ enum: ZoneLevel, required: false })
  @IsOptional()
  @IsEnum(ZoneLevel)
  level?: ZoneLevel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  polygon?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  centerLat?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  centerLng?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
