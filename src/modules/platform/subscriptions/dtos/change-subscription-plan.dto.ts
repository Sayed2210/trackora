import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeSubscriptionPlanDto {
  @ApiProperty()
  @IsUUID('4')
  planId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  resetUsageNow?: boolean;
}
