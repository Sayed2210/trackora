import { IsOptional, IsString } from 'class-validator';

export class CancelAssignmentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
