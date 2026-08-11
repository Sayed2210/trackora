import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CloneTenantConfigurationDto {
  @ApiProperty({ example: 'Alexandria Express', minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'alexandria-express', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case (lowercase letters, numbers, hyphens)',
  })
  slug: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: 'Copy the source tenant metadata into the new tenant.',
  })
  @IsOptional()
  @IsBoolean()
  copyMetadata?: boolean = true;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description:
      'Copy tenant-specific feature flag overrides into the new tenant.',
  })
  @IsOptional()
  @IsBoolean()
  copyFeatureFlagOverrides?: boolean = true;
}

export class ClonedTenantSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Alexandria Express' })
  name: string;

  @ApiProperty({ example: 'alexandria-express' })
  slug: string;

  @ApiProperty({ enum: TenantStatus, example: TenantStatus.TRIAL })
  status: TenantStatus;
}

export class TenantConfigurationCloneSummaryDto {
  @ApiProperty({ example: true })
  metadata: boolean;

  @ApiProperty({ example: true })
  featureFlagOverrides: boolean;

  @ApiProperty({ example: 3, minimum: 0 })
  featureFlagOverrideCount: number;
}

export class CloneTenantConfigurationResponseDto {
  @ApiProperty({ type: ClonedTenantSummaryDto })
  tenant: ClonedTenantSummaryDto;

  @ApiProperty({ format: 'uuid' })
  clonedFromTenantId: string;

  @ApiProperty({ type: TenantConfigurationCloneSummaryDto })
  cloned: TenantConfigurationCloneSummaryDto;
}
