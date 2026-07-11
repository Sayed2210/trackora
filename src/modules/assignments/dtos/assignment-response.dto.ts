import { ApiProperty } from '@nestjs/swagger';
import { UserRole, VehicleType } from '@prisma/client';
import {
  AssignmentStatus,
  AssignmentType,
} from '../entities/assignment.entity';
import { ShipmentResponseDto } from '@modules/shipments/dtos/shipment-response.dto';

export class AssignmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  shipmentId: string;

  @ApiProperty({ format: 'uuid' })
  courierId: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  assignedByUserId: string | null;

  @ApiProperty({ enum: AssignmentType })
  assignmentType: AssignmentType;

  @ApiProperty({ enum: AssignmentStatus })
  status: AssignmentStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  assignedAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt: Date | null;

  @ApiProperty({ nullable: true })
  cancellationReason: string | null;
}

export class AssignmentCourierUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  tenantId: string | null;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty()
  phone: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  emailVerified: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  phoneVerified: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class AssignmentCourierResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  tenantId: string | null;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ nullable: true })
  employeeId: string | null;

  @ApiProperty({ enum: VehicleType })
  vehicleType: VehicleType;

  @ApiProperty({ nullable: true })
  licensePlate: string | null;

  @ApiProperty({ type: [String] })
  zoneCodes: string[];

  @ApiProperty()
  maxDailyCapacity: number;

  @ApiProperty()
  currentPerformanceScore: number;

  @ApiProperty({ type: String, example: '0.00' })
  cashHeld: string;

  @ApiProperty({ type: String, example: '5000.00' })
  cashHeldLimit: string;

  @ApiProperty({ type: Object, nullable: true })
  documents: unknown;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isAvailable: boolean;

  @ApiProperty({ nullable: true })
  avgDeliveryTimeMinutes: number | null;

  @ApiProperty()
  totalDelivered: number;

  @ApiProperty()
  totalFailed: number;

  @ApiProperty()
  totalReturned: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ type: AssignmentCourierUserResponseDto })
  user: AssignmentCourierUserResponseDto;
}

export class AssignmentListItemResponseDto extends AssignmentResponseDto {
  @ApiProperty({ type: ShipmentResponseDto })
  shipment: ShipmentResponseDto;

  @ApiProperty({ type: AssignmentCourierResponseDto })
  courier: AssignmentCourierResponseDto;
}

export class PaginatedAssignmentsResponseDto {
  @ApiProperty({ type: [AssignmentListItemResponseDto] })
  data: AssignmentListItemResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
