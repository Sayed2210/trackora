import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ShipmentStatus } from '@prisma/client';
import {
  AnalyticsDateRangeQueryDto,
  AnalyticsGroupBy,
  AnalyticsShipmentsQueryDto,
  AnalyticsUsageQueryDto,
} from '../dtos';
import { PlatformAnalyticsRepository } from '../repositories/platform-analytics.repository';

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class PlatformAnalyticsService {
  constructor(private readonly analyticsRepository: PlatformAnalyticsRepository) {}

  async getOverview() {
    const range = this.resolveDateRange({});
    const [tenants, totalShipments, activeMerchants, activeCouriers, codVolume, payoutVolume, fraudFlaggedShipments, topTenantsByShipmentVolume, recentGrowthSummary] = await Promise.all([
      this.analyticsRepository.getTenantStatusCounts(),
      this.analyticsRepository.countShipments(),
      this.analyticsRepository.countMerchants({ isActive: true }),
      this.analyticsRepository.countCouriers({ isActive: true }),
      this.analyticsRepository.getCodVolume(),
      this.analyticsRepository.getPayoutVolume(),
      this.analyticsRepository.countFraudFlaggedShipments(),
      this.analyticsRepository.getTopTenantsByShipmentVolume(),
      this.analyticsRepository.getTenantGrowthSummary(range),
    ]);

    return {
      totalTenants: tenants.total,
      activeTenants: tenants.active,
      trialTenants: tenants.trial,
      suspendedTenants: tenants.suspended,
      cancelledTenants: tenants.cancelled,
      totalShipments,
      activeMerchants,
      activeCouriers,
      codVolume: this.decimalToString(codVolume._sum.codAmount),
      payoutVolume: this.decimalToString(payoutVolume._sum.amount),
      fraudFlaggedShipments,
      topTenantsByShipmentVolume,
      recentGrowthSummary,
    };
  }

  async getUsage(query: AnalyticsUsageQueryDto) {
    const range = this.resolveDateRange(query);
    const groupBy = query.groupBy ?? AnalyticsGroupBy.DAY;
    const buckets = this.buildBuckets(range.from, range.to, groupBy);

    // TODO(analytics): replace per-bucket counts with materialized stats when volume exceeds API budget.
    const data = await Promise.all(
      buckets.map(async (bucket) => {
        const shipmentWhere: Prisma.ShipmentWhereInput = {
          createdAt: { gte: bucket.from, lt: bucket.to },
          tenantId: query.tenantId,
        };
        const scopedWhere = { tenantId: query.tenantId, createdAt: { gte: bucket.from, lt: bucket.to } };
        const [shipments, merchants, couriers] = await Promise.all([
          this.analyticsRepository.countShipments(shipmentWhere),
          this.analyticsRepository.countMerchants(scopedWhere),
          this.analyticsRepository.countCouriers(scopedWhere),
        ]);

        return {
          periodStart: bucket.from,
          periodEnd: bucket.to,
          shipments,
          merchants,
          couriers,
        };
      }),
    );

    return {
      from: range.from,
      to: range.to,
      groupBy,
      tenantId: query.tenantId ?? null,
      metric: query.metric ?? null,
      data,
    };
  }

  async getRevenue() {
    const [subscriptions, estimatedMrrByPlan, invoiceTotals] = await Promise.all([
      this.analyticsRepository.getSubscriptionStatusCounts(),
      this.analyticsRepository.getEstimatedMrrByPlan(),
      this.analyticsRepository.getManualInvoiceTotals(),
    ]);
    const revenueByPlan = estimatedMrrByPlan.map((item) => {
      const monthlyPrice = item.plan?.monthlyPrice ?? new Prisma.Decimal(0);
      return {
        plan: item.plan
          ? {
              id: item.plan.id,
              name: item.plan.name,
              slug: item.plan.slug,
              currency: item.plan.currency,
              monthlyPrice: monthlyPrice.toString(),
            }
          : null,
        activeSubscriptions: item.activeSubscriptions,
        estimatedMonthlyRevenue: monthlyPrice.mul(item.activeSubscriptions).toString(),
      };
    });
    const estimatedMrr = revenueByPlan.reduce(
      (sum, item) => sum.add(item.estimatedMonthlyRevenue),
      new Prisma.Decimal(0),
    );

    return {
      currency: 'EGP',
      activeSubscriptionsCount: subscriptions.active,
      trialSubscriptionsCount: subscriptions.trial,
      pastDueSubscriptionsCount: subscriptions.pastDue,
      cancelledSubscriptionsCount: subscriptions.cancelled,
      estimatedMrr: estimatedMrr.toString(),
      unpaidAmount: this.decimalToString(invoiceTotals.unpaid._sum.amount),
      paidAmount: this.decimalToString(invoiceTotals.paid._sum.amount),
      revenueByPlan,
    };
  }

  async getShipments(query: AnalyticsShipmentsQueryDto) {
    const range = this.resolveDateRange(query);
    const where: Prisma.ShipmentWhereInput = {
      createdAt: { gte: range.from, lte: range.to },
      tenantId: query.tenantId,
      status: query.status,
    };
    const [totalShipments, deliveredShipments, failedShipments, returnedShipments, pendingShipments, topTenantsByShipmentVolume, byStatus] = await Promise.all([
      this.analyticsRepository.countShipments(where),
      this.analyticsRepository.countShipments({ ...where, status: ShipmentStatus.DELIVERED }),
      this.analyticsRepository.countShipments({ ...where, status: ShipmentStatus.FAILED }),
      this.analyticsRepository.countShipments({ ...where, status: ShipmentStatus.RETURNED }),
      this.analyticsRepository.countShipments({ ...where, status: ShipmentStatus.PENDING }),
      this.analyticsRepository.getTopTenantsByShipmentVolume(where),
      this.analyticsRepository.getShipmentsByStatus(where),
    ]);

    return {
      from: range.from,
      to: range.to,
      tenantId: query.tenantId ?? null,
      status: query.status ?? null,
      totalShipments,
      deliveredShipments,
      failedShipments,
      returnedShipments,
      pendingShipments,
      successRate: this.toRate(deliveredShipments, totalShipments),
      failureRate: this.toRate(failedShipments, totalShipments),
      topTenantsByShipmentVolume,
      shipmentsByStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
    };
  }

  private resolveDateRange(query: AnalyticsDateRangeQueryDto) {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    if (from > to) {
      throw new BadRequestException('Date range start must be before end');
    }
    const rangeDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (rangeDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
    }
    return { from, to };
  }

  private buildBuckets(from: Date, to: Date, groupBy: AnalyticsGroupBy) {
    const buckets: Array<{ from: Date; to: Date }> = [];
    let cursor = new Date(from);
    while (cursor < to) {
      const next = new Date(cursor);
      if (groupBy === AnalyticsGroupBy.MONTH) {
        next.setUTCMonth(next.getUTCMonth() + 1);
      } else if (groupBy === AnalyticsGroupBy.WEEK) {
        next.setUTCDate(next.getUTCDate() + 7);
      } else {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      buckets.push({ from: new Date(cursor), to: next > to ? to : new Date(next) });
      cursor = next;
    }
    return buckets;
  }

  private decimalToString(value: Prisma.Decimal | null | undefined) {
    return (value ?? new Prisma.Decimal(0)).toString();
  }

  private toRate(part: number, total: number) {
    return total === 0 ? 0 : Number((part / total).toFixed(4));
  }
}
