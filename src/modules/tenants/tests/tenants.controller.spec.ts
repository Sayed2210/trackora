import { Test, TestingModule } from '@nestjs/testing';
import { TenantStatus } from '@prisma/client';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PERMISSIONS_KEY } from '@common/decorators/permissions.decorator';
import { TenantsController } from '../controllers/tenants.controller';
import { TenantsService } from '../services/tenants.service';

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
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    service = module.get(TenantsService);
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
});
