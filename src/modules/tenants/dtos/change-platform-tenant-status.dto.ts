import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantStatus } from '../entities/tenant.entity';

export class ChangePlatformTenantStatusDto {
  @ApiProperty({ enum: TenantStatus })
  @IsEnum(TenantStatus)
  status: TenantStatus;
}
