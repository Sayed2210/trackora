import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartImpersonationDto {
  @ApiProperty({
    example: 'Investigating merchant support ticket',
    description: 'Required audit reason for starting impersonation.',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description:
      'Optional tenant user ID to impersonate. If omitted, service selects the tenant admin according to current rules.',
  })
  @IsOptional()
  @IsUUID('4')
  targetUserId?: string;

  @ApiProperty({
    required: false,
    default: 30,
    minimum: 1,
    maximum: 60,
    description: 'Requested session duration in minutes.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number = 30;
}
