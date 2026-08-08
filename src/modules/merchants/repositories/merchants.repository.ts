import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { Merchant, KycStatus } from '../entities/merchant.entity';

export interface MerchantFilter {
  kycStatus?: KycStatus;
  isActive?: boolean;
  OR?: Array<Record<string, unknown>>;
}

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

  softDelete(): Promise<void> {
    throw new Error('Use softDeleteForTenant for tenant-owned merchants');
  }

  async softDeleteForTenant(id: string, tenantId: string): Promise<void> {
    await this.delegate.update({
      where: { id, tenantId },
      data: { isActive: false },
    });
  }

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Merchant | null> {
    return this.delegate.findFirst({ where: { id, tenantId } });
  }

  async findByUserIdForTenant(
    userId: string,
    tenantId: string,
  ): Promise<Merchant | null> {
    return this.delegate.findFirst({
      where: { ...this.baseWhere, userId, tenantId },
    });
  }

  async findByKycStatus(status: KycStatus): Promise<Merchant[]> {
    return this.delegate.findMany({
      where: { ...this.baseWhere, kycStatus: status },
    });
  }

  async findActiveMerchants(): Promise<Merchant[]> {
    return this.delegate.findMany({ where: this.baseWhere });
  }

  async findManyForTenant(
    tenantId: string,
    where: MerchantFilter,
    orderBy: { createdAt: 'asc' | 'desc' } = { createdAt: 'desc' },
    skip?: number,
    take?: number,
  ): Promise<Merchant[]> {
    return this.delegate.findMany({
      where: { ...where, tenantId },
      orderBy,
      skip,
      take,
    });
  }

  async countForTenant(
    tenantId: string,
    where: MerchantFilter,
  ): Promise<number> {
    return this.delegate.count({ where: { ...where, tenantId } });
  }

  async updateForTenant(
    id: string,
    tenantId: string,
    data: Record<string, unknown>,
  ): Promise<Merchant> {
    return this.delegate.update({ where: { id, tenantId }, data });
  }
}
