import { ShipmentStatus, ShipmentType } from '@prisma/client';

export interface WsShipmentStatusChangedEvent {
  tenantId: string;
  shipmentId: string;
  trackingNumber: string;
  merchantId: string;
  courierId?: string;
  previousStatus: ShipmentStatus;
  newStatus: ShipmentStatus;
  codAmount: number;
  type: ShipmentType;
  updatedAt: string;
}

export interface WsShipmentCreatedEvent {
  tenantId: string;
  shipmentId: string;
  trackingNumber: string;
  merchantId: string;
  status: ShipmentStatus;
  codAmount: number;
  type: ShipmentType;
}

export interface WsAssignmentCreatedEvent {
  tenantId: string;
  assignmentId: string;
  shipmentId: string;
  courierId: string;
  trackingNumber: string;
  customerName: string;
  addressText: string;
  codAmount: string;
  assignmentType: string;
}

export interface WsAssignmentCancelledEvent {
  tenantId: string;
  assignmentId: string;
  courierId: string;
  trackingNumber: string;
  reason: string;
}

export interface WsWalletBalanceUpdatedEvent {
  tenantId: string;
  walletId: string;
  merchantId: string;
  balance: number;
  transactionType: string;
  amount: number;
  runningBalance: number;
}

export interface WsAdminStatsEvent {
  tenantId: string;
  activeShipments: number;
  deliveredToday: number;
  failedToday: number;
  couriersAvailable: number;
  codCollectedToday: number;
}

export interface WsMissedSyncPayload {
  lastEventId: string;
}
