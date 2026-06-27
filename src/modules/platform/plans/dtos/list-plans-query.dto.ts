import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const toBoolean = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  return Boolean(value);
};

export enum PlanSortField {
  CREATED_AT = 'createdAt',
  NAME = 'name',
  PRICE = 'price',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListPlansQueryDto {
  @ApiProperty({ required: false, description: 'Search plan name or slug.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    type: Boolean,
    description: 'Filter by active plans.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    type: Boolean,
    description: 'Filter archived or non-archived plans.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  archived?: boolean;

  @ApiProperty({
    enum: PlanSortField,
    required: false,
    default: PlanSortField.CREATED_AT,
    description: 'Field used to sort plans.',
  })
  @IsOptional()
  @IsEnum(PlanSortField)
  sortBy?: PlanSortField = PlanSortField.CREATED_AT;

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
