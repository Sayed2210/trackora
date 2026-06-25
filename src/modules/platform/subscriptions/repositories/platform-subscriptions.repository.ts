import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { SortDirection, SubscriptionSortField } from '../dtos';

const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.PAUSED,
];

export type PlatformSubscriptionWithDetails = Prisma.SubscriptionGetPayload<{
  include: {
    tenant: { select: { id: true; name: true; slug: true; status: true } };
    plan: {
      select: {
        id: true;
        name: true;
        slug: true;
        monthlyPrice: true;
        currency: true;
        monthlyShipmentLimit: true;
        adminUserLimit: true;
        merchantLimit: true;
        courierLimit: true;
        isActive: true;
        archivedAt: true;
      };
    };
  };
}>;

export interface UsageSnapshot {
  shipments: {
    used: number;
    limit: number | null;
    remaining: number | null;
    exceeded: boolean;
  };
  admins: {
    used: number;
    limit: number | null;
    remaining: number | null;
    exceeded: boolean;
  };
  merchants: {
    used: number;
    limit: number | null;
    remaining: number | null;
    exceeded: boolean;
  };
  couriers: {
    used: number;
    limit: number | null;
    remaining: number | null;
    exceeded: boolean;
  };
}

@Injectable()
export class PlatformSubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    where: Prisma.SubscriptionWhereInput,
    orderBy: Prisma.SubscriptionOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<PlatformSubscriptionWithDetails[]> {
    return this.prisma.subscription.findMany({
      where,
      orderBy,
      skip,
      take,
      include: this.includeDetails,
    });
  }

  async count(where: Prisma.SubscriptionWhereInput): Promise<number> {
    return this.prisma.subscription.count({ where });
  }

  async findById(id: string): Promise<PlatformSubscriptionWithDetails | null> {
    return this.prisma.subscription.findUnique({
      where: { id },
      include: this.includeDetails,
    });
  }

  async findPlanById(planId: string) {
    return this.prisma.plan.findUnique({ where: { id: planId } });
  }

  async findTenantById(tenantId: string) {
    return this.prisma.tenant.findUnique({ where: { id: tenantId } });
  }

  async findActiveByTenant(
    tenantId: string,
  ): Promise<PlatformSubscriptionWithDetails | null> {
    return this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ACTIVE_STATUSES },
      },
      include: this.includeDetails,
    });
  }

  async create(data: {
    tenantId: string;
    planId: string;
    status: SubscriptionStatus;
    paymentStatus: PaymentStatus;
    trialStartsAt?: Date | null;
    trialEndsAt?: Date | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<PlatformSubscriptionWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          tenantId: data.tenantId,
          planId: data.planId,
          status: data.status,
          paymentStatus: data.paymentStatus,
          trialStartsAt: data.trialStartsAt ?? null,
          trialEndsAt: data.trialEndsAt ?? null,
          currentPeriodStart: data.currentPeriodStart ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          metadata: data.metadata,
        },
      });
      await tx.tenant.update({
        where: { id: data.tenantId },
        data: { currentPlanId: data.planId },
      });
      return tx.subscription.findUniqueOrThrow({
        where: { id: subscription.id },
        include: this.includeDetails,
      });
    });
  }

  async update(id: string, data: Prisma.SubscriptionUpdateInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id }, data });
      return tx.subscription.findUniqueOrThrow({
        where: { id },
        include: this.includeDetails,
      });
    });
  }

  async changePlan(id: string, planId: string, effectiveDate?: Date) {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.update({
        where: { id },
        data: {
          planId,
          renewedAt: effectiveDate ?? new Date(),
        },
      });
      await tx.tenant.update({
        where: { id: subscription.tenantId },
        data: { currentPlanId: planId },
      });
      return tx.subscription.findUniqueOrThrow({
        where: { id },
        include: this.includeDetails,
      });
    });
  }

  async getUsage(
    subscription: PlatformSubscriptionWithDetails,
  ): Promise<UsageSnapshot> {
    const shipmentWhere: Prisma.ShipmentWhereInput = {
      tenantId: subscription.tenantId,
    };
    if (subscription.currentPeriodStart || subscription.currentPeriodEnd) {
      shipmentWhere.createdAt = {
        gte: subscription.currentPeriodStart ?? undefined,
        lte: subscription.currentPeriodEnd ?? undefined,
      };
    }

    const [shipments, admins, merchants, couriers] = await Promise.all([
      this.prisma.shipment.count({ where: shipmentWhere }),
      this.prisma.user.count({ where: { tenantId: subscription.tenantId } }),
      this.prisma.merchant.count({
        where: { tenantId: subscription.tenantId },
      }),
      this.prisma.courier.count({ where: { tenantId: subscription.tenantId } }),
    ]);

    return {
      shipments: this.toUsageItem(
        shipments,
        subscription.plan.monthlyShipmentLimit,
      ),
      admins: this.toUsageItem(admins, subscription.plan.adminUserLimit),
      merchants: this.toUsageItem(merchants, subscription.plan.merchantLimit),
      couriers: this.toUsageItem(couriers, subscription.plan.courierLimit),
    };
  }

  toOrderBy(
    sortBy: SubscriptionSortField = SubscriptionSortField.CREATED_AT,
    direction: SortDirection = SortDirection.DESC,
  ): Prisma.SubscriptionOrderByWithRelationInput {
    if (sortBy === SubscriptionSortField.RENEWAL_DATE) {
      return { currentPeriodEnd: direction };
    }
    if (sortBy === SubscriptionSortField.STATUS) {
      return { status: direction };
    }
    return { createdAt: direction };
  }

  private get includeDetails() {
    return {
      tenant: { select: { id: true, name: true, slug: true, status: true } },
      plan: {
        select: {
          id: true,
          name: true,
          slug: true,
          monthlyPrice: true,
          currency: true,
          monthlyShipmentLimit: true,
          adminUserLimit: true,
          merchantLimit: true,
          courierLimit: true,
          isActive: true,
          archivedAt: true,
        },
      },
    } satisfies Prisma.SubscriptionInclude;
  }

  private toUsageItem(used: number, limit: number | null) {
    return {
      used,
      limit,
      remaining: limit === null ? null : Math.max(limit - used, 0),
      exceeded: limit !== null && used > limit,
    };
  }
}
