import { Injectable, MethodNotAllowedException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  AbstractRepository,
  PrismaDelegate,
} from '@common/database/abstract.repository';
import { Shipment } from '../entities/shipment.entity';

export interface ShipmentFilter {
  status?: string | string[];
  merchantId?: string;
  assignedCourierId?: string;
  zoneId?: string;
  trackingNumber?: string;
  createdAt?: { gte?: Date; lte?: Date };
  OR?: Array<Record<string, unknown>>;
}

export interface ShipmentOrderBy {
  createdAt?: 'asc' | 'desc';
}

@Injectable()
export class ShipmentsRepository extends AbstractRepository<Shipment> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate(): PrismaDelegate<Shipment> {
    return this.prisma.shipment;
  }

  async softDelete(): Promise<void> {
    await Promise.resolve();
    throw new MethodNotAllowedException(
      'Shipments do not support soft delete. Use status transitions instead.',
    );
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    return this.delegate.findUnique({ where: { trackingNumber } });
  }

  async findWithFilters(
    where: ShipmentFilter,
    skip: number,
    take: number,
    orderBy: ShipmentOrderBy = { createdAt: 'desc' },
  ): Promise<Shipment[]> {
    return this.delegate.findMany({
      where,
      skip,
      take,
      orderBy,
    });
  }

  async countWithFilters(where: ShipmentFilter): Promise<number> {
    return this.delegate.count({ where });
  }

  async findWithCursor(
    where: ShipmentFilter,
    cursorId: string | undefined,
    limit: number,
    orderBy: ShipmentOrderBy = { createdAt: 'desc' },
  ): Promise<Shipment[]> {
    return this.delegate.findMany({
      where,
      take: limit,
      skip: cursorId ? 1 : 0,
      cursor: cursorId ? { id: cursorId } : undefined,
      orderBy,
    });
  }
}
