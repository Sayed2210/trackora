import { Injectable, MethodNotAllowedException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  AbstractRepository,
  PrismaDelegate,
} from '@common/database/abstract.repository';
import { Shipment } from '../entities/shipment.entity';

export interface ShipmentFilter {
  tenantId: string;
  status?: string | { in: string[] };
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

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Shipment | null> {
    return this.delegate.findFirst({ where: { id, tenantId } });
  }

  async findByTrackingNumberForTenant(
    trackingNumber: string,
    tenantId: string,
  ): Promise<Shipment | null> {
    return this.delegate.findFirst({ where: { trackingNumber, tenantId } });
  }

  /** Internal global uniqueness check; never returns shipment data to an API. */
  async findByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    return this.delegate.findUnique({ where: { trackingNumber } });
  }

  async findPublicTracking(trackingNumber: string) {
    return this.prisma.shipment.findUnique({
      where: { trackingNumber },
      select: {
        trackingNumber: true,
        status: true,
        updatedAt: true,
        deliveredAt: true,
      },
    });
  }

  async findExistingTrackingNumbers(
    trackingNumbers: string[],
  ): Promise<string[]> {
    const shipments = await this.prisma.shipment.findMany({
      where: { trackingNumber: { in: trackingNumbers } },
      select: { trackingNumber: true },
    });
    return shipments.map((s) => s.trackingNumber);
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
    if (cursorId) {
      const cursor = await this.delegate.findFirst({
        where: { id: cursorId, tenantId: where.tenantId },
      });
      if (!cursor) return [];
    }
    return this.delegate.findMany({
      where,
      take: limit,
      skip: cursorId ? 1 : 0,
      cursor: cursorId ? { id: cursorId } : undefined,
      orderBy,
    });
  }
}
