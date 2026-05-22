import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateGlobalFeatureFlagDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
