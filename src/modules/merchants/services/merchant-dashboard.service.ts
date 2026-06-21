import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { ShipmentStatus, ShipmentType } from '@prisma/client';

export interface MerchantDashboardData {
  counts: {
    total: number;
    pending: number;
    inTransit: number;
    delivered: number;
    returned: number;
  };
  deliverySuccessRate: number;
  averageCodAmount: number;
  recentActivity: Array<{
    id: string;
    trackingNumber: string;
    status: ShipmentStatus;
    customerName: string;
    codAmount: number | null;
    createdAt: Date;
  }>;
}

export interface MerchantAnalyticsData {
  successRate: {
    current: number;
    previous: number;
    trend: 'up' | 'down' | 'flat';
  };
  returnReasons: Array<{ reason: string; count: number; percentage: number }>;
  zonePerformance: Array<{
    zone: string;
    delivered: number;
    failed: number;
    rate: number;
  }>;
  codTrend: Array<{ date: string; collected: number }>;
}

@Injectable()
export class MerchantDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(merchantId: string): Promise<MerchantDashboardData> {
    const [total, pending, inTransit, delivered, returned, avgCod, recent] =
      await Promise.all([
        this.prisma.shipment.count({ where: { merchantId } }),
        this.prisma.shipment.count({
          where: { merchantId, status: ShipmentStatus.PENDING },
        }),
        this.prisma.shipment.count({
          where: {
            merchantId,
            status: {
              in: [
                ShipmentStatus.PICKED_UP,
                ShipmentStatus.IN_WAREHOUSE,
                ShipmentStatus.OUT_FOR_DELIVERY,
              ],
            },
          },
        }),
        this.prisma.shipment.count({
          where: { merchantId, status: ShipmentStatus.DELIVERED },
        }),
        this.prisma.shipment.count({
          where: { merchantId, status: ShipmentStatus.RETURNED },
        }),
        this.prisma.shipment.aggregate({
          where: { merchantId, type: ShipmentType.COD },
          _avg: { codAmount: true },
        }),
        this.prisma.shipment.findMany({
          where: { merchantId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            trackingNumber: true,
            status: true,
            customerName: true,
            codAmount: true,
            createdAt: true,
          },
        }),
      ]);

    const completed = delivered + returned;
    const successRate = completed > 0 ? (delivered / completed) * 100 : 0;

    return {
      counts: {
        total,
        pending,
        inTransit,
        delivered,
        returned,
      },
      deliverySuccessRate: parseFloat(successRate.toFixed(1)),
      averageCodAmount: parseFloat(
        Number(avgCod._avg.codAmount ?? 0).toFixed(2),
      ),
      recentActivity: recent.map((s) => ({
        id: s.id,
        trackingNumber: s.trackingNumber,
        status: s.status,
        customerName: s.customerName,
        codAmount: s.codAmount ? Number(s.codAmount) : null,
        createdAt: s.createdAt,
      })),
    };
  }

  async getAnalytics(
    merchantId: string,
    days = 30,
  ): Promise<MerchantAnalyticsData> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Success rate trend: group by day
    const shipments = await this.prisma.shipment.findMany({
      where: {
        merchantId,
        status: { in: [ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED] },
        deliveredAt: { gte: fromDate },
      },
      select: {
        status: true,
        deliveredAt: true,
      },
    });

    const dailyMap = new Map<string, { delivered: number; returned: number }>();
    for (const s of shipments) {
      const date = (s.deliveredAt ?? new Date()).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { delivered: 0, returned: 0 };
      if (s.status === ShipmentStatus.DELIVERED) existing.delivered++;
      else existing.returned++;
      dailyMap.set(date, existing);
    }

    const successRateTrend = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        rate:
          stats.delivered + stats.returned > 0
            ? parseFloat(
                (
                  (stats.delivered / (stats.delivered + stats.returned)) *
                  100
                ).toFixed(1),
              )
            : 0,
      }));

    // Return reasons
    const returnedShipments = await this.prisma.shipment.groupBy({
      by: ['returnReason'],
      where: {
        merchantId,
        status: ShipmentStatus.RETURNED,
        returnedAt: { gte: fromDate },
      },
      _count: { id: true },
    });

    const returnedTotal = returnedShipments.reduce(
      (sum, r) => sum + r._count.id,
      0,
    );
    const returnReasons = returnedShipments.map((r) => ({
      reason: r.returnReason || 'UNKNOWN',
      count: r._count.id,
      percentage:
        returnedTotal > 0
          ? parseFloat(((r._count.id / returnedTotal) * 100).toFixed(1))
          : 0,
    }));

    // Zone performance
    const zoneStats = await this.prisma.shipment.groupBy({
      by: ['zoneId'],
      where: {
        merchantId,
        status: { in: [ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED] },
      },
      _count: { id: true },
    });

    const zoneIds = zoneStats.map((z) => z.zoneId).filter(Boolean) as string[];
    const zones =
      zoneIds.length > 0
        ? await this.prisma.zone.findMany({
            where: { id: { in: zoneIds } },
            select: { id: true, nameAr: true },
          })
        : [];

    const zoneMap = new Map(zones.map((z) => [z.id, z.nameAr]));
    const zonePerformance = await Promise.all(
      zoneStats.map(async (z) => {
        const zoneId = z.zoneId || undefined;
        const [deliveredCount, failedCount] = await Promise.all([
          this.prisma.shipment.count({
            where: { merchantId, zoneId, status: ShipmentStatus.DELIVERED },
          }),
          this.prisma.shipment.count({
            where: { merchantId, zoneId, status: ShipmentStatus.RETURNED },
          }),
        ]);
        const completed = deliveredCount + failedCount;
        return {
          zone: zoneMap.get(z.zoneId || '') || 'Unknown',
          delivered: deliveredCount,
          failed: failedCount,
          rate:
            completed > 0
              ? parseFloat(((deliveredCount / completed) * 100).toFixed(1))
              : 0,
        };
      }),
    );

    // COD collection trend
    const codShipments = await this.prisma.shipment.findMany({
      where: {
        merchantId,
        type: ShipmentType.COD,
        status: ShipmentStatus.DELIVERED,
        deliveredAt: { gte: fromDate },
      },
      select: {
        codAmount: true,
        deliveredAt: true,
      },
    });

    const codDailyMap = new Map<string, number>();
    for (const s of codShipments) {
      const date = (s.deliveredAt ?? new Date()).toISOString().split('T')[0];
      codDailyMap.set(date, (codDailyMap.get(date) || 0) + Number(s.codAmount));
    }

    const codTrend = Array.from(codDailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, collected]) => ({
        date,
        collected: parseFloat(collected.toFixed(2)),
      }));

    const current = successRateTrend.at(-1)?.rate ?? 0;
    const previous = successRateTrend.at(-2)?.rate ?? current;
    return {
      successRate: {
        current,
        previous,
        trend: current > previous ? 'up' : current < previous ? 'down' : 'flat',
      },
      returnReasons,
      zonePerformance,
      codTrend,
    };
  }
}
