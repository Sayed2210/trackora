import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DemoRequestStatus } from '@prisma/client';

export class UpdateDemoRequestDto {
  @ApiProperty({
    enum: DemoRequestStatus,
    required: false,
    description:
      'Update the lead lifecycle status (NEW, CONTACTED, QUALIFIED, CONVERTED, REJECTED).',
  })
  @IsOptional()
  @IsEnum(DemoRequestStatus)
  status?: DemoRequestStatus;

  @ApiProperty({
    required: false,
    description: 'Internal notes added by a platform owner/admin.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    description:
      'Timestamp marking when the lead was first contacted. Set automatically when status moves to CONTACTED if omitted.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  contactedAt?: Date;
}
