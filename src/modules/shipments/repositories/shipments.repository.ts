import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { Shipment } from '../entities/shipment.entity';

@Injectable()
export class ShipmentsRepository extends AbstractRepository<Shipment> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.shipment;
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Shipment | null> {
    return this.delegate.findUnique({ where: { trackingNumber } });
  }

  async findWithFilters(
    where: Prisma.ShipmentWhereInput,
    skip: number,
    take: number,
    orderBy: Prisma.ShipmentOrderByWithRelationInput = { createdAt: 'desc' },
  ): Promise<Shipment[]> {
    return this.delegate.findMany({ where, skip, take, orderBy });
  }

  async countWithFilters(where: Prisma.ShipmentWhereInput): Promise<number> {
    return this.delegate.count({ where });
  }
}
