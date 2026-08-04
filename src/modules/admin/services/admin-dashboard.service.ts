import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { ShipmentStatus, ShipmentType } from '@prisma/client';

export interface AdminDashboardData {
  today: {
    shipmentsCreated: number;
    shipmentsDelivered: number;
    shipmentsFailed: number;
    totalCodCollected: number;
  };
  pendingAssignments: number;
  couriersOnline: number;
  couriersOffline: number;
}

export interface FinancialSummaryData {
  dailyCodCollected: number;
  pendingSettlements: number;
  totalCourierCashHeld: number;
  expectedVsActualCash: {
    expected: number;
    actual: number;
    variance: number;
  };
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string): Promise<AdminDashboardData> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      shipmentsCreated,
      shipmentsDelivered,
      shipmentsFailed,
      codCollected,
      pendingAssignments,
      couriersOnline,
      couriersOffline,
    ] = await Promise.all([
      this.prisma.shipment.count({
        where: { tenantId, createdAt: { gte: startOfDay } },
      }),
      this.prisma.shipment.count({
        where: {
          status: ShipmentStatus.DELIVERED,
          tenantId,
          deliveredAt: { gte: startOfDay },
        },
      }),
      this.prisma.shipment.count({
        where: {
          status: ShipmentStatus.FAILED,
          tenantId,
          updatedAt: { gte: startOfDay },
        },
      }),
      this.prisma.shipment.aggregate({
        where: {
          type: ShipmentType.COD,
          tenantId,
          status: ShipmentStatus.DELIVERED,
          deliveredAt: { gte: startOfDay },
        },
        _sum: { collectedCash: true },
      }),
      this.prisma.shipment.count({
        where: {
          status: ShipmentStatus.PENDING,
          tenantId,
          assignedCourierId: null,
        },
      }),
      this.prisma.courier.count({
        where: { tenantId, isActive: true, isAvailable: true },
      }),
      this.prisma.courier.count({
        where: { tenantId, isActive: true, isAvailable: false },
      }),
    ]);

    return {
      today: {
        shipmentsCreated,
        shipmentsDelivered,
        shipmentsFailed,
        totalCodCollected: Number(codCollected._sum.collectedCash ?? 0),
      },
      pendingAssignments,
      couriersOnline,
      couriersOffline,
    };
  }

  async getFinancialSummary(tenantId: string): Promise<FinancialSummaryData> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [dailyCod, pendingSettlements, totalCashHeld, expectedCash] =
      await Promise.all([
        this.prisma.shipment.aggregate({
          where: {
            type: ShipmentType.COD,
            tenantId,
            status: ShipmentStatus.DELIVERED,
            deliveredAt: { gte: startOfDay },
          },
          _sum: { collectedCash: true },
        }),
        this.prisma.payout.count({
          where: {
            tenantId,
            status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
          },
        }),
        this.prisma.courier.aggregate({
          where: { tenantId },
          _sum: { cashHeld: true },
        }),
        this.prisma.shipment.aggregate({
          where: {
            type: ShipmentType.COD,
            tenantId,
            status: {
              in: [
                ShipmentStatus.DELIVERED,
                ShipmentStatus.PICKED_UP,
                ShipmentStatus.OUT_FOR_DELIVERY,
              ],
            },
          },
          _sum: { codAmount: true },
        }),
      ]);

    const actual = Number(totalCashHeld._sum.cashHeld ?? 0);
    const expected = Number(expectedCash._sum.codAmount ?? 0);

    return {
      dailyCodCollected: Number(dailyCod._sum.collectedCash ?? 0),
      pendingSettlements,
      totalCourierCashHeld: actual,
      expectedVsActualCash: {
        expected,
        actual,
        variance: parseFloat((expected - actual).toFixed(2)),
      },
    };
  }
}
