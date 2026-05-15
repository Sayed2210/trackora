import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayoutMethod, PayoutStatus } from '@prisma/client';

export class PayoutResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  merchantId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: PayoutStatus })
  status: PayoutStatus;

  @ApiProperty({ enum: PayoutMethod })
  method: PayoutMethod;

  @ApiProperty({ type: Object })
  destination: Record<string, unknown>;

  @ApiPropertyOptional()
  approvedByUserId?: string | null;

  @ApiPropertyOptional()
  processedAt?: Date | null;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  @ApiPropertyOptional()
  referenceNumber?: string | null;

  @ApiPropertyOptional()
  rejectionReason?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedPayoutsResponseDto {
  @ApiProperty({ type: [PayoutResponseDto] })
  data: PayoutResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
