import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from '../entities/courier.entity';
import { UserRole } from '@modules/users/entities/user.entity';

export class CreateCourierDto {
  @ApiProperty({ example: 'Ahmed Hassan', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message:
      'phone must be a valid Egyptian number (11 digits starting with 01)',
  })
  phone: string;

  @ApiPropertyOptional({ example: 'ahmed.hassan@trackora.test' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'CR-1024' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeId?: string;

  @ApiProperty({ enum: VehicleType, example: VehicleType.MOTORCYCLE })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiPropertyOptional({ example: 'ط ب ج 1234' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  licensePlate?: string;

  @ApiProperty({
    type: [String],
    minItems: 1,
    example: ['hay_sharq', 'hay_gharb'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  zoneCodes: string[];

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxDailyCapacity?: number = 25;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean = true;
}

export class CourierUserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ahmed Hassan' })
  name: string;

  @ApiProperty({ example: '01012345678' })
  phone: string;

  @ApiPropertyOptional({ example: 'ahmed.hassan@trackora.test', nullable: true })
  email: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.COURIER })
  role: UserRole;
}

export class CourierResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ type: CourierUserSummaryDto })
  user: CourierUserSummaryDto;

  @ApiProperty({ example: 'Ahmed Hassan' })
  name: string;

  @ApiProperty({ example: '01012345678' })
  phone: string;

  @ApiPropertyOptional({ example: 'ahmed.hassan@trackora.test', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ example: 'CR-1024', nullable: true })
  employeeId: string | null;

  @ApiProperty({ enum: VehicleType, example: VehicleType.MOTORCYCLE })
  vehicleType: VehicleType;

  @ApiPropertyOptional({ example: 'ط ب ج 1234', nullable: true })
  licensePlate: string | null;

  @ApiProperty({ type: [String], example: ['hay_sharq', 'hay_gharb'] })
  zoneCodes: string[];

  @ApiProperty({ example: 25 })
  maxDailyCapacity: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true })
  isAvailable: boolean;

  @ApiProperty({ example: 50 })
  currentPerformanceScore: number;

  @ApiProperty({ example: '0' })
  cashHeld: string;

  @ApiProperty({ example: '5000' })
  cashHeldLimit: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  avgDeliveryTimeMinutes: number | null;

  @ApiProperty({ example: 0 })
  totalDelivered: number;

  @ApiProperty({ example: 0 })
  totalFailed: number;

  @ApiProperty({ example: 0 })
  totalReturned: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class UpdateZonesDto {
  @ApiProperty({ type: [String], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  zoneCodes: string[];
}
