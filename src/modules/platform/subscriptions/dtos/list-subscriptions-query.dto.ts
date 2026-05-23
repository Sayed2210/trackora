import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentStatus,
  SubscriptionStatus,
} from '../entities/platform-subscription.entity';

export enum SubscriptionSortField {
  CREATED_AT = 'createdAt',
  RENEWAL_DATE = 'renewalDate',
  STATUS = 'status',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListSubscriptionsQueryDto {
  @ApiProperty({
    required: false,
    description: 'Search tenant, plan, or subscription reference fields.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    enum: SubscriptionStatus,
    required: false,
    description: 'Filter by subscription lifecycle status.',
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiProperty({
    enum: PaymentStatus,
    required: false,
    description: 'Filter by subscription payment status.',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Filter by platform plan ID.',
  })
  @IsOptional()
  @IsUUID('4')
  planId?: string;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Filter by tenant ID.',
  })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description:
      'Filter subscriptions with renewal date on or after this date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  renewalFrom?: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description:
      'Filter subscriptions with renewal date on or before this date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  renewalTo?: Date;

  @ApiProperty({
    enum: SubscriptionSortField,
    required: false,
    default: SubscriptionSortField.CREATED_AT,
    description: 'Field used to sort subscriptions.',
  })
  @IsOptional()
  @IsEnum(SubscriptionSortField)
  sortBy?: SubscriptionSortField = SubscriptionSortField.CREATED_AT;

  @ApiProperty({
    enum: SortDirection,
    required: false,
    default: SortDirection.DESC,
    description: 'Sort direction.',
  })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection = SortDirection.DESC;

  @ApiProperty({
    required: false,
    type: Number,
    default: 1,
    minimum: 1,
    description: 'Page number for pagination.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    required: false,
    type: Number,
    default: 20,
    minimum: 1,
    description: 'Maximum records per page.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
