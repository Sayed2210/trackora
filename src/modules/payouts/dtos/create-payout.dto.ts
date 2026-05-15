import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsObject, Min } from 'class-validator';
import { PayoutMethod } from '@prisma/client';

export class CreatePayoutDto {
  @ApiProperty({ example: 1000 })
  @Type(() => Number)
  @IsNumber()
  @Min(500)
  amount: number;

  @ApiProperty({ enum: PayoutMethod, example: PayoutMethod.INSTAPAY })
  @IsEnum(PayoutMethod)
  method: PayoutMethod;

  @ApiProperty({
    type: Object,
    example: {
      accountName: 'Ahmed Mohamed',
      accountNumber: '1234567890',
      bankName: 'CIB',
    },
  })
  @IsObject()
  destination: Record<string, unknown>;
}
