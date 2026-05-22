import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { FeatureFlagKey } from '../entities/platform-feature-flag.entity';

export class FeatureFlagKeyParamDto {
  @ApiProperty({ enum: FeatureFlagKey })
  @IsEnum(FeatureFlagKey)
  key: FeatureFlagKey;
}
