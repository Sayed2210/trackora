import { IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FeatureFlagKey } from '../entities/platform-plan.entity';

export class PlanFeatureFlagDto {
  @ApiProperty({ enum: FeatureFlagKey })
  @IsEnum(FeatureFlagKey)
  key: FeatureFlagKey;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}
