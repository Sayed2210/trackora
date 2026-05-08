import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/prisma/prisma.service';
import { TransactionsService } from '../services/transactions.service';
import { FeeCalculatorService } from '../services/fee-calculator.service';
import { WalletsService } from '../services/wallets.service';
import { TransactionType, ShipmentType } from '@prisma/client';

interface ShipmentDeliveredEvent {
  shipmentId: string;
  merchantId: string;
  courierId?: string;
  codAmount: number;
  collectedCash: number;
  type: ShipmentType;
}

@Injectable()
export class ShipmentDeliveredListener {
  private readonly logger = new Logger(ShipmentDeliveredListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly walletsService: WalletsService,
  ) {}

  @OnEvent('shipment.delivered')
  async handleShipmentDelivered(event: ShipmentDeliveredEvent): Promise<void> {
    if (event.type !== ShipmentType.COD) {
      this.logger.debug(
        `Shipment ${event.shipmentId} is not COD, skipping wallet credit`,
      );
      return;
    }

    try {
      await this.processCodCredit(event);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to process COD credit for shipment ${event.shipmentId}: ${err.message}`,
        err.stack,
      );
      // In production, this should be sent to a dead-letter queue for manual review
      throw error;
    }
  }

  private async processCodCredit(event: ShipmentDeliveredEvent): Promise<void> {
    const { shipmentId, merchantId, codAmount } = event;

    // Fetch merchant fee structure
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new Error(`Merchant not found: ${merchantId}`);
    }

    // Ensure wallet exists
    const wallet = await this.walletsService.getOrCreateWallet(merchantId);

    // Calculate fees
    const breakdown = this.feeCalculatorService.calculateNetCredit(codAmount, {
      commissionRate: Number(merchant.commissionRate),
      feePerShipment: Number(merchant.feePerShipment),
    });

    this.logger.log(
      `Processing COD credit for shipment ${shipmentId}: gross=${breakdown.grossCod}, commission=${breakdown.commission}, fee=${breakdown.fee}, net=${breakdown.netCredit}`,
    );

    // Create 3 transactions atomically via TransactionService (each has its own optimistic lock + retry)
    // 1. COD_CREDIT (net amount credited to merchant)
    await this.transactionsService.createCredit({
      walletId: wallet.id,
      shipmentId,
      type: TransactionType.COD_CREDIT,
      amount: breakdown.netCredit,
      description: `COD credit for shipment ${shipmentId} (net after fees)`,
      metadata: {
        grossCod: breakdown.grossCod,
        commission: breakdown.commission,
        fee: breakdown.fee,
        netCredit: breakdown.netCredit,
        source: 'cod_delivery',
      },
    });

    // 2. COMMISSION_DEBIT
    if (breakdown.commission > 0) {
      await this.transactionsService.createDebit({
        walletId: wallet.id,
        shipmentId,
        type: TransactionType.COMMISSION_DEBIT,
        amount: breakdown.commission,
        description: `Commission fee for COD shipment ${shipmentId}`,
        metadata: {
          rate: Number(merchant.commissionRate),
          baseAmount: breakdown.grossCod,
        },
      });
    }

    // 3. FEE_DEBIT (per-shipment fee)
    if (breakdown.fee > 0) {
      await this.transactionsService.createDebit({
        walletId: wallet.id,
        shipmentId,
        type: TransactionType.FEE_DEBIT,
        amount: breakdown.fee,
        description: `Delivery fee for shipment ${shipmentId}`,
        metadata: {
          feePerShipment: Number(merchant.feePerShipment),
        },
      });
    }

    this.logger.log(
      `COD credit flow completed for shipment ${shipmentId}, wallet ${wallet.id}`,
    );
  }
}
