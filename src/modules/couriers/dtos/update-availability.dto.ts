import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  isAvailable!: boolean;
}
