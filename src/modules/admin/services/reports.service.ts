import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { ShipmentStatus, ShipmentType } from '@prisma/client';

export interface DailyReport {
  date: string;
  totalShipments: number;
  byStatus: Record<string, number>;
  byZone: Array<{ zone: string; count: number }>;
  byCourier: Array<{ courier: string; delivered: number; failed: number }>;
}

export interface CourierPerformanceReport {
  courierId: string;
  courierName: string;
  totalAssigned: number;
  delivered: number;
  failed: number;
  returned: number;
  successRate: number;
  averageDeliveryTimeMinutes: number | null;
}

export interface MerchantDeliveryReport {
  merchantId: string;
  merchantName: string;
  totalShipments: number;
  delivered: number;
  returned: number;
  successRate: number;
  returnReasons: Array<{ reason: string; count: number }>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateDailyReport(dateStr: string): Promise<DailyReport> {
    const date = new Date(dateStr);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const shipments = await this.prisma.shipment.findMany({
      where: {
        createdAt: { gte: date, lt: nextDay },
      },
      select: {
        status: true,
        zoneId: true,
        assignedCourierId: true,
        deliveredAt: true,
        returnedAt: true,
      },
    });

    const byStatus: Record<string, number> = {};
    const zoneMap = new Map<string, number>();
    const courierMap = new Map<string, { delivered: number; failed: number }>();

    for (const s of shipments) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;

      if (s.zoneId) {
        zoneMap.set(s.zoneId, (zoneMap.get(s.zoneId) || 0) + 1);
      }

      if (s.assignedCourierId) {
        const c = courierMap.get(s.assignedCourierId) || {
          delivered: 0,
          failed: 0,
        };
        if (s.status === ShipmentStatus.DELIVERED) c.delivered++;
        if (s.status === ShipmentStatus.FAILED) c.failed++;
        courierMap.set(s.assignedCourierId, c);
      }
    }

    const zoneIds = Array.from(zoneMap.keys());
    const zones =
      zoneIds.length > 0
        ? await this.prisma.zone.findMany({
            where: { id: { in: zoneIds } },
            select: { id: true, nameAr: true },
          })
        : [];

    const byZone = zones.map((z) => ({
      zone: z.nameAr,
      count: zoneMap.get(z.id) || 0,
    }));

    const courierIds = Array.from(courierMap.keys());
    const couriers =
      courierIds.length > 0
        ? await this.prisma.courier.findMany({
            where: { id: { in: courierIds } },
            include: { user: { select: { name: true } } },
          })
        : [];

    const byCourier = couriers.map((c) => ({
      courier: c.user?.name || c.id,
      delivered: courierMap.get(c.id)?.delivered || 0,
      failed: courierMap.get(c.id)?.failed || 0,
    }));

    return {
      date: dateStr,
      totalShipments: shipments.length,
      byStatus,
      byZone,
      byCourier,
    };
  }

  async generateCourierPerformanceReport(
    from?: Date,
    to?: Date,
  ): Promise<CourierPerformanceReport[]> {
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.deliveredAt = {};
      if (from) (where.deliveredAt as Record<string, Date>).gte = from;
      if (to) (where.deliveredAt as Record<string, Date>).lte = to;
    }

    const couriers = await this.prisma.courier.findMany({
      include: {
        user: { select: { name: true } },
        assignments: {
          where: { status: 'COMPLETED' },
          select: { shipmentId: true },
        },
      },
    });

    return couriers.map((c) => {
      const total = c.totalDelivered + c.totalFailed + c.totalReturned;
      const rate = total > 0 ? (c.totalDelivered / total) * 100 : 0;

      return {
        courierId: c.id,
        courierName: c.user?.name || 'Unknown',
        totalAssigned: c.assignments.length,
        delivered: c.totalDelivered,
        failed: c.totalFailed,
        returned: c.totalReturned,
        successRate: parseFloat(rate.toFixed(1)),
        averageDeliveryTimeMinutes: c.avgDeliveryTimeMinutes,
      };
    });
  }

  async generateMerchantDeliveryReport(
    from?: Date,
    to?: Date,
  ): Promise<MerchantDeliveryReport[]> {
    const dateWhere: Record<string, unknown> = {};
    if (from || to) {
      dateWhere.createdAt = {};
      if (from) (dateWhere.createdAt as Record<string, Date>).gte = from;
      if (to) (dateWhere.createdAt as Record<string, Date>).lte = to;
    }

    const merchants = await this.prisma.merchant.findMany({
      include: {
        user: { select: { name: true } },
        shipments: {
          where: {
            status: { in: [ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED] },
            ...dateWhere,
          },
          select: {
            status: true,
            returnReason: true,
          },
        },
      },
    });

    return merchants.map((m) => {
      const delivered = m.shipments.filter(
        (s) => s.status === ShipmentStatus.DELIVERED,
      ).length;
      const returned = m.shipments.filter(
        (s) => s.status === ShipmentStatus.RETURNED,
      ).length;
      const total = delivered + returned;
      const rate = total > 0 ? (delivered / total) * 100 : 0;

      const reasonMap = new Map<string, number>();
      for (const s of m.shipments) {
        if (s.returnReason) {
          reasonMap.set(
            s.returnReason,
            (reasonMap.get(s.returnReason) || 0) + 1,
          );
        }
      }
      const returnReasons = Array.from(reasonMap.entries()).map(
        ([reason, count]) => ({ reason, count }),
      );

      return {
        merchantId: m.id,
        merchantName: m.businessName || m.user?.name || 'Unknown',
        totalShipments: m.shipments.length,
        delivered,
        returned,
        successRate: parseFloat(rate.toFixed(1)),
        returnReasons,
      };
    });
  }
}
