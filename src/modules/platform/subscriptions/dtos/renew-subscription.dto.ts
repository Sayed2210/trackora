import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../entities/platform-subscription.entity';

export class RenewSubscriptionDto {
  @ApiProperty({
    description: 'Required audit reason for renewing the subscription.',
    example: 'Manual renewal after offline payment',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'New current period end date.',
  })
  @Type(() => Date)
  @IsDate()
  currentPeriodEnd: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Optional new current period start date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  currentPeriodStart?: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Optional next renewal date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  renewalDate?: Date;

  @ApiProperty({ enum: PaymentStatus, required: false })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
