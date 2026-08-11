import { Test, TestingModule } from '@nestjs/testing';
import { TenantStatus } from '@prisma/client';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PERMISSIONS_KEY } from '@common/decorators/permissions.decorator';
import { DANGEROUS_ACTION_KEY } from '@common/decorators/dangerous-action.decorator';
import { TenantsController } from '../controllers/tenants.controller';
import { TenantsService } from '../services/tenants.service';
import { TenantOnboardingService } from '../services/tenant-onboarding.service';
import { TenantConfigurationCloneService } from '../services/tenant-configuration-clone.service';
import {
  CloneTenantConfigurationResponseDto,
  OnboardPlatformTenantDto,
} from '../dtos';

const tenantId = '123e4567-e89b-12d3-a456-426614174000';

const mockTenant = {
  id: tenantId,
  name: 'Cairo Express',
  slug: 'cairo-express',
  status: TenantStatus.TRIAL,
};

describe('TenantsController', () => {
  let controller: TenantsController;
  let service: jest.Mocked<TenantsService>;
  let onboardingService: jest.Mocked<TenantOnboardingService>;
  let configurationCloneService: jest.Mocked<TenantConfigurationCloneService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            changeStatus: jest.fn(),
          },
        },
        {
          provide: TenantOnboardingService,
          useValue: {
            onboard: jest.fn(),
          },
        },
        {
          provide: TenantConfigurationCloneService,
          useValue: {
            cloneConfiguration: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    service = module.get(TenantsService);
    onboardingService = module.get(TenantOnboardingService);
    configurationCloneService = module.get(TenantConfigurationCloneService);
  });

  it('creates tenant', async () => {
    service.create.mockResolvedValueOnce(mockTenant as any);

    const result = await controller.create({
      name: 'Cairo Express',
      slug: 'cairo-express',
    });

    expect(service.create).toHaveBeenCalledWith({
      name: 'Cairo Express',
      slug: 'cairo-express',
    });
    expect(result).toEqual(mockTenant);
  });

  it('lists tenants', async () => {
    const response = { data: [mockTenant], total: 1, page: 1, limit: 20 };
    service.findAll.mockResolvedValueOnce(response as any);

    const result = await controller.findAll({ page: 1, limit: 20 });

    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result).toEqual(response);
  });

  it('changes tenant status', async () => {
    service.changeStatus.mockResolvedValueOnce({
      ...mockTenant,
      status: TenantStatus.SUSPENDED,
    } as any);

    const result = await controller.changeStatus(tenantId, {
      status: TenantStatus.SUSPENDED,
    });

    expect(service.changeStatus).toHaveBeenCalledWith(tenantId, {
      status: TenantStatus.SUSPENDED,
    });
    expect(result.status).toBe(TenantStatus.SUSPENDED);
  });

  it('requires manage_tenants for create endpoint', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.create)).toEqual([
      PERMISSIONS.MANAGE_TENANTS,
    ]);
  });

  it('requires suspend_tenants for status endpoint', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controller.changeStatus),
    ).toEqual([PERMISSIONS.SUSPEND_TENANTS]);
  });

  it('onboards a tenant through the dedicated service', async () => {
    const dto: OnboardPlatformTenantDto = {
      tenant: {
        name: 'Cairo Express',
        slug: 'cairo-express',
      },
      subscription: {
        planId: '123e4567-e89b-42d3-a456-426614174002',
        reason: 'Tenant onboarding after offline contract',
      },
      owner: {
        name: 'Ahmed Ali',
        phone: '01000000000',
      },
    };
    const response = {
      tenant: {
        id: 'tenant-uuid',
        name: 'Cairo Express',
        slug: 'cairo-express',
        status: 'TRIAL',
        currentPlanId: 'plan-uuid',
      },
      subscription: {
        id: 'subscription-uuid',
        tenantId: 'tenant-uuid',
        planId: 'plan-uuid',
        status: 'TRIALING',
        paymentStatus: 'NOT_REQUIRED',
        currentPeriodStart: null,
        currentPeriodEnd: null,
      },
      owner: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        name: 'Ahmed Ali',
        phone: '01000000000',
        email: null,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
      credentials: {
        temporaryPassword: 'Trackora@12345',
      },
    };
    onboardingService.onboard.mockResolvedValueOnce(response);

    const result = await controller.onboard(dto);

    expect(onboardingService.onboard).toHaveBeenCalledWith(dto, undefined);
    expect(result).toEqual(response);
  });

  it('requires manage_tenants and manage_subscriptions for onboarding', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.onboard)).toEqual([
      PERMISSIONS.MANAGE_TENANTS,
      PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    ]);
  });

  it('marks onboarding as a dangerous action', () => {
    expect(
      Reflect.getMetadata(DANGEROUS_ACTION_KEY, controller.onboard),
    ).toEqual({ reason: 'tenant onboarding' });
  });

  it('clones tenant configuration through the dedicated service with audit context', async () => {
    const dto = {
      name: 'Alexandria Express',
      slug: 'alexandria-express',
    };
    const response: CloneTenantConfigurationResponseDto = {
      tenant: {
        id: '123e4567-e89b-42d3-a456-426614174001',
        name: dto.name,
        slug: dto.slug,
        status: TenantStatus.TRIAL,
      },
      clonedFromTenantId: tenantId,
      cloned: {
        metadata: true,
        featureFlagOverrides: true,
        featureFlagOverrideCount: 2,
      },
    };
    const request = {
      user: {
        userId: '123e4567-e89b-42d3-a456-426614174002',
        role: 'PLATFORM_ADMIN' as const,
        permissions: [
          PERMISSIONS.MANAGE_TENANTS,
          PERMISSIONS.MANAGE_FEATURE_FLAGS,
        ],
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Jest' },
    };
    configurationCloneService.cloneConfiguration.mockResolvedValueOnce(
      response,
    );

    const result = await controller.cloneConfiguration(tenantId, dto, request);

    expect(configurationCloneService.cloneConfiguration).toHaveBeenCalledWith(
      tenantId,
      dto,
      {
        user: request.user,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );
    expect(result).toEqual(response);
  });

  it('requires both tenant and feature flag management permissions for cloning', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controller.cloneConfiguration),
    ).toEqual([PERMISSIONS.MANAGE_TENANTS, PERMISSIONS.MANAGE_FEATURE_FLAGS]);
  });

  it('marks tenant configuration cloning as a dangerous action', () => {
    expect(
      Reflect.getMetadata(DANGEROUS_ACTION_KEY, controller.cloneConfiguration),
    ).toEqual({ reason: 'tenant configuration cloning' });
  });
});
