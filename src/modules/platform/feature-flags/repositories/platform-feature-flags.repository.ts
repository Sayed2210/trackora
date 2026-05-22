import { Injectable } from '@nestjs/common';
import { FeatureFlagKey, Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';

export type TenantWithFeatureFlagDetails = Prisma.TenantGetPayload<{
  include: {
    currentPlan: { include: { featureFlags: true } };
    featureFlags: true;
  };
}>;

@Injectable()
export class PlatformFeatureFlagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findGlobalFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertGlobalFlag(key: FeatureFlagKey, enabled: boolean) {
    return this.prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        name: this.toFlagName(key),
        defaultEnabled: enabled,
      },
      update: { defaultEnabled: enabled },
    });
  }

  async findTenantWithFlags(
    tenantId: string,
  ): Promise<TenantWithFeatureFlagDetails | null> {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        currentPlan: { include: { featureFlags: true } },
        featureFlags: true,
      },
    });
  }

  async updateTenantOverride(
    tenantId: string,
    key: FeatureFlagKey,
    enabled: boolean | null,
    reason: string,
    changedByUserId?: string,
  ): Promise<TenantWithFeatureFlagDetails> {
    return this.prisma.$transaction(async (tx) => {
      await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      await this.ensureFeatureFlag(tx, key);

      if (enabled === null) {
        await tx.tenantFeatureFlag.deleteMany({
          where: { tenantId, featureKey: key },
        });
      } else {
        await tx.tenantFeatureFlag.upsert({
          where: { tenantId_featureKey: { tenantId, featureKey: key } },
          create: {
            tenantId,
            featureKey: key,
            enabled,
            reason,
            changedByUserId,
          },
          update: { enabled, reason, changedByUserId },
        });
      }

      return tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        include: {
          currentPlan: { include: { featureFlags: true } },
          featureFlags: true,
        },
      });
    });
  }

  private async ensureFeatureFlag(
    tx: Prisma.TransactionClient,
    key: FeatureFlagKey,
  ): Promise<void> {
    await tx.featureFlag.upsert({
      where: { key },
      create: { key, name: this.toFlagName(key) },
      update: {},
    });
  }

  private toFlagName(key: FeatureFlagKey): string {
    return key
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
