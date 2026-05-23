import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeSubscriptionPlanDto {
  @ApiProperty({ format: 'uuid', description: 'Target platform plan ID.' })
  @IsUUID('4')
  planId: string;

  @ApiProperty({
    description: 'Required audit reason for changing the subscribed plan.',
    example: 'Merchant upgraded to Growth plan',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Optional date when the plan change becomes effective.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveDate?: Date;

  @ApiProperty({
    required: false,
    description: 'Whether to reset current-period usage immediately.',
  })
  @IsOptional()
  @IsBoolean()
  resetUsageNow?: boolean;
}
