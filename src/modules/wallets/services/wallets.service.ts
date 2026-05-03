import { Injectable } from '@nestjs/common';
import { WalletsRepository } from '../repositories/wallets.repository';
import { Wallet } from '../entities/wallet.entity';

@Injectable()
export class WalletsService {
  constructor(private readonly walletsRepository: WalletsRepository) {}

  async create(merchantId: string): Promise<Wallet> {
    const existing = await this.walletsRepository.findByMerchantId(merchantId);
    if (existing) {
      return existing;
    }

    return this.walletsRepository.create({
      merchantId,
      balance: 0,
      pendingBalance: 0,
      totalCredited: 0,
      totalDebited: 0,
      currency: 'EGP',
      version: 0,
    });
  }

  async findByMerchantId(merchantId: string): Promise<Wallet | null> {
    return this.walletsRepository.findByMerchantId(merchantId);
  }
}
