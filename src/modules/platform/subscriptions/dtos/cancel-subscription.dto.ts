import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelSubscriptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;
}
