import { Test, TestingModule } from '@nestjs/testing';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '@common/decorators/permissions.decorator';
import { PlatformAnalyticsController } from '../controllers/platform-analytics.controller';
import { PlatformAnalyticsService } from '../services/platform-analytics.service';

describe('PlatformAnalyticsController', () => {
  let controller: PlatformAnalyticsController;
  let service: jest.Mocked<PlatformAnalyticsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformAnalyticsController],
      providers: [
        {
          provide: PlatformAnalyticsService,
          useValue: {
            getOverview: jest.fn(),
            getUsage: jest.fn(),
            getRevenue: jest.fn(),
            getShipments: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PlatformAnalyticsController);
    service = module.get(PlatformAnalyticsService);
  });

  it('delegates analytics endpoint calls', async () => {
    service.getOverview.mockResolvedValueOnce({ totalTenants: 1 } as any);
    service.getUsage.mockResolvedValueOnce({ data: [] } as any);
    service.getRevenue.mockResolvedValueOnce({ estimatedMrr: '1000' } as any);
    service.getShipments.mockResolvedValueOnce({ totalShipments: 10 } as any);

    await expect(controller.overview()).resolves.toEqual({ totalTenants: 1 });
    await expect(controller.usage({})).resolves.toEqual({ data: [] });
    await expect(controller.revenue()).resolves.toEqual({
      estimatedMrr: '1000',
    });
    await expect(controller.shipments({})).resolves.toEqual({
      totalShipments: 10,
    });
  });

  it('requires view_platform_analytics for overview, usage, and shipments', () => {
    for (const handler of [
      controller.overview,
      controller.usage,
      controller.shipments,
    ]) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
        PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
      ]);
    }
  });

  it('allows analytics or billing permission for revenue', () => {
    expect(
      Reflect.getMetadata(ANY_PERMISSIONS_KEY, controller.revenue),
    ).toEqual([PERMISSIONS.VIEW_PLATFORM_ANALYTICS, PERMISSIONS.VIEW_BILLING]);
  });
});
