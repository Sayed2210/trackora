import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelSubscriptionDto {
  @ApiProperty({
    description: 'Required audit reason for cancelling the subscription.',
    example: 'Tenant requested cancellation',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({
    required: false,
    description:
      'When true, cancellation is deferred until current period end.',
  })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;
}
