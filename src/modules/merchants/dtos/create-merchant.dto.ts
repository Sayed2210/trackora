import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMerchantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  commissionRate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  feePerShipment?: string;
}

export class UpdateFeesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  commissionRate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  feePerShipment?: string;
}
