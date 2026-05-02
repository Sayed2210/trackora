import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { Merchant, KycStatus } from '../entities/merchant.entity';

@Injectable()
export class MerchantsRepository extends AbstractRepository<Merchant> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.merchant;
  }

  protected get baseWhere() {
    return { isActive: true };
  }

  async softDelete(id: string): Promise<void> {
    await this.delegate.update({ where: { id }, data: { isActive: false } });
  }

  async findByUserId(userId: string): Promise<Merchant | null> {
    return this.delegate.findFirst({ where: { ...this.baseWhere, userId } });
  }

  async findByKycStatus(status: KycStatus): Promise<Merchant[]> {
    return this.delegate.findMany({
      where: { ...this.baseWhere, kycStatus: status },
    });
  }

  async findActiveMerchants(): Promise<Merchant[]> {
    return this.delegate.findMany({ where: this.baseWhere });
  }
}
