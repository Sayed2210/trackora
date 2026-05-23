import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateTenantFeatureFlagDto {
  @ApiProperty({
    type: Boolean,
    nullable: true,
    description:
      '`true` or `false` sets a tenant override; `null` removes the override.',
  })
  @IsIn([true, false, null])
  enabled: boolean | null;

  @ApiProperty({
    minLength: 1,
    description:
      'Required audit reason for changing the tenant feature flag override.',
    example: 'Temporarily disable feature during tenant support incident',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
