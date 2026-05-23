import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';

export class SearchSupportTenantsQueryDto {
  @ApiProperty({
    required: false,
    description: 'Search tenant name or slug for support workflows.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    enum: TenantStatus,
    required: false,
    description: 'Filter tenants by lifecycle status.',
  })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

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
