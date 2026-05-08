import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ZoneLevel } from '../entities/zone.entity';

export class ListZonesDto {
  @ApiProperty({ enum: ZoneLevel, required: false })
  @IsOptional()
  @IsEnum(ZoneLevel)
  level?: ZoneLevel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;
}
