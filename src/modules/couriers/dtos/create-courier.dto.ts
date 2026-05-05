import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '../entities/courier.entity';

export class CreateCourierDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({ enum: VehicleType, default: VehicleType.MOTORCYCLE })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  zoneCodes: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  licensePlate?: string;
}

export class UpdateZonesDto {
  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  zoneCodes: string[];
}
