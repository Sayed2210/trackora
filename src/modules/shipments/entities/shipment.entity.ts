import {
  Shipment as PrismaShipment,
  ShipmentStatus,
  ShipmentType,
  ReturnReason,
} from '@prisma/client';

export type Shipment = PrismaShipment;
export { ShipmentStatus, ShipmentType, ReturnReason };
