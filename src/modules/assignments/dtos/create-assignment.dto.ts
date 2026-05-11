import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentType } from '../entities/assignment.entity';

export class CreateAssignmentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  shipmentIds!: string[];

  @ApiProperty()
  @IsUUID('4')
  courierId!: string;

  @ApiPropertyOptional({ enum: AssignmentType, default: AssignmentType.MANUAL })
  @IsEnum(AssignmentType)
  type: AssignmentType = AssignmentType.MANUAL;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
