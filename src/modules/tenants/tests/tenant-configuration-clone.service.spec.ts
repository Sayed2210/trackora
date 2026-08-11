import { ConflictException, NotFoundException } from '@nestjs/common';
import { FeatureFlagKey, Prisma, TenantStatus, UserRole } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { PlatformAuditLogService } from '@modules/platform/audit-logs/services/platform-audit-log.service';
import { TenantConfigurationCloneService } from '../services/tenant-configuration-clone.service';

const sourceTenantId = '123e4567-e89b-42d3-a456-426614174000';
const targetTenantId = '123e4567-e89b-42d3-a456-426614174001';
const sourceActorId = '123e4567-e89b-42d3-a456-426614174002';
const platformActorId = '123e4567-e89b-42d3-a456-426614174003';

const sourceTenant = {
  id: sourceTenantId,
  metadata: { locale: 'ar-EG', landmarksRequired: true },
  featureFlags: [
    {
      id: '123e4567-e89b-42d3-a456-426614174010',
      featureKey: FeatureFlagKey.smart_dispatch,
      enabled: true,
      reason: 'Pilot tenant',
      changedByUserId: sourceActorId,
    },
    {
      id: '123e4567-e89b-42d3-a456-426614174011',
      featureKey: FeatureFlagKey.whatsapp_notifications,
      enabled: false,
      reason: null,
      changedByUserId: sourceActorId,
    },
  ],
};

const targetTenant = {
  id: targetTenantId,
  name: 'Alexandria Express',
  slug: 'alexandria-express',
  status: TenantStatus.TRIAL,
};

interface TransactionMock {
  tenant: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  tenantFeatureFlag: { createMany: jest.Mock };
  user: { create: jest.Mock };
  merchant: { create: jest.Mock };
  courier: { create: jest.Mock };
  shipment: { create: jest.Mock };
  wallet: { create: jest.Mock };
  payout: { create: jest.Mock };
  bulkJob: { create: jest.Mock };
  notification: { create: jest.Mock };
  impersonationSession: { create: jest.Mock };
  manualInvoice: { create: jest.Mock };
  subscription: { create: jest.Mock };
}

