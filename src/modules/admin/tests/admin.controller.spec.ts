import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AdminController } from '../controllers/admin.controller';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { ReportsService } from '../services/reports.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';

const mockDashboardService = {
  getDashboard: jest.fn(),
  getFinancialSummary: jest.fn(),
};

const mockReportsService = {
  generateDailyReport: jest.fn(),
  generateCourierPerformanceReport: jest.fn(),
  generateMerchantDeliveryReport: jest.fn(),
};

const mockGuard = { canActivate: jest.fn(() => true) };

describe('AdminController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminDashboardService, useValue: mockDashboardService },
        { provide: ReportsService, useValue: mockReportsService },
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

  describe('GET /admin/dashboard', () => {
    it('should return dashboard data', async () => {
      const dashboard = { totalShipments: 100, activeCouriers: 10 };
      mockDashboardService.getDashboard.mockResolvedValue(dashboard);

      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .expect(200);

      expect(res.body).toEqual(dashboard);
      expect(mockDashboardService.getDashboard).toHaveBeenCalled();
    });
  });

  describe('GET /admin/financial-summary', () => {
    it('should return financial summary', async () => {
      const summary = { totalRevenue: 50000, pendingPayouts: 5 };
      mockDashboardService.getFinancialSummary.mockResolvedValue(summary);

      const res = await request(app.getHttpServer())
        .get('/admin/financial-summary')
        .expect(200);

      expect(res.body).toEqual(summary);
      expect(mockDashboardService.getFinancialSummary).toHaveBeenCalled();
    });
  });

  describe('POST /admin/reports/daily', () => {
    it('should generate daily report for given date', async () => {
      const report = { date: '2024-05-01', shipments: 50 };
      mockReportsService.generateDailyReport.mockResolvedValue(report);

      const res = await request(app.getHttpServer())
        .post('/admin/reports/daily?date=2024-05-01')
        .expect(201);

      expect(res.body).toEqual(report);
      expect(mockReportsService.generateDailyReport).toHaveBeenCalledWith(
        '2024-05-01',
      );
    });
  });

  describe('POST /admin/reports/courier-performance', () => {
    it('should generate courier performance report with date range', async () => {
      const report = { couriers: [] };
      mockReportsService.generateCourierPerformanceReport.mockResolvedValue(
        report,
      );

      const res = await request(app.getHttpServer())
        .post(
          '/admin/reports/courier-performance?from=2024-05-01&to=2024-05-31',
        )
        .expect(201);

      expect(res.body).toEqual(report);
      expect(
        mockReportsService.generateCourierPerformanceReport,
      ).toHaveBeenCalledWith(new Date('2024-05-01'), new Date('2024-05-31'));
    });

    it('should generate report without date range', async () => {
      const report = { couriers: [] };
      mockReportsService.generateCourierPerformanceReport.mockResolvedValue(
        report,
      );

      const res = await request(app.getHttpServer())
        .post('/admin/reports/courier-performance')
        .expect(201);

      expect(res.body).toEqual(report);
      expect(
        mockReportsService.generateCourierPerformanceReport,
      ).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('POST /admin/reports/merchant-delivery', () => {
    it('should generate merchant delivery report', async () => {
      const report = { merchants: [] };
      mockReportsService.generateMerchantDeliveryReport.mockResolvedValue(
        report,
      );

      const res = await request(app.getHttpServer())
        .post('/admin/reports/merchant-delivery')
        .expect(201);

      expect(res.body).toEqual(report);
      expect(
        mockReportsService.generateMerchantDeliveryReport,
      ).toHaveBeenCalledWith(undefined, undefined);
    });
  });
});
