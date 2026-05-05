import { IsArray, IsEnum, IsUUID, ArrayMinSize } from 'class-validator';
import { AssignmentType } from '../entities/assignment.entity';

export class CreateAssignmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  shipmentIds!: string[];

  @IsUUID('4')
  courierId!: string;

  @IsEnum(AssignmentType)
  type: AssignmentType = AssignmentType.MANUAL;
}
