import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@core/prisma/prisma.service';
import { MerchantDashboardService } from '../services/merchant-dashboard.service';

describe('MerchantDashboardService', () => {
  let service: MerchantDashboardService;

  const mockPrisma = {
    shipment: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _avg: { codAmount: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    zone: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantDashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MerchantDashboardService>(MerchantDashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return dashboard data', async () => {
      mockPrisma.shipment.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(5);
      mockPrisma.shipment.aggregate.mockResolvedValueOnce({
        _avg: { codAmount: 250 },
      });
      mockPrisma.shipment.findMany.mockResolvedValue([
        {
          id: 's1',
          trackingNumber: 'TRK-001',
          status: 'DELIVERED',
          customerName: 'Ahmed',
          codAmount: 300,
          createdAt: new Date(),
        },
      ]);

      const result = await service.getDashboard('merchant-1');

      expect(result.counts.total).toBe(100);
      expect(result.counts.pending).toBe(10);
      expect(result.counts.inTransit).toBe(20);
      expect(result.counts.delivered).toBe(60);
      expect(result.counts.returned).toBe(5);
      expect(result.deliverySuccessRate).toBe(92.3);
      expect(result.averageCodAmount).toBe(250);
      expect(result.recentActivity).toHaveLength(1);
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics('merchant-1', 7);

      expect(result.successRateTrend).toEqual([]);
      expect(result.returnReasons).toEqual([]);
      expect(result.zonePerformance).toEqual([]);
      expect(result.codCollectionTrend).toEqual([]);
    });
  });
});
