import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MerchantDashboardController } from '../controllers/merchant-dashboard.controller';
import { MerchantDashboardService } from '../services/merchant-dashboard.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

const mockDashboardService = {
  getDashboard: jest.fn(),
  getAnalytics: jest.fn(),
};

const TEST_UUID = '123e4567-e89b-12d3-a456-426614174001';

const mockGuard = { canActivate: jest.fn(() => true) };

describe('MerchantDashboardController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MerchantDashboardController],
      providers: [
        { provide: MerchantDashboardService, useValue: mockDashboardService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /merchant/:id/dashboard', () => {
    it('should return merchant dashboard', async () => {
      const dashboard = {
        totalShipments: 100,
        delivered: 85,
        pending: 10,
        failed: 5,
      };
      mockDashboardService.getDashboard.mockResolvedValue(dashboard);

      const res = await request(app.getHttpServer())
        .get(`/merchant/${TEST_UUID}/dashboard`)
        .expect(200);

      expect(res.body).toEqual(dashboard);
      expect(mockDashboardService.getDashboard).toHaveBeenCalledWith(TEST_UUID);
    });
  });

  describe('GET /merchant/:id/analytics', () => {
    it('should return analytics with default 30 days', async () => {
      const analytics = { dailyStats: [] };
      mockDashboardService.getAnalytics.mockResolvedValue(analytics);

      const res = await request(app.getHttpServer())
        .get(`/merchant/${TEST_UUID}/analytics`)
        .expect(200);

      expect(res.body).toEqual(analytics);
      expect(mockDashboardService.getAnalytics).toHaveBeenCalledWith(
        TEST_UUID,
        30,
      );
    });

    it('should return analytics with custom days', async () => {
      const analytics = { dailyStats: [] };
      mockDashboardService.getAnalytics.mockResolvedValue(analytics);

      const res = await request(app.getHttpServer())
        .get(`/merchant/${TEST_UUID}/analytics?days=7`)
        .expect(200);

      expect(res.body).toEqual(analytics);
      expect(mockDashboardService.getAnalytics).toHaveBeenCalledWith(
        TEST_UUID,
        7,
      );
    });
  });
});
