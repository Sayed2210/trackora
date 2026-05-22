import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { FeatureFlagKey } from '../entities/platform-feature-flag.entity';

export class TenantFeatureFlagsParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;

  @ApiProperty({ enum: FeatureFlagKey })
  @IsEnum(FeatureFlagKey)
  key: FeatureFlagKey;
}
