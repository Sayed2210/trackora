import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartImpersonationDto {
  @ApiProperty({ example: 'Investigating merchant support ticket' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  targetUserId?: string;

  @ApiProperty({ required: false, default: 30, minimum: 1, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number = 30;
}
