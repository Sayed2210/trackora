import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { Wallet } from '../entities/wallet.entity';

@Injectable()
export class WalletsRepository extends AbstractRepository<Wallet> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.wallet;
  }

  softDelete(): Promise<void> {
    // Wallets should not be soft deleted
    throw new Error('Wallet soft delete not allowed');
  }

  async findByMerchantId(merchantId: string): Promise<Wallet | null> {
    return this.delegate.findUnique({ where: { merchantId } });
  }
}
