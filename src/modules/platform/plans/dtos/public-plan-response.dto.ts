import { ApiProperty } from '@nestjs/swagger';

export class PublicPlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  priceMonthly: string;

  @ApiProperty({ nullable: true })
  priceYearly: string | null;

  @ApiProperty()
  currency: string;

  @ApiProperty({ nullable: true })
  shipmentLimit: number | null;

  @ApiProperty({ type: [String] })
  features: string[];

  @ApiProperty()
  isPopular: boolean;

  @ApiProperty()
  ctaLabel: string;

  @ApiProperty()
  ctaHref: string;
}