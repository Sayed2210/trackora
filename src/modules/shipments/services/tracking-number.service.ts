import { Injectable } from '@nestjs/common';
import { ShipmentsRepository } from '../repositories/shipments.repository';

@Injectable()
export class TrackingNumberService {
  constructor(private readonly shipmentsRepository: ShipmentsRepository) {}

  generate(): string {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TRK-${yy}${mm}${dd}-${random}`;
  }

  validateFormat(trackingNumber: string): boolean {
    return /^TRK-\d{6}-\d{4}$/.test(trackingNumber);
  }

  async generateUnique(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const candidate = this.generate();
      const existing =
        await this.shipmentsRepository.findByTrackingNumber(candidate);
      if (!existing) {
        return candidate;
      }
      attempts++;
    }

    throw new Error(
      'Unable to generate unique tracking number after max attempts',
    );
  }
}
