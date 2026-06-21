import { Test, TestingModule } from '@nestjs/testing';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '@common/decorators/permissions.decorator';
import { PlatformSubscriptionsController } from '../controllers/platform-subscriptions.controller';
import { PlatformSubscriptionsService } from '../services/platform-subscriptions.service';

const subscriptionId = '123e4567-e89b-42d3-a456-426614174000';

describe('PlatformSubscriptionsController', () => {
  let controller: PlatformSubscriptionsController;
  let service: jest.Mocked<PlatformSubscriptionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformSubscriptionsController],
      providers: [
        {
          provide: PlatformSubscriptionsService,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            changePlan: jest.fn(),
            cancel: jest.fn(),
            renew: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PlatformSubscriptionsController);
    service = module.get(PlatformSubscriptionsService);
  });

  it('delegates list subscriptions', async () => {
    const response = { data: [], total: 0, page: 1, limit: 20 };
    service.findAll.mockResolvedValueOnce(response);

    await expect(controller.findAll({ page: 1, limit: 20 })).resolves.toEqual(
      response,
    );
  });

  it('delegates change plan', async () => {
    const dto = {
      planId: '123e4567-e89b-42d3-a456-426614174002',
      reason: 'upgrade',
    };
    service.changePlan.mockResolvedValueOnce({ id: subscriptionId } as any);

    await controller.changePlan({ id: subscriptionId }, dto);

    expect(service.changePlan).toHaveBeenCalledWith(subscriptionId, dto);
  });

  it('uses any read permissions for list/detail endpoints', () => {
    expect(
      Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.findAll),
    ).toEqual([
      PERMISSIONS.MANAGE_SUBSCRIPTIONS,
      PERMISSIONS.VIEW_BILLING,
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    ]);
    expect(
      Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.findById),
    ).toEqual([
      PERMISSIONS.MANAGE_SUBSCRIPTIONS,
      PERMISSIONS.VIEW_BILLING,
      PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
    ]);
  });

  it('requires manage_subscriptions for mutation endpoints', () => {
    for (const handler of [
      controller.update,
      controller.changePlan,
      controller.cancel,
      controller.renew,
    ]) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
        PERMISSIONS.MANAGE_SUBSCRIPTIONS,
      ]);
    }
  });
});
