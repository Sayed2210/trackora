import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CompletePayoutDto {
  @ApiProperty({ example: 'REF-2026-001' })
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;
}
