import { BadRequestException } from '@nestjs/common';
import { Prisma, ShipmentStatus } from '@prisma/client';
import { AnalyticsGroupBy } from '../dtos';
import { PlatformAnalyticsRepository } from '../repositories/platform-analytics.repository';
import { PlatformAnalyticsService } from '../services/platform-analytics.service';

const tenantId = '123e4567-e89b-42d3-a456-426614174000';

describe('PlatformAnalyticsService', () => {
  let service: PlatformAnalyticsService;
  let repository: jest.Mocked<PlatformAnalyticsRepository>;

  beforeEach(() => {
    repository = {
      getTenantStatusCounts: jest.fn(),
      countShipments: jest.fn(),
      countMerchants: jest.fn(),
      countCouriers: jest.fn(),
      getCodVolume: jest.fn(),
      getPayoutVolume: jest.fn(),
      countFraudFlaggedShipments: jest.fn(),
      getTopTenantsByShipmentVolume: jest.fn(),
      getTenantGrowthSummary: jest.fn(),
      getSubscriptionStatusCounts: jest.fn(),
      getEstimatedMrrByPlan: jest.fn(),
      getManualInvoiceTotals: jest.fn(),
      getShipmentsByStatus: jest.fn(),
    } as unknown as jest.Mocked<PlatformAnalyticsRepository>;
    service = new PlatformAnalyticsService(repository);
  });

  it('returns overview with expected Decimal-safe shape', async () => {
    repository.getTenantStatusCounts.mockResolvedValueOnce({
      total: 10,
      active: 6,
      trial: 2,
      suspended: 1,
      cancelled: 1,
    });
    repository.countShipments.mockResolvedValueOnce(100);
    repository.countMerchants.mockResolvedValueOnce(20);
    repository.countCouriers.mockResolvedValueOnce(15);
    repository.getCodVolume.mockResolvedValueOnce({
      _sum: { codAmount: new Prisma.Decimal('1200.50') },
    });
    repository.getPayoutVolume.mockResolvedValueOnce({
      _sum: { amount: new Prisma.Decimal('800.25') },
    });
    repository.countFraudFlaggedShipments.mockResolvedValueOnce(3);
    repository.getTopTenantsByShipmentVolume.mockResolvedValueOnce([
      {
        tenant: { id: tenantId, name: 'Acme', slug: 'acme' },
        shipmentCount: 50,
      },
    ] as any);
    repository.getTenantGrowthSummary.mockResolvedValueOnce({
      currentTenants: 2,
      previousTenants: 1,
      currentShipments: 40,
      previousShipments: 30,
    });

    await expect(service.getOverview()).resolves.toEqual(
      expect.objectContaining({
        totalTenants: 10,
        activeTenants: 6,
        totalShipments: 100,
        codVolume: '1200.5',
        payoutVolume: '800.25',
        fraudFlaggedShipments: 3,
      }),
    );
  });

  it('returns Decimal-safe revenue values', async () => {
    repository.getSubscriptionStatusCounts.mockResolvedValueOnce({
      active: 3,
      trial: 1,
      pastDue: 1,
      cancelled: 2,
    });
    repository.getEstimatedMrrByPlan.mockResolvedValueOnce([
      {
        plan: {
          id: 'plan-id',
          name: 'Growth',
          slug: 'growth',
          monthlyPrice: new Prisma.Decimal('999.99'),
          currency: 'EGP',
        },
        activeSubscriptions: 2,
      },
    ]);
    repository.getManualInvoiceTotals.mockResolvedValueOnce({
      paid: { _sum: { amount: new Prisma.Decimal('500') } },
      unpaid: { _sum: { amount: new Prisma.Decimal('250') } },
    });

    await expect(service.getRevenue()).resolves.toEqual(
      expect.objectContaining({
        currency: 'EGP',
        activeSubscriptionsCount: 3,
        estimatedMrr: '1999.98',
        paidAmount: '500',
        unpaidAmount: '250',
        revenueByPlan: [
          expect.objectContaining({
            activeSubscriptions: 2,
            estimatedMonthlyRevenue: '1999.98',
          }),
        ],
      }),
    );
  });

  it('returns shipment analytics with rates and status breakdown', async () => {
    repository.countShipments
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    repository.getTopTenantsByShipmentVolume.mockResolvedValueOnce([]);
    repository.getShipmentsByStatus.mockResolvedValueOnce([
      { status: ShipmentStatus.DELIVERED, _count: { _all: 7 } },
      { status: ShipmentStatus.FAILED, _count: { _all: 2 } },
    ]);

    await expect(
      service.getShipments({
        from: new Date('2026-05-01T00:00:00.000Z'),
        to: new Date('2026-05-31T00:00:00.000Z'),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        totalShipments: 10,
        deliveredShipments: 7,
        failedShipments: 2,
        returnedShipments: 1,
        pendingShipments: 0,
        successRate: 0.7,
        failureRate: 0.2,
        shipmentsByStatus: [
          { status: ShipmentStatus.DELIVERED, count: 7 },
          { status: ShipmentStatus.FAILED, count: 2 },
        ],
      }),
    );
  });

  it('keeps tenant filter on shipment top tenant analytics', async () => {
    repository.countShipments.mockResolvedValue(0);
    repository.getTopTenantsByShipmentVolume.mockResolvedValueOnce([]);
    repository.getShipmentsByStatus.mockResolvedValueOnce([]);

    await service.getShipments({
      from: new Date('2026-05-01T00:00:00.000Z'),
      to: new Date('2026-05-31T00:00:00.000Z'),
      tenantId,
    });

    expect(repository.getTopTenantsByShipmentVolume).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
  });

  it('scopes usage counts by tenant when tenantId is provided', async () => {
    repository.countShipments.mockResolvedValue(5);
    repository.countMerchants.mockResolvedValue(2);
    repository.countCouriers.mockResolvedValue(1);

    const response = await service.getUsage({
      from: new Date('2026-05-01T00:00:00.000Z'),
      to: new Date('2026-05-03T00:00:00.000Z'),
      tenantId,
      groupBy: AnalyticsGroupBy.DAY,
    });

    expect(response.tenantId).toBe(tenantId);
    expect(response.data).toHaveLength(2);
    expect(repository.countShipments).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
    expect(repository.countMerchants).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
    expect(repository.countCouriers).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
  });

  it('rejects invalid date ranges', async () => {
    await expect(
      service.getUsage({
        from: new Date('2026-05-03T00:00:00.000Z'),
        to: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
