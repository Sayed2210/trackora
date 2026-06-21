import { Test, TestingModule } from '@nestjs/testing';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '@common/decorators/permissions.decorator';
import { PlatformSupportController } from '../controllers/platform-support.controller';
import { PlatformSupportService } from '../services/platform-support.service';

const tenantId = '123e4567-e89b-42d3-a456-426614174001';

describe('PlatformSupportController', () => {
  let controller: PlatformSupportController;
  let service: jest.Mocked<PlatformSupportService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformSupportController],
      providers: [
        {
          provide: PlatformSupportService,
          useValue: {
            searchTenants: jest.fn(),
            getTenantHealth: jest.fn(),
            startImpersonation: jest.fn(),
            endImpersonation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PlatformSupportController);
    service = module.get(PlatformSupportService);
  });

  it('delegates support endpoints', async () => {
    const request = {
      user: { userId: 'actor-id', permissions: [PERMISSIONS.VIEW_AUDIT_LOGS] },
      headers: {},
    } as any;
    service.searchTenants.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    service.getTenantHealth.mockResolvedValueOnce({
      tenant: { id: tenantId },
    } as any);
    service.startImpersonation.mockResolvedValueOnce({
      impersonation: { tenantId },
    } as any);
    service.endImpersonation.mockResolvedValueOnce({ ended: true } as any);

    await expect(
      controller.searchTenants({ page: 1, limit: 20 }),
    ).resolves.toEqual({ data: [], total: 0, page: 1, limit: 20 });
    await expect(
      controller.tenantHealth({ id: tenantId }, request),
    ).resolves.toEqual({ tenant: { id: tenantId } });
    await expect(
      controller.startImpersonation(
        { id: tenantId },
        { reason: 'support' },
        request,
      ),
    ).resolves.toEqual({ impersonation: { tenantId } });
    await expect(
      controller.endImpersonation({ reason: 'done' }, request),
    ).resolves.toEqual({ ended: true });
  });

  it('uses platform support permissions', () => {
    expect(
      Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.searchTenants),
    ).toEqual([
      PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
      PERMISSIONS.MANAGE_TENANTS,
    ]);
    expect(
      Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.tenantHealth),
    ).toEqual([
      PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
      PERMISSIONS.MANAGE_TENANTS,
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    ]);
    for (const handler of [
      controller.startImpersonation,
      controller.endImpersonation,
    ]) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
        PERMISSIONS.IMPERSONATE_TENANT_ADMIN,
      ]);
    }
  });
});
