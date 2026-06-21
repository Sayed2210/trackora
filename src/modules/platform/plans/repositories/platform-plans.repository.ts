import { Injectable } from '@nestjs/common';
import { FeatureFlagKey, Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { PlanSortField, SortDirection } from '../dtos';

export type PlatformPlanWithDetails = Prisma.PlanGetPayload<{
  include: {
    featureFlags: true;
    _count: { select: { subscriptions: true } };
  };
}>;

export type PublicPlanWithFeatures = Prisma.PlanGetPayload<{
  include: {
    featureFlags: {
      include: {
        featureFlag: { select: { name: true } };
      };
    };
  };
}>;

export interface PlatformPlanFilter {
  isActive?: boolean;
  archivedAt?: null | { not: null };
  OR?: Array<Record<string, unknown>>;
}

@Injectable()
export class PlatformPlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    where: PlatformPlanFilter,
    orderBy: Prisma.PlanOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<PlatformPlanWithDetails[]> {
    return this.prisma.plan.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        featureFlags: { orderBy: { featureKey: 'asc' } },
        _count: { select: { subscriptions: true } },
      },
    });
  }

  async count(where: PlatformPlanFilter): Promise<number> {
    return this.prisma.plan.count({ where });
  }

  async findById(id: string): Promise<PlatformPlanWithDetails | null> {
    return this.prisma.plan.findUnique({
      where: { id },
      include: {
        featureFlags: { orderBy: { featureKey: 'asc' } },
        _count: { select: { subscriptions: true } },
      },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.plan.findUnique({ where: { slug } });
  }

  async findByName(name: string) {
    return this.prisma.plan.findFirst({ where: { name } });
  }

  async createWithFlags(
    data: Prisma.PlanCreateInput,
    flags: Array<{ key: FeatureFlagKey; enabled: boolean }>,
  ): Promise<PlatformPlanWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureFeatureFlags(
        tx,
        flags.map((flag) => flag.key),
      );
      const plan = await tx.plan.create({ data });
      await this.replacePlanFlags(tx, plan.id, flags);
      return tx.plan.findUniqueOrThrow({
        where: { id: plan.id },
        include: {
          featureFlags: { orderBy: { featureKey: 'asc' } },
          _count: { select: { subscriptions: true } },
        },
      });
    });
  }

  async updateWithFlags(
    id: string,
    data: Prisma.PlanUpdateInput,
    flags?: Array<{ key: FeatureFlagKey; enabled: boolean }>,
  ): Promise<PlatformPlanWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      if (flags !== undefined) {
        await this.ensureFeatureFlags(
          tx,
          flags.map((flag) => flag.key),
        );
      }
      await tx.plan.update({ where: { id }, data });
      if (flags !== undefined) {
        await this.replacePlanFlags(tx, id, flags);
      }
      return tx.plan.findUniqueOrThrow({
        where: { id },
        include: {
          featureFlags: { orderBy: { featureKey: 'asc' } },
          _count: { select: { subscriptions: true } },
        },
      });
    });
  }

  async archive(id: string): Promise<PlatformPlanWithDetails> {
    return this.updateWithFlags(id, {
      isActive: false,
      archivedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.plan.delete({ where: { id } });
  }

  async getReferenceCounts(id: string) {
    const [subscriptions, currentTenants] = await Promise.all([
      this.prisma.subscription.count({ where: { planId: id } }),
      this.prisma.tenant.count({ where: { currentPlanId: id } }),
    ]);
    return { subscriptions, currentTenants };
  }

  async findPublicPlans(): Promise<PublicPlanWithFeatures[]> {
    return this.prisma.plan.findMany({
      where: {
        isActive: true,
        isPublic: true,
        archivedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }],
      include: {
        featureFlags: {
          where: { enabled: true },
          include: {
            featureFlag: { select: { name: true } },
          },
          orderBy: { featureKey: 'asc' },
        },
      },
    });
  }

  toOrderBy(
    sortBy: PlanSortField = PlanSortField.CREATED_AT,
    direction: SortDirection = SortDirection.DESC,
  ): Prisma.PlanOrderByWithRelationInput {
    if (sortBy === PlanSortField.PRICE) {
      return { monthlyPrice: direction };
    }
    if (sortBy === PlanSortField.NAME) {
      return { name: direction };
    }
    return { createdAt: direction };
  }

  private async ensureFeatureFlags(
    tx: Prisma.TransactionClient,
    keys: FeatureFlagKey[],
  ): Promise<void> {
    for (const key of keys) {
      await tx.featureFlag.upsert({
        where: { key },
        create: {
          key,
          name: key
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '),
        },
        update: {},
      });
    }
  }

  private async replacePlanFlags(
    tx: Prisma.TransactionClient,
    planId: string,
    flags: Array<{ key: FeatureFlagKey; enabled: boolean }>,
  ): Promise<void> {
    await tx.planFeatureFlag.deleteMany({ where: { planId } });
    if (flags.length === 0) {
      return;
    }
    await tx.planFeatureFlag.createMany({
      data: flags.map((flag) => ({
        planId,
        featureKey: flag.key,
        enabled: flag.enabled,
      })),
    });
  }
}
