import { Injectable } from '@nestjs/common';
import { PayoutMethod, PayoutStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';

export interface PayoutFilters {
  merchantId?: string;
  status?: PayoutStatus;
  method?: PayoutMethod;
  from?: Date;
  to?: Date;
}

@Injectable()
export class PayoutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyForTenant(
    tenantId: string,
    filters: PayoutFilters,
    skip: number,
    take: number,
  ) {
    return this.prisma.payout.findMany({
      where: { ...this.buildWhere(filters), tenantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countForTenant(tenantId: string, filters: PayoutFilters) {
    return this.prisma.payout.count({
      where: { ...this.buildWhere(filters), tenantId },
    });
  }

  findByIdForTenant(id: string, tenantId: string) {
    return this.prisma.payout.findFirst({ where: { id, tenantId } });
  }

  private buildWhere(filters: PayoutFilters): Prisma.PayoutWhereInput {
    const where: Prisma.PayoutWhereInput = {};
    if (filters.merchantId) where.merchantId = filters.merchantId;
    if (filters.status) where.status = filters.status;
    if (filters.method) where.method = filters.method;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }
    return where;
  }
}
