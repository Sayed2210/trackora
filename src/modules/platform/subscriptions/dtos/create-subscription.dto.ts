import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentStatus,
  SubscriptionStatus,
} from '../entities/platform-subscription.entity';

export class CreateSubscriptionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Tenant workspace to subscribe.',
  })
  @IsUUID('4')
  tenantId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Platform plan to subscribe the tenant to.',
  })
  @IsUUID('4')
  planId: string;

  @ApiProperty({
    description:
      'Required audit reason for creating the subscription manually.',
    example: 'Onboarding merchant after offline contract signature',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({
    enum: SubscriptionStatus,
    required: false,
    default: SubscriptionStatus.TRIALING,
    description:
      'Initial subscription lifecycle status. Defaults to TRIALING for new tenants.',
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiProperty({
    enum: PaymentStatus,
    required: false,
    default: PaymentStatus.NOT_REQUIRED,
    description: 'Initial payment status for the subscription.',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Optional trial start date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  trialStartsAt?: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Optional trial end date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  trialEndsAt?: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Optional current billing period start date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  currentPeriodStart?: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Optional current billing period end date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  currentPeriodEnd?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
