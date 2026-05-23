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
import { PaymentStatus } from '@prisma/client';

export enum InvoiceSortField {
  CREATED_AT = 'createdAt',
  DUE_DATE = 'dueDate',
  AMOUNT = 'amount',
  STATUS = 'status',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListInvoicesQueryDto {
  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Filter invoices by tenant ID.',
  })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiProperty({
    enum: PaymentStatus,
    required: false,
    description: 'Filter by invoice status.',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiProperty({
    enum: PaymentStatus,
    required: false,
    description: 'Filter by invoice payment status.',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description:
      'Filter invoices created or due on or after this date, according to service rules.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description:
      'Filter invoices created or due on or before this date, according to service rules.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiProperty({
    required: false,
    description: 'Search invoice reference, tenant, or notes fields.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    enum: InvoiceSortField,
    required: false,
    default: InvoiceSortField.CREATED_AT,
    description: 'Field used to sort invoices.',
  })
  @IsOptional()
  @IsEnum(InvoiceSortField)
  sortBy?: InvoiceSortField = InvoiceSortField.CREATED_AT;

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