function createTransactionMock(): TransactionMock {
  return {
    tenant: {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce(sourceTenant)
        .mockResolvedValueOnce(null),
      create: jest.fn().mockResolvedValue(targetTenant),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tenantFeatureFlag: {
      createMany: jest
        .fn()
        .mockResolvedValue({ count: sourceTenant.featureFlags.length }),
    },
    user: { create: jest.fn() },
    merchant: { create: jest.fn() },
    courier: { create: jest.fn() },
    shipment: { create: jest.fn() },
    wallet: { create: jest.fn() },
    payout: { create: jest.fn() },
    bulkJob: { create: jest.fn() },
    notification: { create: jest.fn() },
    impersonationSession: { create: jest.fn() },
    manualInvoice: { create: jest.fn() },
    subscription: { create: jest.fn() },
  };
}

function firstMockArgument<T>(mock: jest.Mock): T {
  // Jest stores mock call arguments as `any[]`; contain that test-only cast here.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return mock.mock.calls[0][0] as T;
}

describe('TenantConfigurationCloneService', () => {
  let service: TenantConfigurationCloneService;
  let prisma: { $transaction: jest.Mock };
  let auditLogService: { writeAuditLog: jest.Mock };
  let tx: TransactionMock;

  beforeEach(() => {
    tx = createTransactionMock();
    prisma = {
      $transaction: jest.fn((callback: (client: TransactionMock) => unknown) =>
        callback(tx),
      ),
    };
    auditLogService = {
      writeAuditLog: jest.fn().mockResolvedValue({ id: 'audit-log-id' }),
    };
    service = new TenantConfigurationCloneService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as PlatformAuditLogService,
    );
  });

  it('atomically clones metadata and feature flag overrides with fresh IDs', async () => {
    const result = await service.cloneConfiguration(
      sourceTenantId,
      {
        name: targetTenant.name,
        slug: targetTenant.slug,
      },
      {
        user: {
          userId: platformActorId,
          role: UserRole.PLATFORM_ADMIN,
          permissions: [],
        },
      },
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.tenant.create).toHaveBeenCalledWith({
      data: {
        name: targetTenant.name,
        slug: targetTenant.slug,
        status: TenantStatus.TRIAL,
        trialStartsAt: null,
        trialEndsAt: null,
        currentPlanId: null,
        metadata: sourceTenant.metadata,
      },
      select: { id: true, name: true, slug: true, status: true },
    });

    const createManyInput = firstMockArgument<{
      data: Array<{
        id: string;
        tenantId: string;
        featureKey: FeatureFlagKey;
        enabled: boolean | null;
        reason: string | null;
        changedByUserId: string | null;
      }>;
    }>(tx.tenantFeatureFlag.createMany);
    expect(createManyInput.data).toHaveLength(2);
    for (const [index, copiedOverride] of createManyInput.data.entries()) {
      expect(copiedOverride.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(copiedOverride.id).not.toBe(sourceTenant.featureFlags[index].id);
      expect(copiedOverride.tenantId).toBe(targetTenantId);
      expect(copiedOverride.featureKey).toBe(
        sourceTenant.featureFlags[index].featureKey,
      );
      expect(copiedOverride.enabled).toBe(
        sourceTenant.featureFlags[index].enabled,
      );
      expect(copiedOverride.reason).toBe(
        sourceTenant.featureFlags[index].reason,
      );
      expect(copiedOverride.changedByUserId).toBe(platformActorId);
      expect(copiedOverride.changedByUserId).not.toBe(sourceActorId);
    }

    expect(result).toEqual({
      tenant: targetTenant,
      clonedFromTenantId: sourceTenantId,
      cloned: {
        metadata: true,
        featureFlagOverrides: true,
        featureFlagOverrideCount: 2,
      },
    });
    expect(result.tenant.id).not.toBe(sourceTenantId);
  });

  it('uses null as changedByUserId when no current platform actor is available', async () => {
    await service.cloneConfiguration(sourceTenantId, {
      name: targetTenant.name,
      slug: targetTenant.slug,
    });

    const createManyInput = firstMockArgument<{
      data: Array<{ changedByUserId: string | null }>;
    }>(tx.tenantFeatureFlag.createMany);
    expect(createManyInput.data).not.toHaveLength(0);
    expect(
      createManyInput.data.every(
        ({ changedByUserId }) => changedByUserId === null,
      ),
    ).toBe(true);
  });

  it('does not clone metadata when copyMetadata is false', async () => {
    const result = await service.cloneConfiguration(sourceTenantId, {
      name: targetTenant.name,
      slug: targetTenant.slug,
      copyMetadata: false,
    });

    const createData = firstMockArgument<{ data: Record<string, unknown> }>(
      tx.tenant.create,
    ).data;
    expect(createData).not.toHaveProperty('metadata');
    expect(result.cloned.metadata).toBe(false);
  });

  it('does not read or clone overrides when copyFeatureFlagOverrides is false', async () => {
    tx.tenant.findUnique.mockReset();
    tx.tenant.findUnique
      .mockResolvedValueOnce({
        id: sourceTenantId,
        metadata: sourceTenant.metadata,
      })
      .mockResolvedValueOnce(null);

    const result = await service.cloneConfiguration(sourceTenantId, {
      name: targetTenant.name,
      slug: targetTenant.slug,
      copyFeatureFlagOverrides: false,
    });

    const sourceQuery = firstMockArgument<{
      select: { featureFlags: boolean };
    }>(tx.tenant.findUnique);
    expect(sourceQuery.select.featureFlags).toBe(false);
    expect(tx.tenantFeatureFlag.createMany).not.toHaveBeenCalled();
    expect(result.cloned).toEqual({
      metadata: true,
      featureFlagOverrides: false,
      featureFlagOverrideCount: 0,
    });
  });

  it('leaves the source and all operational, financial, auth, and billing records unchanged', async () => {
    await service.cloneConfiguration(sourceTenantId, {
      name: targetTenant.name,
      slug: targetTenant.slug,
    });

    expect(tx.tenant.update).not.toHaveBeenCalled();
    expect(tx.tenant.delete).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.merchant.create).not.toHaveBeenCalled();
    expect(tx.courier.create).not.toHaveBeenCalled();
    expect(tx.shipment.create).not.toHaveBeenCalled();
    expect(tx.wallet.create).not.toHaveBeenCalled();
    expect(tx.payout.create).not.toHaveBeenCalled();
    expect(tx.bulkJob.create).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.impersonationSession.create).not.toHaveBeenCalled();
    expect(tx.manualInvoice.create).not.toHaveBeenCalled();
    expect(tx.subscription.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the source tenant does not exist', async () => {
    tx.tenant.findUnique.mockReset();
    tx.tenant.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.cloneConfiguration(sourceTenantId, {
        name: targetTenant.name,
        slug: targetTenant.slug,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.tenant.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the requested target slug already exists', async () => {
    tx.tenant.findUnique.mockReset();
    tx.tenant.findUnique
      .mockResolvedValueOnce(sourceTenant)
      .mockResolvedValueOnce({ id: targetTenantId });

    await expect(
      service.cloneConfiguration(sourceTenantId, {
        name: targetTenant.name,
        slug: targetTenant.slug,
      }),
    ).rejects.toThrow(ConflictException);
    expect(tx.tenant.create).not.toHaveBeenCalled();
  });

  it('maps a P2002 target-slug race to ConflictException', async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.6.0',
        meta: { target: ['slug'] },
      }),
    );

    await expect(
      service.cloneConfiguration(sourceTenantId, {
        name: targetTenant.name,
        slug: targetTenant.slug,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('writes clone audit metadata through the same transaction client', async () => {
    await service.cloneConfiguration(
      sourceTenantId,
      {
        name: targetTenant.name,
        slug: targetTenant.slug,
      },
      {
        user: {
          userId: platformActorId,
          role: UserRole.PLATFORM_ADMIN,
          permissions: [],
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
      },
    );

    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: targetTenantId,
        action: 'tenant.configuration_cloned',
        resourceType: 'Tenant',
        resourceId: targetTenantId,
        metadata: {
          sourceTenantId,
          targetTenantId,
          copiedScopes: ['metadata', 'feature_flag_overrides'],
          featureFlagOverrideCount: 2,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
      }),
      tx,
    );
  });

  it('rolls back the target tenant when configuration cloning fails', async () => {
    let committedTarget: typeof targetTenant | undefined;
    prisma.$transaction.mockImplementationOnce(
      async (callback: (client: TransactionMock) => Promise<unknown>) => {
        let pendingTarget: typeof targetTenant | undefined;
        tx.tenant.create.mockImplementationOnce(() => {
          pendingTarget = targetTenant;
          return Promise.resolve(targetTenant);
        });

        try {
          const result = await callback(tx);
          committedTarget = pendingTarget;
          return result;
        } catch (error) {
          pendingTarget = undefined;
          throw error;
        }
      },
    );
    tx.tenantFeatureFlag.createMany.mockRejectedValueOnce(
      new Error('feature override write failed'),
    );

    await expect(
      service.cloneConfiguration(sourceTenantId, {
        name: targetTenant.name,
        slug: targetTenant.slug,
      }),
    ).rejects.toThrow('feature override write failed');
    expect(committedTarget).toBeUndefined();
    expect(auditLogService.writeAuditLog).not.toHaveBeenCalled();
  });
});
