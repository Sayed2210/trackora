import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDecimal,
  IsInt,
  IsISO4217CurrencyCode,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlanFeatureFlagDto } from './plan-feature-flag.dto';

export class UpdatePlanDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  monthlyPrice?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  monthlyShipmentLimit?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adminUserLimit?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  merchantLimit?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courierLimit?: number | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [PlanFeatureFlagDto], required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique((flag: PlanFeatureFlagDto) => flag.key)
  @ValidateNested({ each: true })
  @Type(() => PlanFeatureFlagDto)
  featureEntitlements?: PlanFeatureFlagDto[];
}
