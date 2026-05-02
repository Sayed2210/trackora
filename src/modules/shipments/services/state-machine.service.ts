import { Injectable, ConflictException } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';

const TRANSITION_MATRIX: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.PENDING]: [
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.PICKED_UP]: [
    ShipmentStatus.IN_WAREHOUSE,
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.FAILED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.IN_WAREHOUSE]: [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.FAILED,
  ],
  [ShipmentStatus.OUT_FOR_DELIVERY]: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.FAILED,
    ShipmentStatus.POSTPONED,
    ShipmentStatus.RETURNED,
  ],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.FAILED]: [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.RETURNED,
  ],
  [ShipmentStatus.POSTPONED]: [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.FAILED,
  ],
  [ShipmentStatus.RETURNED]: [],
  [ShipmentStatus.CANCELLED]: [],
};

const TERMINAL_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.RETURNED,
  ShipmentStatus.CANCELLED,
];

@Injectable()
export class StateMachineService {
  getAllowedTransitions(currentStatus: ShipmentStatus): ShipmentStatus[] {
    return TRANSITION_MATRIX[currentStatus] || [];
  }

  validateTransition(
    currentStatus: ShipmentStatus,
    newStatus: ShipmentStatus,
    allowOverride = false,
  ): void {
    if (currentStatus === newStatus) {
      return;
    }

    const allowed = this.getAllowedTransitions(currentStatus);

    if (!allowed.includes(newStatus) && !allowOverride) {
      throw new ConflictException(
        `Invalid transition from ${currentStatus} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }
  }

  isTerminalStatus(status: ShipmentStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
  }
}
