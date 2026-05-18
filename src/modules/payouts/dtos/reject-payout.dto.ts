import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPayoutDto {
  @ApiProperty({ example: 'Invalid bank account details' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
