import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
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
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  actorUserId?: string;

  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  actorRole?: UserRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  resourceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ enum: AuditLogSortField, required: false, default: AuditLogSortField.CREATED_AT })
  @IsOptional()
  @IsEnum(AuditLogSortField)
  sortBy?: AuditLogSortField = AuditLogSortField.CREATED_AT;

  @ApiProperty({ enum: SortDirection, required: false, default: SortDirection.DESC })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection = SortDirection.DESC;

  @ApiProperty({ required: false, type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, type: Number, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
