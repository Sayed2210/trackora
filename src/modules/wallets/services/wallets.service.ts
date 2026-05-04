import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { WalletsRepository } from '../repositories/wallets.repository';
import { TransactionsService } from './transactions.service';
import { Wallet, Transaction } from '@prisma/client';

@Injectable()
export class WalletsService {
  constructor(
    private readonly walletsRepository: WalletsRepository,
    private readonly transactionsService: TransactionsService,
    private readonly prisma: PrismaService,
  ) {}

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

  async findById(id: string): Promise<Wallet | null> {
    return this.walletsRepository.findById(id);
  }

  async getBalance(merchantId: string): Promise<{
    balance: number;
    pendingBalance: number;
    totalCredited: number;
    totalDebited: number;
    currency: string;
  }> {
    const wallet = await this.walletsRepository.findByMerchantId(merchantId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found for merchant');
    }

    return {
      balance: Number(wallet.balance),
      pendingBalance: Number(wallet.pendingBalance),
      totalCredited: Number(wallet.totalCredited),
      totalDebited: Number(wallet.totalDebited),
      currency: wallet.currency,
    };
  }

  async getTransactions(
    merchantId: string,
    options: {
      page?: number;
      limit?: number;
      type?: import('@prisma/client').TransactionType;
      from?: Date;
      to?: Date;
    } = {},
  ): Promise<{ data: Transaction[]; total: number; page: number; limit: number }> {
    const wallet = await this.walletsRepository.findByMerchantId(merchantId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found for merchant');
    }

    return this.transactionsService.getTransactions(wallet.id, options);
  }

  async getOrCreateWallet(merchantId: string): Promise<Wallet> {
    const wallet = await this.findByMerchantId(merchantId);
    if (wallet) return wallet;
    return this.create(merchantId);
  }
}
