import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/prisma/prisma.service';
import { FeeCalculatorService } from '../services/fee-calculator.service';
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
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly eventEmitter: EventEmitter2,
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
      await this.processCodCreditAtomic(event);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to process COD credit for shipment ${event.shipmentId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  private async processCodCreditAtomic(event: ShipmentDeliveredEvent): Promise<void> {
    const { shipmentId, merchantId, codAmount } = event;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const merchant = await tx.merchant.findUnique({
            where: { id: merchantId },
          });

          if (!merchant) {
            throw new Error(`Merchant not found: ${merchantId}`);
          }

          let wallet = await tx.wallet.findUnique({
            where: { merchantId },
          });

          if (!wallet) {
            wallet = await tx.wallet.create({
              data: {
                merchantId,
                balance: 0,
                pendingBalance: 0,
                totalCredited: 0,
                totalDebited: 0,
                version: 0,
              },
            });
          }

          const breakdown = this.feeCalculatorService.calculateNetCredit(codAmount, {
            commissionRate: Number(merchant.commissionRate),
            feePerShipment: Number(merchant.feePerShipment),
          });

          const currentVersion = wallet.version;
          const currentBalance = Number(wallet.balance);
          const currentTotalCredited = Number(wallet.totalCredited);
          const currentTotalDebited = Number(wallet.totalDebited);

          const netCredit = breakdown.netCredit;
          const commission = breakdown.commission;
          const fee = breakdown.fee;

          const newBalance = currentBalance + netCredit - commission - fee;
          const newTotalCredited = currentTotalCredited + netCredit;
          const newTotalDebited = currentTotalDebited + commission + fee;
          const newVersion = currentVersion + 1;

          const updated = await tx.wallet.updateMany({
            where: { id: wallet.id, version: currentVersion },
            data: {
              balance: newBalance,
              totalCredited: newTotalCredited,
              totalDebited: newTotalDebited,
              version: newVersion,
            },
          });

          if (updated.count === 0) {
            throw new Error('VERSION_CONFLICT');
          }

          let runningBalance = currentBalance;

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              shipmentId,
              type: TransactionType.COD_CREDIT,
              amount: netCredit,
              runningBalance: runningBalance + netCredit,
              description: `COD credit for shipment ${shipmentId} (net after fees)`,
              metadata: {
                grossCod: breakdown.grossCod,
                commission: breakdown.commission,
                fee: breakdown.fee,
                netCredit: breakdown.netCredit,
                source: 'cod_delivery',
              },
            },
          });
          runningBalance += netCredit;

          if (commission > 0) {
            await tx.transaction.create({
              data: {
                walletId: wallet.id,
                shipmentId,
                type: TransactionType.COMMISSION_DEBIT,
                amount: -commission,
                runningBalance: runningBalance - commission,
                description: `Commission fee for COD shipment ${shipmentId}`,
                metadata: {
                  rate: Number(merchant.commissionRate),
                  baseAmount: breakdown.grossCod,
                },
              },
            });
            runningBalance -= commission;
          }

          if (fee > 0) {
            await tx.transaction.create({
              data: {
                walletId: wallet.id,
                shipmentId,
                type: TransactionType.FEE_DEBIT,
                amount: -fee,
                runningBalance: runningBalance - fee,
                description: `Delivery fee for shipment ${shipmentId}`,
                metadata: {
                  feePerShipment: Number(merchant.feePerShipment),
                },
              },
            });
            runningBalance -= fee;
          }

          this.logger.log(
            `Atomic COD credit completed for shipment ${shipmentId}, wallet ${wallet.id}: balance=${newBalance}`,
          );

          this.eventEmitter.emit('wallet.balance_updated', {
            walletId: wallet.id,
            merchantId,
            balance: newBalance,
            transactionType: 'COD_CREDIT',
            amount: netCredit,
            runningBalance: newBalance,
          });
        });

        return;
      } catch (error: unknown) {
        const err = error as Error;
        if (err.message === 'VERSION_CONFLICT') {
          if (attempt < this.MAX_RETRIES - 1) {
            const delay = this.BASE_DELAY_MS * Math.pow(2, attempt);
            this.logger.warn(
              `Wallet version conflict for merchant ${merchantId}, retry ${attempt + 1}/${this.MAX_RETRIES} in ${delay}ms`,
            );
            await this.sleep(delay);
            continue;
          }
          throw new Error(
            `Failed to process COD credit after ${this.MAX_RETRIES} retries for shipment ${shipmentId}`,
          );
        }
        throw error;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}