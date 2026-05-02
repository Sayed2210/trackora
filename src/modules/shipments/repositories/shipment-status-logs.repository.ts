import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { ShipmentStatusLog } from '@prisma/client';

@Injectable()
export class ShipmentStatusLogsRepository extends AbstractRepository<ShipmentStatusLog> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.shipmentStatusLog;
  }

  async findByShipmentId(shipmentId: string): Promise<ShipmentStatusLog[]> {
    return this.delegate.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
