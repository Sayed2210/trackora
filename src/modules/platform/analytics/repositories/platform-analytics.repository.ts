import { Injectable } from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  ShipmentStatus,
  SubscriptionStatus,
  TenantStatus,
} from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';

export interface AnalyticsDateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class PlatformAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantStatusCounts() {
    const [total, active, trial, suspended, cancelled] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.TRIAL } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.SUSPENDED } }),
      this.prisma.tenant.count({ where: { status: TenantStatus.CANCELLED } }),
    ]);
    return { total, active, trial, suspended, cancelled };
  }

  async countShipments(where: Prisma.ShipmentWhereInput = {}) {
    return this.prisma.shipment.count({ where });
  }

  async countMerchants(where: Prisma.MerchantWhereInput = {}) {
    return this.prisma.merchant.count({ where });
  }

  async countCouriers(where: Prisma.CourierWhereInput = {}) {
    return this.prisma.courier.count({ where });
  }

  async getCodVolume(where: Prisma.ShipmentWhereInput = {}) {
    return this.prisma.shipment.aggregate({ where, _sum: { codAmount: true } });
  }

  async getPayoutVolume(where: Prisma.PayoutWhereInput = {}) {
    return this.prisma.payout.aggregate({ where, _sum: { amount: true } });
  }

  async countFraudFlaggedShipments() {
    return this.prisma.shipmentRisk.count();
  }

  async getTopTenantsByShipmentVolume(where: Prisma.ShipmentWhereInput = {}) {
    const grouped = await this.prisma.shipment.groupBy({
      by: ['tenantId'],
      where: { ...where, tenantId: where.tenantId ?? { not: null } },
      _count: { _all: true },
      orderBy: { _count: { tenantId: 'desc' } },
      take: 5,
    });
    const tenantIds = grouped
      .map((item) => item.tenantId)
      .filter((tenantId): tenantId is string => Boolean(tenantId));
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true, status: true },
    });
    const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

    return grouped.map((item) => ({
      tenant: item.tenantId ? (tenantById.get(item.tenantId) ?? null) : null,
      shipmentCount: item._count._all,
    }));
  }

  async getTenantGrowthSummary(range: AnalyticsDateRange) {
    const previousFrom = new Date(
      range.from.getTime() - (range.to.getTime() - range.from.getTime()),
    );
    const [
      currentTenants,
      previousTenants,
      currentShipments,
      previousShipments,
    ] = await Promise.all([
      this.prisma.tenant.count({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.tenant.count({
        where: { createdAt: { gte: previousFrom, lt: range.from } },
      }),
      this.prisma.shipment.count({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.shipment.count({
        where: { createdAt: { gte: previousFrom, lt: range.from } },
      }),
    ]);
    return {
      currentTenants,
      previousTenants,
      currentShipments,
      previousShipments,
    };
  }

  async getSubscriptionStatusCounts() {
    const [active, trial, pastDue, cancelled] = await Promise.all([
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.TRIALING },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.PAST_DUE },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.CANCELLED },
      }),
    ]);
    return { active, trial, pastDue, cancelled };
  }

  async getEstimatedMrrByPlan() {
    const grouped = await this.prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: SubscriptionStatus.ACTIVE },
      _count: { _all: true },
      orderBy: { _count: { planId: 'desc' } },
    });
    const plans = await this.prisma.plan.findMany({
      where: { id: { in: grouped.map((item) => item.planId) } },
      select: {
        id: true,
        name: true,
        slug: true,
        monthlyPrice: true,
        currency: true,
      },
    });
    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    return grouped.map((item) => ({
      plan: planById.get(item.planId) ?? null,
      activeSubscriptions: item._count._all,
    }));
  }

  async getManualInvoiceTotals() {
    const [paid, unpaid] = await Promise.all([
      this.prisma.manualInvoice.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.manualInvoice.aggregate({
        where: { status: { not: PaymentStatus.PAID } },
        _sum: { amount: true },
      }),
    ]);
    return { paid, unpaid };
  }

  async getShipmentsByStatus(where: Prisma.ShipmentWhereInput = {}) {
    return this.prisma.shipment.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
  }
}
