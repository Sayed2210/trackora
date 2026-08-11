import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TenantStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  AuditActorContext,
  PlatformAuditLogService,
} from '@modules/platform/audit-logs/services/platform-audit-log.service';
import {
  CloneTenantConfigurationDto,
  CloneTenantConfigurationResponseDto,
} from '../dtos';

@Injectable()
export class TenantConfigurationCloneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: PlatformAuditLogService,
  ) {}

  async cloneConfiguration(
    sourceTenantId: string,
    dto: CloneTenantConfigurationDto,
    audit?: AuditActorContext,
  ): Promise<CloneTenantConfigurationResponseDto> {
    const copyMetadata = dto.copyMetadata ?? true;
    const copyFeatureFlagOverrides = dto.copyFeatureFlagOverrides ?? true;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sourceTenant = await tx.tenant.findUnique({
          where: { id: sourceTenantId },
          select: {
            id: true,
            metadata: true,
            featureFlags: copyFeatureFlagOverrides
              ? {
                  select: {
                    id: true,
                    featureKey: true,
                    enabled: true,
                    reason: true,
                  },
                }
              : false,
          },
        });

        if (!sourceTenant) {
          throw new NotFoundException('Source tenant not found');
        }

        const existingTarget = await tx.tenant.findUnique({
          where: { slug: dto.slug },
          select: { id: true },
        });
        if (existingTarget) {
          throw new ConflictException('Tenant slug already exists');
        }

        const targetTenant = await tx.tenant.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            status: TenantStatus.TRIAL,
            trialStartsAt: null,
            trialEndsAt: null,
            currentPlanId: null,
            ...(copyMetadata && sourceTenant.metadata !== null
              ? {
                  metadata: sourceTenant.metadata,
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        });

        const sourceFeatureFlags = copyFeatureFlagOverrides
          ? sourceTenant.featureFlags
          : [];
        const changedByUserId = audit?.user?.userId ?? null;
        let featureFlagOverrideCount = 0;

        if (sourceFeatureFlags.length > 0) {
          const createdOverrides = await tx.tenantFeatureFlag.createMany({
            data: sourceFeatureFlags.map((override) => ({
              id: randomUUID(),
              tenantId: targetTenant.id,
              featureKey: override.featureKey,
              enabled: override.enabled,
              reason: override.reason,
              changedByUserId,
            })),
          });
          featureFlagOverrideCount = createdOverrides.count;
        }

        const copiedScopes = [
          ...(copyMetadata ? ['metadata'] : []),
          ...(copyFeatureFlagOverrides ? ['feature_flag_overrides'] : []),
        ];

        await this.auditLogService.writeAuditLog(
          {
            ...audit,
            tenantId: targetTenant.id,
            action: 'tenant.configuration_cloned',
            resourceType: 'Tenant',
            resourceId: targetTenant.id,
            metadata: {
              sourceTenantId,
              targetTenantId: targetTenant.id,
              copiedScopes,
              featureFlagOverrideCount,
            },
          },
          tx,
        );

        return {
          tenant: targetTenant,
          clonedFromTenantId: sourceTenant.id,
          cloned: {
            metadata: copyMetadata,
            featureFlagOverrides: copyFeatureFlagOverrides,
            featureFlagOverrideCount,
          },
        };
      });
    } catch (error) {
      this.handleUniqueViolation(error);
      throw error;
    }
  }

  private handleUniqueViolation(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(',') : String(target);
      if (fields.toLowerCase().includes('slug')) {
        throw new ConflictException('Tenant slug already exists');
      }
    }
  }
}
