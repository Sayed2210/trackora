import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  AbstractRepository,
  PrismaDelegate,
} from '@common/database/abstract.repository';
import { Zone } from '../entities/zone.entity';

export interface ZoneFilter {
  level?: string;
  parentId?: string | null;
  isActive?: boolean;
  OR?: Array<Record<string, unknown>>;
}

@Injectable()
export class ZonesRepository extends AbstractRepository<Zone> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate(): PrismaDelegate<Zone> {
    return this.prisma.zone;
  }

  protected get baseWhere() {
    return { isActive: true };
  }

  async softDelete(id: string): Promise<void> {
    await this.delegate.update({ where: { id }, data: { isActive: false } });
  }

  async findByCode(code: string): Promise<Zone | null> {
    return this.delegate.findFirst({ where: { ...this.baseWhere, code } });
  }

  async findChildren(parentId: string): Promise<Zone[]> {
    return this.delegate.findMany({
      where: { ...this.baseWhere, parentId },
      orderBy: { nameAr: 'asc' },
    });
  }

  async findMany(
    where: ZoneFilter,
    orderBy: { nameAr: 'asc' | 'desc' } = { nameAr: 'asc' },
    skip?: number,
    take?: number,
  ): Promise<Zone[]> {
    return this.delegate.findMany({ where, orderBy, skip, take });
  }

  async count(where: ZoneFilter): Promise<number> {
    return this.delegate.count({ where });
  }
}
