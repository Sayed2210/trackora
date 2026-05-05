import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ShipmentStatus, ReturnReason } from '../entities/shipment.entity';

export class UpdateShipmentStatusDto {
  @ApiProperty({ enum: ShipmentStatus })
  @IsEnum(ShipmentStatus)
  newStatus!: ShipmentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  otp?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  collectedCash?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  gpsLocation?: Record<string, unknown>;

  @ApiProperty({ required: false, enum: ReturnReason })
  @IsOptional()
  @IsEnum(ReturnReason)
  returnReason?: ReturnReason;
}
