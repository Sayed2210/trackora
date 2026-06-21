import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export enum BillingExportFormat {
  CSV = 'csv',
  JSON = 'json',
}

export class BillingExportQueryDto {
  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  from: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  to: Date;

  @ApiProperty({ enum: PaymentStatus, required: false })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiProperty({
    enum: BillingExportFormat,
    required: false,
    default: BillingExportFormat.JSON,
  })
  @IsOptional()
  @IsEnum(BillingExportFormat)
  format?: BillingExportFormat = BillingExportFormat.JSON;
}
