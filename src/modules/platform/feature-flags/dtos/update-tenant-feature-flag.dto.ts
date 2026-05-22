import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateTenantFeatureFlagDto {
  @ApiProperty({ nullable: true, oneOf: [{ type: 'boolean' }, { type: 'null' }] })
  @IsIn([true, false, null])
  enabled: boolean | null;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
