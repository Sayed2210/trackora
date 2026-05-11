import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelAssignmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
