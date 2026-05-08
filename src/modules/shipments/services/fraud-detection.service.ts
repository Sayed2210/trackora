import { Injectable } from '@nestjs/common';

interface ShipmentLike {
  customerPhone?: string | null;
  addressText?: string | null;
  codAmount?: number | string | null;
  customerName?: string | null;
}

interface RiskSignals {
  phoneFormatValid: boolean;
  addressHasLandmark: boolean;
  codAmountHigh: boolean;
  customerNameShort: boolean;
}

@Injectable()
export class FraudDetectionService {
  calculateRiskScore(shipment: ShipmentLike): number {
    const signals = this.evaluateSignals(shipment);
    let score = 0;

    if (!signals.phoneFormatValid) score += 30;
    if (!signals.addressHasLandmark) score += 20;
    if (signals.codAmountHigh) score += 25;
    if (signals.customerNameShort) score += 15;

    return Math.min(score, 100);
  }

  private evaluateSignals(shipment: ShipmentLike): RiskSignals {
    const phone = shipment.customerPhone || '';
    const addressText = (shipment.addressText || '').toLowerCase();
    const codAmount = Number(shipment.codAmount || 0);
    const customerName = shipment.customerName || '';

    return {
      phoneFormatValid: this.isValidEgyptianPhone(phone),
      addressHasLandmark: this.hasLandmark(addressText),
      codAmountHigh: codAmount > 5000,
      customerNameShort: customerName.length < 3,
    };
  }

  private isValidEgyptianPhone(phone: string): boolean {
    return /^01[0-25]\d{8}$/.test(phone);
  }

  private hasLandmark(address: string): boolean {
    const landmarkKeywords = [
      'near',
      'beside',
      'next to',
      'in front of',
      'behind',
      'عمارة',
      'شقة',
      'دور',
      'بجوار',
      'أمام',
      'خلف',
      'بجانب',
    ];
    return landmarkKeywords.some((kw) => address.includes(kw));
  }

  isHighRisk(score: number): boolean {
    return score > 50;
  }
}
