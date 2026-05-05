import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  ShipmentStatus,
  ReturnReason,
} from '@modules/shipments/entities/shipment.entity';

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: ShipmentStatus })
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;

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
  photoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  gpsLocation?: { lat: number; lng: number };

  @ApiProperty({ required: false, enum: ReturnReason })
  @IsOptional()
  @IsEnum(ReturnReason)
  returnReason?: ReturnReason;
}
