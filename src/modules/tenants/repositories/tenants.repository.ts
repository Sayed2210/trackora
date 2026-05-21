import { Injectable } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  AbstractRepository,
  PrismaDelegate,
} from '@common/database/abstract.repository';
import { Tenant } from '../entities/tenant.entity';

export interface TenantFilter {
  status?: TenantStatus;
  OR?: Array<Record<string, unknown>>;
}

@Injectable()
export class TenantsRepository extends AbstractRepository<Tenant> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate(): PrismaDelegate<Tenant> {
    return this.prisma.tenant;
  }

  async softDelete(id: string): Promise<void> {
    await this.delegate.update({
      where: { id },
      data: { status: TenantStatus.CANCELLED },
    });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.delegate.findFirst({ where: { slug } });
  }

  async findMany(
    where: TenantFilter,
    skip?: number,
    take?: number,
  ): Promise<Tenant[]> {
    return this.delegate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async count(where: TenantFilter): Promise<number> {
    return this.delegate.count({ where });
  }
}
