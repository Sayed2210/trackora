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

  async generateBatch(count: number): Promise<string[]> {
    const candidates = new Set<string>();
    const result: string[] = [];
    let safety = 0;
    const maxSafety = count * 20;

    while (result.length < count && safety < maxSafety) {
      const candidate = this.generate();
      if (!candidates.has(candidate)) {
        candidates.add(candidate);
      }
      safety++;
    }

    const existing = await this.shipmentsRepository.findExistingTrackingNumbers(
      Array.from(candidates),
    );
    const existingSet = new Set(existing);

    for (const candidate of candidates) {
      if (!existingSet.has(candidate)) {
        result.push(candidate);
      }
      if (result.length >= count) break;
    }

    // Fill any remaining gaps one-by-one
    while (result.length < count) {
      const unique = await this.generateUnique();
      if (!existingSet.has(unique)) {
        result.push(unique);
      }
    }

    return result;
  }
}
