import { Test, TestingModule } from '@nestjs/testing';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '@common/decorators/permissions.decorator';
import { PlatformPlansController } from '../controllers/platform-plans.controller';
import { PlatformPlansService } from '../services/platform-plans.service';

const planId = '123e4567-e89b-42d3-a456-426614174000';

describe('PlatformPlansController', () => {
  let controller: PlatformPlansController;
  let service: jest.Mocked<PlatformPlansService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformPlansController],
      providers: [
        {
          provide: PlatformPlansService,
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PlatformPlansController);
    service = module.get(PlatformPlansService);
  });

  it('delegates list plans', async () => {
    const response = { data: [], total: 0, page: 1, limit: 20 };
    service.findAll.mockResolvedValueOnce(response);

    await expect(controller.findAll({ page: 1, limit: 20 })).resolves.toEqual(
      response,
    );
    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('delegates create plan', async () => {
    const dto = { name: 'Growth', slug: 'growth', monthlyPrice: '999.00' };
    service.create.mockResolvedValueOnce({ id: planId, ...dto } as any);

    await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('uses any read permissions for list/detail endpoints', () => {
    expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.findAll)).toEqual([
      PERMISSIONS.MANAGE_PLANS,
      PERMISSIONS.MANAGE_SUBSCRIPTIONS,
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    ]);
    expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.findById)).toEqual([
      PERMISSIONS.MANAGE_PLANS,
      PERMISSIONS.MANAGE_SUBSCRIPTIONS,
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    ]);
  });

  it('requires manage_plans for write endpoints', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.create)).toEqual([
      PERMISSIONS.MANAGE_PLANS,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.update)).toEqual([
      PERMISSIONS.MANAGE_PLANS,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller.remove)).toEqual([
      PERMISSIONS.MANAGE_PLANS,
    ]);
  });
});
