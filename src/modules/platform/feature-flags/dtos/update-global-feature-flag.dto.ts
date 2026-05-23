import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateGlobalFeatureFlagDto {
  @ApiProperty({
    description: 'New platform-wide default state for the feature flag.',
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    minLength: 1,
    description:
      'Required audit reason for changing the global feature flag default.',
    example: 'Enable beta analytics for all tenants',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
