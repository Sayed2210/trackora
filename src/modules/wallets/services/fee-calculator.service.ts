import { Injectable } from '@nestjs/common';

export interface FeeStructure {
  commissionRate: number;
  feePerShipment: number;
  returnFee?: number;
  cancellationFee?: number;
}

export interface FeeBreakdown {
  grossCod: number;
  commission: number;
  fee: number;
  netCredit: number;
}

@Injectable()
export class FeeCalculatorService {
  calculateNetCredit(
    codAmount: number,
    feeStructure: FeeStructure,
  ): FeeBreakdown {
    const grossCod = Math.max(0, codAmount);
    const commission = grossCod * feeStructure.commissionRate;
    const fee = feeStructure.feePerShipment;
    const netCredit = grossCod - commission - fee;

    return {
      grossCod,
      commission: parseFloat(commission.toFixed(2)),
      fee: parseFloat(fee.toFixed(2)),
      netCredit: parseFloat(Math.max(0, netCredit).toFixed(2)),
    };
  }

  calculateTieredCommission(
    codAmount: number,
    tiers: Array<{ min: number; max: number; rate: number }>,
  ): number {
    let commission = 0;
    for (const tier of tiers) {
      if (codAmount > tier.min) {
        const amountInTier = Math.min(codAmount, tier.max) - tier.min;
        commission += amountInTier * tier.rate;
      }
    }
    return parseFloat(commission.toFixed(2));
  }
}
