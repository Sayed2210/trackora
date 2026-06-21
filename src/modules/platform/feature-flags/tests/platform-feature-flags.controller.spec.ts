import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagKey } from '@prisma/client';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '@common/decorators/permissions.decorator';
import { PlatformFeatureFlagsController } from '../controllers/platform-feature-flags.controller';
import { PlatformFeatureFlagsService } from '../services/platform-feature-flags.service';

const tenantId = '123e4567-e89b-42d3-a456-426614174000';

describe('PlatformFeatureFlagsController', () => {
  let controller: PlatformFeatureFlagsController;
  let service: jest.Mocked<PlatformFeatureFlagsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformFeatureFlagsController],
      providers: [
        {
          provide: PlatformFeatureFlagsService,
          useValue: {
            findAllGlobal: jest.fn(),
            updateGlobal: jest.fn(),
            findTenantFlags: jest.fn(),
            updateTenantFlag: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PlatformFeatureFlagsController);
    service = module.get(PlatformFeatureFlagsService);
  });

  it('delegates global flag listing and updates', async () => {
    service.findAllGlobal.mockResolvedValueOnce([]);
    service.updateGlobal.mockResolvedValueOnce({
      key: FeatureFlagKey.api_access,
    } as any);

    await expect(controller.findAllGlobal()).resolves.toEqual([]);
    await controller.updateGlobal(
      { key: FeatureFlagKey.api_access },
      { enabled: true, reason: 'Enable API access for launch' },
    );

    expect(service.updateGlobal).toHaveBeenCalledWith(
      FeatureFlagKey.api_access,
      {
        enabled: true,
        reason: 'Enable API access for launch',
      },
    );
  });

  it('delegates tenant flag listing and override updates with actor user', async () => {
    service.findTenantFlags.mockResolvedValueOnce({
      tenant: { id: tenantId },
      flags: [],
    });
    service.updateTenantFlag.mockResolvedValueOnce({
      tenant: { id: tenantId },
      flags: [],
    });

    await expect(controller.findTenantFlags({ id: tenantId })).resolves.toEqual(
      {
        tenant: { id: tenantId },
        flags: [],
      },
    );
    await controller.updateTenantFlag(
      { id: tenantId, key: FeatureFlagKey.bulk_upload },
      { enabled: null, reason: 'Return to inherited entitlement' },
      { user: { userId: 'platform-user-id' } } as any,
    );

    expect(service.updateTenantFlag).toHaveBeenCalledWith(
      tenantId,
      FeatureFlagKey.bulk_upload,
      { enabled: null, reason: 'Return to inherited entitlement' },
      'platform-user-id',
    );
  });

  it('uses any read permissions for global and tenant list endpoints', () => {
    expect(
      Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.findAllGlobal),
    ).toEqual([
      PERMISSIONS.MANAGE_FEATURE_FLAGS,
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    ]);
    expect(
      Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.findTenantFlags),
    ).toEqual([PERMISSIONS.MANAGE_FEATURE_FLAGS, PERMISSIONS.MANAGE_TENANTS]);
  });

  it('requires manage_feature_flags for mutation endpoints', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controller.updateGlobal),
    ).toEqual([PERMISSIONS.MANAGE_FEATURE_FLAGS]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controller.updateTenantFlag),
    ).toEqual([PERMISSIONS.MANAGE_FEATURE_FLAGS]);
  });
});
