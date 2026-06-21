import { ApiProperty } from '@nestjs/swagger';
import { DemoRequestStatus } from '@prisma/client';

export class DemoRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ahmed Ali' })
  name: string;

  @ApiProperty({ example: 'Cairo Express' })
  companyName: string;

  @ApiProperty({ example: '01012345678' })
  phone: string;

  @ApiProperty({ required: false, example: 'ahmed@cairoexpress.com' })
  email: string | null;

  @ApiProperty({ example: 'E-commerce' })
  businessType: string;

  @ApiProperty({ required: false, example: '500-1000' })
  monthlyShipments: string | null;

  @ApiProperty({ required: false, example: 'I want a demo for my team' })
  message: string | null;

  @ApiProperty({ required: false, example: 'growth' })
  interestedPlanSlug: string | null;

  @ApiProperty({ enum: DemoRequestStatus })
  status: DemoRequestStatus;

  @ApiProperty({ required: false, format: 'date-time' })
  contactedAt: Date | null;

  @ApiProperty({ required: false })
  notes: string | null;

  @ApiProperty({ required: false })
  ipAddress: string | null;

  @ApiProperty({ required: false })
  userAgent: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}
