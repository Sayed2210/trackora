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

  async create(merchantId: string, tenantId: string): Promise<Wallet> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, tenantId },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const existing = await this.walletsRepository.findByMerchantIdForTenant(
      merchantId,
      tenantId,
    );
    if (existing) {
      return existing;
    }

    return this.walletsRepository.create({
      merchantId,
      tenantId,
      balance: 0,
      pendingBalance: 0,
      totalCredited: 0,
      totalDebited: 0,
      currency: 'EGP',
      version: 0,
    });
  }

  async findByMerchantId(
    merchantId: string,
    tenantId: string,
  ): Promise<Wallet | null> {
    return this.walletsRepository.findByMerchantIdForTenant(
      merchantId,
      tenantId,
    );
  }

  async findById(id: string, tenantId: string): Promise<Wallet | null> {
    return this.walletsRepository.findByIdForTenant(id, tenantId);
  }

  async getBalance(
    merchantId: string,
    tenantId: string,
  ): Promise<{
    id: string;
    merchantId: string;
    balance: number;
    availableBalance: number;
    pendingBalance: number;
    totalCredited: number;
    totalDebited: number;
    currency: string;
    updatedAt: Date;
  }> {
    const wallet = await this.walletsRepository.findByMerchantIdForTenant(
      merchantId,
      tenantId,
    );
    if (!wallet) {
      throw new NotFoundException('Wallet not found for merchant');
    }

    const balance = Number(wallet.balance);
    return {
      id: wallet.id,
      merchantId: wallet.merchantId,
      balance,
      availableBalance: balance,
      pendingBalance: Number(wallet.pendingBalance),
      totalCredited: Number(wallet.totalCredited),
      totalDebited: Number(wallet.totalDebited),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    };
  }

  async getTransactions(
    merchantId: string,
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      type?: import('@prisma/client').TransactionType;
      from?: Date;
      to?: Date;
    } = {},
  ): Promise<{
    data: Transaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const wallet = await this.walletsRepository.findByMerchantIdForTenant(
      merchantId,
      tenantId,
    );
    if (!wallet) {
      throw new NotFoundException('Wallet not found for merchant');
    }

    return this.transactionsService.getTransactions(
      wallet.id,
      tenantId,
      options,
    );
  }

  async getOrCreateWallet(
    merchantId: string,
    tenantId: string,
  ): Promise<Wallet> {
    const wallet = await this.findByMerchantId(merchantId, tenantId);
    if (wallet) return wallet;
    return this.create(merchantId, tenantId);
  }
}
