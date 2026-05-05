import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ReassignAssignmentDto {
  @IsUUID('4')
  newCourierId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
