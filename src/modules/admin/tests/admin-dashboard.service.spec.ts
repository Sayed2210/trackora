import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@core/prisma/prisma.service';
import { AdminDashboardService } from '../services/admin-dashboard.service';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;

  const mockPrisma = {
    shipment: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { collectedCash: 0 } }),
    },
    courier: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { cashHeld: 0 } }),
    },
    payout: {
      count: jest.fn().mockResolvedValue(0),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return today stats', async () => {
      mockPrisma.shipment.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3);
      mockPrisma.shipment.aggregate.mockResolvedValueOnce({
        _sum: { collectedCash: 1500 },
      });
      mockPrisma.courier.count
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(4);

      const result = await service.getDashboard();

      expect(result.today.shipmentsCreated).toBe(10);
      expect(result.today.shipmentsDelivered).toBe(5);
      expect(result.today.shipmentsFailed).toBe(2);
      expect(result.today.totalCodCollected).toBe(1500);
      expect(result.pendingAssignments).toBe(3);
      expect(result.couriersOnline).toBe(8);
      expect(result.couriersOffline).toBe(4);
    });
  });

  describe('getFinancialSummary', () => {
    it('should return financial summary', async () => {
      mockPrisma.shipment.aggregate
        .mockResolvedValueOnce({ _sum: { collectedCash: 2000 } })
        .mockResolvedValueOnce({ _sum: { codAmount: 5000 } });
      mockPrisma.payout.count.mockResolvedValueOnce(7);
      mockPrisma.courier.aggregate.mockResolvedValueOnce({
        _sum: { cashHeld: 3500 },
      });

      const result = await service.getFinancialSummary();

      expect(result.dailyCodCollected).toBe(2000);
      expect(result.pendingSettlements).toBe(7);
      expect(result.totalCourierCashHeld).toBe(3500);
      expect(result.expectedVsActualCash.expected).toBe(5000);
      expect(result.expectedVsActualCash.actual).toBe(3500);
      expect(result.expectedVsActualCash.variance).toBe(1500);
    });
  });
});
