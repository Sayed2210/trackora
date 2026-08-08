import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { ShipmentsRepository } from '@modules/shipments/repositories/shipments.repository';
import { ShipmentStatusLogsRepository } from '@modules/shipments/repositories/shipment-status-logs.repository';
import { MerchantsRepository } from '@modules/merchants/repositories/merchants.repository';
import { CouriersRepository } from '@modules/couriers/repositories/couriers.repository';
import { AssignmentsRepository } from '@modules/assignments/repositories/assignments.repository';
import { WalletsRepository } from '@modules/wallets/repositories/wallets.repository';
import { PayoutsRepository } from '@modules/payouts/repositories/payouts.repository';
import { AdminDashboardService } from '@modules/admin/services/admin-dashboard.service';
import { ReportsService } from '@modules/admin/services/reports.service';
import { BulkUploadService } from '@modules/shipments/services/bulk-upload.service';

/* Jest asymmetric matchers are intentionally typed as any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

describe('P0 tenant isolation regression', () => {
  it('scopes shipment list, count, cursor, and UUID detail to Tenant B', async () => {
    const prisma = {
      shipment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      shipmentStatusLog: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const repository = new ShipmentsRepository(prisma);
    const where = { tenantId: tenantB };

    await repository.findWithFilters(where, 0, 20);
    await repository.countWithFilters(where);
    await repository.findWithCursor(where, undefined, 20);
    await expect(
      repository.findByIdForTenant('shipment-a', tenantB),
    ).resolves.toBeNull();
    await new ShipmentStatusLogsRepository(prisma).findByShipmentIdForTenant(
      'shipment-a',
      tenantB,
    );

    expect(prisma.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: tenantB } }),
    );
    expect(prisma.shipment.count).toHaveBeenCalledWith({ where });
    expect(prisma.shipment.findFirst).toHaveBeenCalledWith({
      where: { id: 'shipment-a', tenantId: tenantB },
    });
    expect(prisma.shipmentStatusLog.findMany).toHaveBeenCalledWith({
      where: { shipmentId: 'shipment-a', shipment: { tenantId: tenantB } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('uses tenant-scoped repository APIs for all directly tenant-owned records', async () => {
    const prisma = {
      merchant: { findFirst: jest.fn().mockResolvedValue(null) },
      courier: { findFirst: jest.fn().mockResolvedValue(null) },
      assignment: { findFirst: jest.fn().mockResolvedValue(null) },
      wallet: { findFirst: jest.fn().mockResolvedValue(null) },
      payout: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(
      new MerchantsRepository(prisma).findByIdForTenant('merchant-a', tenantB),
    ).resolves.toBeNull();
    await expect(
      new CouriersRepository(prisma).findByIdForTenant('courier-a', tenantB),
    ).resolves.toBeNull();
    await expect(
      new AssignmentsRepository(prisma).findByIdForTenant(
        'assignment-a',
        tenantB,
      ),
    ).resolves.toBeNull();
    await expect(
      new WalletsRepository(prisma).findByIdForTenant('wallet-a', tenantB),
    ).resolves.toBeNull();
    await expect(
      new PayoutsRepository(prisma).findByIdForTenant('payout-a', tenantB),
    ).resolves.toBeNull();

    expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
      where: { id: 'merchant-a', tenantId: tenantB },
    });
    expect(prisma.courier.findFirst).toHaveBeenCalledWith({
      where: { id: 'courier-a', tenantId: tenantB },
    });
    expect(prisma.assignment.findFirst).toHaveBeenCalledWith({
      where: { id: 'assignment-a', shipment: { tenantId: tenantB } },
    });
    expect(prisma.wallet.findFirst).toHaveBeenCalledWith({
      where: { id: 'wallet-a', tenantId: tenantB },
    });
    expect(prisma.payout.findFirst).toHaveBeenCalledWith({
      where: { id: 'payout-a', tenantId: tenantB },
    });
  });

  it('puts tenantId inside every dashboard aggregate instead of post-filtering', async () => {
    const shipment = {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { collectedCash: 0, codAmount: 0 } }),
    };
    const courier = {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { cashHeld: 0 } }),
    };
    const payout = { count: jest.fn().mockResolvedValue(0) };
    const service = new AdminDashboardService({
      shipment,
      courier,
      payout,
    } as unknown as PrismaService);

    await service.getDashboard(tenantB);
    await service.getFinancialSummary(tenantB);

    const tenantWhere = expect.objectContaining({
      where: expect.objectContaining({ tenantId: tenantB }),
    });
    expect(shipment.count).toHaveBeenNthCalledWith(1, tenantWhere);
    expect(shipment.count).toHaveBeenNthCalledWith(2, tenantWhere);
    expect(shipment.count).toHaveBeenNthCalledWith(3, tenantWhere);
    expect(shipment.count).toHaveBeenNthCalledWith(4, tenantWhere);
    expect(shipment.aggregate).toHaveBeenNthCalledWith(1, tenantWhere);
    expect(shipment.aggregate).toHaveBeenNthCalledWith(2, tenantWhere);
    expect(shipment.aggregate).toHaveBeenNthCalledWith(3, tenantWhere);
    expect(courier.count).toHaveBeenNthCalledWith(1, tenantWhere);
    expect(courier.count).toHaveBeenNthCalledWith(2, tenantWhere);
    expect(courier.aggregate).toHaveBeenNthCalledWith(1, tenantWhere);
    expect(payout.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantB }),
      }),
    );
  });

  it('scopes report exports before reading shipment, courier, or merchant rows', async () => {
    const prisma = {
      shipment: { findMany: jest.fn().mockResolvedValue([]) },
      zone: { findMany: jest.fn().mockResolvedValue([]) },
      courier: { findMany: jest.fn().mockResolvedValue([]) },
      merchant: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const reports = new ReportsService(prisma);

    await reports.generateDailyReport('2026-08-04', tenantB);
    await reports.generateCourierPerformanceReport(tenantB);
    await reports.generateMerchantDeliveryReport(tenantB);

    expect(prisma.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantB }),
      }),
    );
    expect(prisma.courier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: tenantB } }),
    );
    expect(prisma.merchant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: tenantB } }),
    );
  });

  it('rejects a Tenant B bulk upload targeting Tenant A merchant before parsing rows', async () => {
    const prisma = {
      merchant: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new BulkUploadService(
      prisma,
      {} as ShipmentsRepository,
      {} as never,
      {} as never,
    );

    await expect(
      service.processFile(
        Buffer.from('not parsed because ownership fails first'),
        tenantB,
        'operations-b',
        UserRole.OPERATIONS_MANAGER,
        'merchant-a',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
      where: { id: 'merchant-a', tenantId: tenantB, isActive: true },
      select: { id: true },
    });
  });

  it('keeps Tenant A and Tenant B fixture identities distinct', () => {
    const fixtures = {
      [tenantA]: {
        merchantId: 'merchant-a',
        courierId: 'courier-a',
        shipmentId: 'shipment-a',
        assignmentId: 'assignment-a',
        walletId: 'wallet-a',
        payoutId: 'payout-a',
      },
      [tenantB]: {
        merchantId: 'merchant-b',
        courierId: 'courier-b',
        shipmentId: 'shipment-b',
        assignmentId: 'assignment-b',
        walletId: 'wallet-b',
        payoutId: 'payout-b',
      },
    };

    expect(new Set(Object.values(fixtures).flatMap(Object.values)).size).toBe(
      12,
    );
  });
});
