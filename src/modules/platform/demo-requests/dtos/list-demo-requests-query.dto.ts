import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DemoRequestStatus } from '@prisma/client';

export enum DemoRequestSortField {
  CREATED_AT = 'createdAt',
}

export enum DemoRequestSortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListDemoRequestsQueryDto {
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

  @ApiProperty({
    enum: DemoRequestStatus,
    required: false,
    description: 'Filter demo requests by lifecycle status.',
  })
  @IsOptional()
  @IsEnum(DemoRequestStatus)
  status?: DemoRequestStatus;

  @ApiProperty({
    required: false,
    description: 'Filter by business type (e.g. E-commerce, Social Seller).',
  })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiProperty({
    required: false,
    description:
      'Search across lead name, company name, phone, and email (case-insensitive).',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Filter demo requests created on or after this date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Filter demo requests created on or before this date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiProperty({
    enum: DemoRequestSortField,
    required: false,
    default: DemoRequestSortField.CREATED_AT,
    description: 'Field used to sort demo requests.',
  })
  @IsOptional()
  @IsEnum(DemoRequestSortField)
  sortBy?: DemoRequestSortField = DemoRequestSortField.CREATED_AT;

  @ApiProperty({
    enum: DemoRequestSortDirection,
    required: false,
    default: DemoRequestSortDirection.DESC,
    description: 'Sort direction.',
  })
  @IsOptional()
  @IsEnum(DemoRequestSortDirection)
  sortOrder?: DemoRequestSortDirection = DemoRequestSortDirection.DESC;
}
