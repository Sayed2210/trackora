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
import { UserRole } from '@prisma/client';

export enum AuditLogSortField {
  CREATED_AT = 'createdAt',
  ACTION = 'action',
  RESOURCE_TYPE = 'resourceType',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListAuditLogsQueryDto {
  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Filter audit logs by actor user ID.',
  })
  @IsOptional()
  @IsUUID('4')
  actorUserId?: string;

  @ApiProperty({
    enum: UserRole,
    required: false,
    description: 'Filter audit logs by actor role.',
  })
  @IsOptional()
  @IsEnum(UserRole)
  actorRole?: UserRole;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Filter audit logs by tenant ID.',
  })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by audited action name.',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by audited resource type.',
  })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Filter by audited resource ID.',
  })
  @IsOptional()
  @IsUUID('4')
  resourceId?: string;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Filter logs created on or after this date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description: 'Filter logs created on or before this date.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiProperty({
    required: false,
    description: 'Search audit action, resource, or actor fields.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    enum: AuditLogSortField,
    required: false,
    default: AuditLogSortField.CREATED_AT,
    description: 'Field used to sort audit logs.',
  })
  @IsOptional()
  @IsEnum(AuditLogSortField)
  sortBy?: AuditLogSortField = AuditLogSortField.CREATED_AT;

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
