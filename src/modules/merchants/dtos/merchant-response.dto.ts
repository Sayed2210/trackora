import { ApiProperty } from '@nestjs/swagger';
import { KycStatus, TransactionType } from '@prisma/client';

export class MerchantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  tenantId: string | null;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  businessName: string;

  @ApiProperty()
  businessType: string;

  @ApiProperty({ nullable: true })
  websiteUrl: string | null;

  @ApiProperty({ nullable: true })
  socialMediaUrl: string | null;

  @ApiProperty({ enum: KycStatus })
  kycStatus: KycStatus;

  @ApiProperty({ type: Object, nullable: true })
  kycDocuments: unknown;

  @ApiProperty({ type: String, example: '0.0500' })
  commissionRate: string;

  @ApiProperty({ type: String, example: '10.00' })
  feePerShipment: string;

  @ApiProperty({ type: String, example: '5.00' })
  returnFee: string;

  @ApiProperty({ type: String, example: '5.00' })
  cancellationFee: string;

  @ApiProperty({ type: String, example: '0.00' })
  creditLimit: string;

  @ApiProperty({ type: Object, nullable: true })
  defaultPickupAddress: unknown;

  @ApiProperty({ type: Object, nullable: true })
  branding: unknown;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class PaginatedMerchantsResponseDto {
  @ApiProperty({ type: [MerchantResponseDto] })
  data: MerchantResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class MerchantWalletResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  merchantId: string;

  @ApiProperty()
  balance: number;

  @ApiProperty()
  availableBalance: number;

  @ApiProperty()
  pendingBalance: number;

  @ApiProperty()
  totalCredited: number;

  @ApiProperty()
  totalDebited: number;

  @ApiProperty({ example: 'EGP' })
  currency: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class WalletTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  walletId: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  shipmentId: string | null;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ type: String, example: '150.00' })
  amount: string;

  @ApiProperty({ type: String, example: '950.00' })
  runningBalance: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: Object, nullable: true })
  metadata: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class PaginatedWalletTransactionsResponseDto {
  @ApiProperty({ type: [WalletTransactionResponseDto] })
  data: WalletTransactionResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
