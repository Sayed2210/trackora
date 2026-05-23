import { Type } from 'class-transformer';
import {
  IsDate,
  IsDecimal,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateManualInvoiceDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Tenant ID that the manual invoice belongs to.',
  })
  @IsUUID('4')
  tenantId: string;

  @ApiProperty({ example: '1500.00' })
  @IsDecimal({ decimal_digits: '0,2' })
  amount: string;

  @ApiProperty({ required: false, default: 'EGP' })
  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string = 'EGP';

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  billingPeriodStart?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  billingPeriodEnd?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({
    example: 'Manual correction for May billing cycle',
    description: 'Required audit reason for creating the manual invoice.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
