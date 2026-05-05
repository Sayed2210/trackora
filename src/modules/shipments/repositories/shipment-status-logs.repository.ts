import { Injectable, MethodNotAllowedException } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { ShipmentStatusLog } from '../entities/shipment-status-log.entity';

@Injectable()
export class ShipmentStatusLogsRepository extends AbstractRepository<ShipmentStatusLog> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.shipmentStatusLog;
  }

  async softDelete(): Promise<void> {
    await Promise.resolve();
    throw new MethodNotAllowedException(
      'Shipment status logs cannot be deleted.',
    );
  }

  async findByShipmentId(shipmentId: string): Promise<ShipmentStatusLog[]> {
    return this.delegate.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
