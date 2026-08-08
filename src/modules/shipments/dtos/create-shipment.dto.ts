import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  ValidateIf,
  IsObject,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ShipmentType } from '../entities/shipment.entity';

export class CreateShipmentDto {
  @ApiProperty({
    required: false,
    description:
      'Required for tenant admins creating on behalf of a merchant; ignored for merchant users.',
  })
  @IsOptional()
  @IsUUID('4')
  merchantId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerPhone2?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  address: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  addressText: string;

  @ApiProperty({ enum: ShipmentType })
  @IsEnum(ShipmentType)
  type: ShipmentType;

  @ApiProperty({ required: false })
  @ValidateIf((o: CreateShipmentDto) => o.type === ShipmentType.COD)
  @IsNumber()
  codAmount?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productDescription: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  productValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  pieces?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  preferredDeliveryDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  zoneId?: string;
}
