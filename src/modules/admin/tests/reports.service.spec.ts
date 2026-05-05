import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@core/prisma/prisma.service';
import { ReportsService } from '../services/reports.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrisma = {
    shipment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    zone: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    courier: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    merchant: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateDailyReport', () => {
    it('should return daily report', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([
        { status: 'DELIVERED', zoneId: 'z1', assignedCourierId: 'c1' },
        { status: 'PENDING', zoneId: 'z1', assignedCourierId: null },
      ]);
      mockPrisma.zone.findMany.mockResolvedValue([{ id: 'z1', nameAr: 'Maadi' }]);
      mockPrisma.courier.findMany.mockResolvedValue([
        { id: 'c1', user: { name: 'Ahmed' }, assignments: [] },
      ]);

      const result = await service.generateDailyReport('2026-05-04');

      expect(result.totalShipments).toBe(2);
      expect(result.byStatus.DELIVERED).toBe(1);
      expect(result.byStatus.PENDING).toBe(1);
    });
  });

  describe('generateCourierPerformanceReport', () => {
    it('should return courier performance', async () => {
      mockPrisma.courier.findMany.mockResolvedValue([
        {
          id: 'c1',
          user: { name: 'Ahmed' },
          totalDelivered: 10,
          totalFailed: 2,
          totalReturned: 0,
          avgDeliveryTimeMinutes: 45,
          assignments: [],
        },
      ]);

      const result = await service.generateCourierPerformanceReport();

      expect(result).toHaveLength(1);
      expect(result[0].courierName).toBe('Ahmed');
      expect(result[0].successRate).toBe(83.3);
    });
  });

  describe('generateMerchantDeliveryReport', () => {
    it('should return merchant delivery stats', async () => {
      mockPrisma.merchant.findMany.mockResolvedValue([
        {
          id: 'm1',
          businessName: 'Test Store',
          user: { name: 'Owner' },
          shipments: [
            { status: 'DELIVERED', returnReason: null },
            { status: 'RETURNED', returnReason: 'CUSTOMER_NOT_AVAILABLE' },
          ],
        },
      ]);

      const result = await service.generateMerchantDeliveryReport();

      expect(result).toHaveLength(1);
      expect(result[0].merchantName).toBe('Test Store');
      expect(result[0].delivered).toBe(1);
      expect(result[0].returned).toBe(1);
      expect(result[0].successRate).toBe(50);
    });
  });
});
