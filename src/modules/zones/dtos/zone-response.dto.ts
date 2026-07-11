import { ApiProperty } from '@nestjs/swagger';
import { ZoneLevel } from '../entities/zone.entity';

export class ZoneResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  parentId: string | null;

  @ApiProperty({ enum: ZoneLevel })
  level: ZoneLevel;

  @ApiProperty()
  nameAr: string;

  @ApiProperty({ nullable: true })
  nameEn: string | null;

  @ApiProperty()
  code: string;

  @ApiProperty({ type: Object, nullable: true })
  polygon: unknown;

  @ApiProperty({ nullable: true })
  centerLat: number | null;

  @ApiProperty({ nullable: true })
  centerLng: number | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class PaginatedZonesResponseDto {
  @ApiProperty({ type: [ZoneResponseDto] })
  data: ZoneResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
