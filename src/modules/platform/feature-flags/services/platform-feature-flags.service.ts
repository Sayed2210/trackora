import { Injectable, NotFoundException } from '@nestjs/common';
import { FeatureFlagKey } from '@prisma/client';
import {
  UpdateGlobalFeatureFlagDto,
  UpdateTenantFeatureFlagDto,
} from '../dtos';
import {
  PlatformFeatureFlagsRepository,
  TenantWithFeatureFlagDetails,
} from '../repositories/platform-feature-flags.repository';
import {
  AuditActorContext,
  PlatformAuditLogService,
} from '@modules/platform/audit-logs/services/platform-audit-log.service';

type FeatureFlagSource =
  | 'tenant_override'
  | 'plan'
  | 'global'
  | 'default_false';

const FEATURE_FLAG_KEYS = Object.values(FeatureFlagKey);

@Injectable()
export class PlatformFeatureFlagsService {
  constructor(
    private readonly featureFlagsRepository: PlatformFeatureFlagsRepository,
    private readonly auditLogService: PlatformAuditLogService,
  ) {}

  async findAllGlobal() {
    const flags = await this.featureFlagsRepository.findGlobalFlags();
    const byKey = new Map(flags.map((flag) => [flag.key, flag]));

    return FEATURE_FLAG_KEYS.map((key) => {
      const flag = byKey.get(key);
      return {
        key,
        name: flag?.name ?? this.toFlagName(key),
        label: flag?.name ?? this.toFlagName(key),
        description: flag?.description ?? null,
        defaultEnabled: flag?.defaultEnabled ?? false,
        createdAt: flag?.createdAt ?? null,
        updatedAt: flag?.updatedAt ?? null,
      };
    });
  }

  async updateGlobal(
    key: FeatureFlagKey,
    dto: UpdateGlobalFeatureFlagDto,
    audit?: AuditActorContext,
  ) {
    const globalFlags =
      (await this.featureFlagsRepository.findGlobalFlags()) ?? [];
    const before = globalFlags.find((flag) => flag.key === key) ?? null;
    const flag = await this.featureFlagsRepository.upsertGlobalFlag(
      key,
      dto.enabled,
    );
    await this.auditLogService?.writeAuditLog({
      ...audit,
      action: 'feature_flag.global_changed',
      resourceType: 'FeatureFlag',
      resourceId: key,
      oldValue: before,
      newValue: flag,
      reason: dto.reason,
    });
    return {
      key: flag.key,
      name: flag.name,
      label: flag.name,
      description: flag.description,
      defaultEnabled: flag.defaultEnabled,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
    };
  }

  async findTenantFlags(tenantId: string) {
    const tenant =
      await this.featureFlagsRepository.findTenantWithFlags(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const globalFlags = await this.featureFlagsRepository.findGlobalFlags();
    return this.toTenantResponse(tenant, globalFlags);
  }

  async updateTenantFlag(
    tenantId: string,
    key: FeatureFlagKey,
    dto: UpdateTenantFeatureFlagDto,
    changedByUserId?: string,
    audit?: AuditActorContext,
  ) {
    const tenant =
      await this.featureFlagsRepository.findTenantWithFlags(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const before =
      tenant.featureFlags.find((flag) => flag.featureKey === key) ?? null;
    const updatedTenant =
      await this.featureFlagsRepository.updateTenantOverride(
        tenantId,
        key,
        dto.enabled,
        dto.reason,
        changedByUserId,
      );
    const after =
      updatedTenant.featureFlags.find((flag) => flag.featureKey === key) ??
      null;
    await this.auditLogService?.writeAuditLog({
      ...audit,
      tenantId,
      action:
        dto.enabled === null
          ? 'feature_flag.tenant_override_removed'
          : 'feature_flag.tenant_override_changed',
      resourceType: 'TenantFeatureFlag',
      resourceId: tenantId,
      oldValue: before,
      newValue: after,
      reason: dto.reason,
    });
    const globalFlags = await this.featureFlagsRepository.findGlobalFlags();
    return this.toTenantResponse(updatedTenant, globalFlags);
  }

  private toTenantResponse(
    tenant: TenantWithFeatureFlagDetails,
    globalFlags: Awaited<
      ReturnType<PlatformFeatureFlagsRepository['findGlobalFlags']>
    >,
  ) {
    const tenantOverrides = new Map(
      tenant.featureFlags.map((flag) => [flag.featureKey, flag]),
    );
    const planFlags = new Map(
      tenant.currentPlan?.featureFlags.map((flag) => [flag.featureKey, flag]) ??
        [],
    );
    const globalByKey = new Map(globalFlags.map((flag) => [flag.key, flag]));

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        currentPlan: tenant.currentPlan
          ? {
              id: tenant.currentPlan.id,
              name: tenant.currentPlan.name,
              slug: tenant.currentPlan.slug,
            }
          : null,
      },
      flags: FEATURE_FLAG_KEYS.map((key) => {
        const tenantOverride = tenantOverrides.get(key);
        const planFlag = planFlags.get(key);
        const globalFlag = globalByKey.get(key);
        const resolution = this.resolveFlag(
          tenantOverride,
          planFlag,
          globalFlag,
        );

        return {
          key,
          name: globalFlag?.name ?? this.toFlagName(key),
          label: globalFlag?.name ?? this.toFlagName(key),
          description: globalFlag?.description ?? null,
          enabled: resolution.enabled,
          source: resolution.source,
          tenantOverrideValue: tenantOverride?.enabled ?? null,
          planEntitlementValue: planFlag?.enabled ?? null,
          globalDefaultValue: globalFlag?.defaultEnabled ?? null,
        };
      }),
    };
  }

  private resolveFlag(
    tenantOverride?: { enabled: boolean | null },
    planFlag?: { enabled: boolean },
    globalFlag?: { defaultEnabled: boolean },
  ): { enabled: boolean; source: FeatureFlagSource } {
    if (
      tenantOverride?.enabled !== undefined &&
      tenantOverride.enabled !== null
    ) {
      return { enabled: tenantOverride.enabled, source: 'tenant_override' };
    }
    if (planFlag) {
      return { enabled: planFlag.enabled, source: 'plan' };
    }
    if (globalFlag) {
      return { enabled: globalFlag.defaultEnabled, source: 'global' };
    }
    return { enabled: false, source: 'default_false' };
  }

  private toFlagName(key: FeatureFlagKey): string {
    return key
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
