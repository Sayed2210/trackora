import { NotFoundException } from '@nestjs/common';
import { FeatureFlagKey, TenantStatus } from '@prisma/client';
import { PlatformFeatureFlagsRepository } from '../repositories/platform-feature-flags.repository';
import { PlatformFeatureFlagsService } from '../services/platform-feature-flags.service';

const tenantId = '123e4567-e89b-42d3-a456-426614174000';
const now = new Date('2026-05-22T00:00:00.000Z');

const createTenant = (overrides: Partial<any> = {}) => ({
  id: tenantId,
  name: 'Acme Store',
  slug: 'acme-store',
  status: TenantStatus.ACTIVE,
  currentPlan: null,
  featureFlags: [],
  ...overrides,
});

describe('PlatformFeatureFlagsService', () => {
  let service: PlatformFeatureFlagsService;
  let repository: jest.Mocked<PlatformFeatureFlagsRepository>;

  beforeEach(() => {
    repository = {
      findGlobalFlags: jest.fn(),
      upsertGlobalFlag: jest.fn(),
      findTenantWithFlags: jest.fn(),
      updateTenantOverride: jest.fn(),
    } as unknown as jest.Mocked<PlatformFeatureFlagsRepository>;
    service = new PlatformFeatureFlagsService(repository);
  });

  it('lists global feature flags with safe false defaults for missing rows', async () => {
    repository.findGlobalFlags.mockResolvedValueOnce([
      {
        id: 'flag-id',
        key: FeatureFlagKey.api_access,
        name: 'API Access',
        description: 'Public API',
        defaultEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await service.findAllGlobal();

    expect(response).toHaveLength(Object.values(FeatureFlagKey).length);
    expect(response).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: FeatureFlagKey.api_access,
          defaultEnabled: true,
          createdAt: now,
        }),
        expect.objectContaining({
          key: FeatureFlagKey.smart_dispatch,
          defaultEnabled: false,
          createdAt: null,
        }),
      ]),
    );
  });

  it('updates global flags through upsert', async () => {
    repository.upsertGlobalFlag.mockResolvedValueOnce({
      id: 'flag-id',
      key: FeatureFlagKey.api_access,
      name: 'API Access',
      description: null,
      defaultEnabled: true,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.updateGlobal(FeatureFlagKey.api_access, {
        enabled: true,
        reason: 'Enable API access',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        key: FeatureFlagKey.api_access,
        defaultEnabled: true,
      }),
    );
    expect(repository.upsertGlobalFlag).toHaveBeenCalledWith(
      FeatureFlagKey.api_access,
      true,
    );
  });

  it('resolves tenant override before plan, global, and default false', async () => {
    repository.findTenantWithFlags.mockResolvedValueOnce(
      createTenant({
        currentPlan: {
          id: 'plan-id',
          name: 'Growth',
          slug: 'growth',
          featureFlags: [
            { featureKey: FeatureFlagKey.smart_dispatch, enabled: false },
          ],
        },
        featureFlags: [
          { featureKey: FeatureFlagKey.smart_dispatch, enabled: true },
        ],
      }),
    );
    repository.findGlobalFlags.mockResolvedValueOnce([
      {
        id: 'flag-id',
        key: FeatureFlagKey.smart_dispatch,
        name: 'Smart Dispatch',
        description: null,
        defaultEnabled: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await service.findTenantFlags(tenantId);

    expect(response.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: FeatureFlagKey.smart_dispatch,
          enabled: true,
          source: 'tenant_override',
          tenantOverrideValue: true,
          planEntitlementValue: false,
          globalDefaultValue: false,
        }),
      ]),
    );
  });

  it('resolves plan flags before global defaults', async () => {
    repository.findTenantWithFlags.mockResolvedValueOnce(
      createTenant({
        currentPlan: {
          id: 'plan-id',
          name: 'Growth',
          slug: 'growth',
          featureFlags: [
            { featureKey: FeatureFlagKey.fraud_detection, enabled: false },
          ],
        },
      }),
    );
    repository.findGlobalFlags.mockResolvedValueOnce([
      {
        id: 'flag-id',
        key: FeatureFlagKey.fraud_detection,
        name: 'Fraud Detection',
        description: null,
        defaultEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await service.findTenantFlags(tenantId);

    expect(response.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: FeatureFlagKey.fraud_detection,
          enabled: false,
          source: 'plan',
          planEntitlementValue: false,
          globalDefaultValue: true,
        }),
      ]),
    );
  });

  it('resolves global defaults before default false', async () => {
    repository.findTenantWithFlags.mockResolvedValueOnce(createTenant());
    repository.findGlobalFlags.mockResolvedValueOnce([
      {
        id: 'flag-id',
        key: FeatureFlagKey.public_tracking,
        name: 'Public Tracking',
        description: null,
        defaultEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await service.findTenantFlags(tenantId);

    expect(response.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: FeatureFlagKey.public_tracking,
          enabled: true,
          source: 'global',
          globalDefaultValue: true,
        }),
        expect.objectContaining({
          key: FeatureFlagKey.advanced_reports,
          enabled: false,
          source: 'default_false',
          globalDefaultValue: null,
        }),
      ]),
    );
  });

  it('removes null tenant overrides and returns inherited behavior', async () => {
    repository.findTenantWithFlags.mockResolvedValueOnce(createTenant());
    repository.updateTenantOverride.mockResolvedValueOnce(createTenant());
    repository.findGlobalFlags.mockResolvedValueOnce([
      {
        id: 'flag-id',
        key: FeatureFlagKey.bulk_upload,
        name: 'Bulk Upload',
        description: null,
        defaultEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await service.updateTenantFlag(
      tenantId,
      FeatureFlagKey.bulk_upload,
      { enabled: null, reason: 'Return to inherited' },
      'platform-user-id',
    );

    expect(repository.updateTenantOverride).toHaveBeenCalledWith(
      tenantId,
      FeatureFlagKey.bulk_upload,
      null,
      'Return to inherited',
      'platform-user-id',
    );
    expect(response.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: FeatureFlagKey.bulk_upload,
          source: 'global',
          enabled: true,
        }),
      ]),
    );
  });

  it('throws 404 when tenant is missing', async () => {
    repository.findTenantWithFlags.mockResolvedValueOnce(null);

    await expect(service.findTenantFlags(tenantId)).rejects.toThrow(NotFoundException);
  });
});
