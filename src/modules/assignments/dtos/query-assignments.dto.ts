import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  AssignmentStatus,
  AssignmentType,
} from '../entities/assignment.entity';

export class QueryAssignmentsDto {
  @IsOptional()
  @IsUUID('4')
  courierId?: string;

  @IsOptional()
  @IsUUID('4')
  shipmentId?: string;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

  @IsOptional()
  @IsEnum(AssignmentType)
  assignmentType?: AssignmentType;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
