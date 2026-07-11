import { ApiProperty } from '@nestjs/swagger';
import {
  ReturnReason,
  ShipmentStatus,
  ShipmentType,
} from '../entities/shipment.entity';

export class ShipmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  tenantId: string | null;

  @ApiProperty()
  trackingNumber: string;

  @ApiProperty({ format: 'uuid' })
  merchantId: string;

  @ApiProperty({ enum: ShipmentStatus })
  status: ShipmentStatus;

  @ApiProperty({ enum: ShipmentType })
  type: ShipmentType;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  customerPhone: string;

  @ApiProperty({ nullable: true })
  customerPhone2: string | null;

  @ApiProperty({ type: Object })
  address: unknown;

  @ApiProperty()
  addressText: string;

  @ApiProperty({ type: Object, nullable: true })
  geoLocation: unknown;

  @ApiProperty({ format: 'uuid', nullable: true })
  zoneId: string | null;

  @ApiProperty({ type: String, example: '150.00' })
  codAmount: string;

  @ApiProperty()
  productDescription: string;

  @ApiProperty({ type: String, example: '200.00' })
  productValue: string;

  @ApiProperty({ type: String, example: '1.50' })
  weight: string;

  @ApiProperty()
  pieces: number;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty()
  deliveryAttempts: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  preferredDeliveryDate: Date | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  assignedCourierId: string | null;

  @ApiProperty({ enum: ReturnReason, nullable: true })
  returnReason: ReturnReason | null;

  @ApiProperty({ nullable: true })
  returnNotes: string | null;

  @ApiProperty({ type: String, nullable: true, example: '150.00' })
  collectedCash: string | null;

  @ApiProperty({ nullable: true })
  customerOtp: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deliveredAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  returnedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt: Date | null;

  @ApiProperty()
  autoDispatchEligible: boolean;

  @ApiProperty()
  addressVerified: boolean;

  @ApiProperty()
  riskScore: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class PaginatedShipmentsResponseDto {
  @ApiProperty({ type: [ShipmentResponseDto] })
  data: ShipmentResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
