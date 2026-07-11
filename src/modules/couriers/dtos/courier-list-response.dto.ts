import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '../entities/courier.entity';

export class CourierListItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty({ nullable: true })
  employeeId: string | null;

  @ApiProperty({ enum: VehicleType })
  vehicleType: VehicleType;

  @ApiProperty({ nullable: true })
  licensePlate: string | null;

  @ApiProperty({ type: [String] })
  zoneCodes: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isAvailable: boolean;

  @ApiProperty()
  currentTasks: number;

  @ApiProperty()
  maxDailyCapacity: number;

  @ApiProperty()
  capacity: number;

  @ApiProperty()
  rating: number;

  @ApiProperty({ type: String, example: '0.00' })
  cashHeld: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class CourierListMetaResponseDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedCouriersResponseDto {
  @ApiProperty({ type: [CourierListItemResponseDto] })
  data: CourierListItemResponseDto[];

  @ApiProperty({ type: CourierListMetaResponseDto })
  meta: CourierListMetaResponseDto;
}
