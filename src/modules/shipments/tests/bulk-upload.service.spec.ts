import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, ShipmentStatus, ShipmentType, UserRole } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '@core/prisma/prisma.service';
import { TrackingNumberService } from '../services/tracking-number.service';
import { FraudDetectionService } from '../services/fraud-detection.service';
import {
  BulkUploadContext,
  BulkUploadService,
} from '../services/bulk-upload.service';

const MERCHANT_ID = '123e4567-e89b-42d3-a456-426614174001';
const TENANT_ID = '123e4567-e89b-42d3-a456-426614174002';
const USER_ID = '123e4567-e89b-42d3-a456-426614174003';

const context: BulkUploadContext = {
  merchantId: MERCHANT_ID,
  tenantId: TENANT_ID,
  uploadedByUserId: USER_ID,
  uploadedByRole: UserRole.MERCHANT,
};

const validRow = {
  customerName: 'أحمد محمد',
  customerPhone: '01012345678',
  addressText: 'شارع التحرير بجوار المترو',
  address: '{"landmark":"المترو"}',
  type: ShipmentType.COD,
  codAmount: 150.5,
  productDescription: 'حذاء',
  productValue: 200,
  weight: 1.5,
  pieces: 1,
  notes: 'اتصل قبل الوصول',
  zone: 'القاهرة',
  preferredDeliveryDate: '2026-08-01',
};

describe('BulkUploadService', () => {
  type CreatedShipment = Prisma.ShipmentCreateManyInput & {
    id: string;
    riskScore: number;
    createdAt: Date;
    updatedAt: Date;
  };

  let service: BulkUploadService;
  let createdData: Prisma.ShipmentCreateManyInput[];
  let returnedShipments: CreatedShipment[];
  let statusLogData: Prisma.ShipmentStatusLogCreateManyInput[];

  const tx = {
    merchant: { findFirst: jest.fn() },
    shipment: {
      createMany:
        jest.fn<
          (args: {
            data: Prisma.ShipmentCreateManyInput[];
          }) => Promise<{ count: number }>
        >(),
      findMany: jest.fn<(_args?: unknown) => Promise<CreatedShipment[]>>(),
    },
    shipmentStatusLog: {
      createMany: jest.fn<(_args: unknown) => Promise<{ count: number }>>(),
    },
  };
  const prisma = {
    merchant: { findFirst: jest.fn() },
    zone: { findMany: jest.fn() },
    $transaction:
      jest.fn<
        (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
      >(),
  };
  const trackingNumberService = { generateBatch: jest.fn() };
  const fraudDetection = { calculateRiskScore: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    createdData = [];
    returnedShipments = [];
    statusLogData = [];

    const merchant = {
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      isActive: true,
    };
    prisma.merchant.findFirst.mockResolvedValue(merchant);
    tx.merchant.findFirst.mockResolvedValue(merchant);
    prisma.zone.findMany.mockResolvedValue([
      { id: 'zone-id', code: 'CAI', nameAr: 'القاهرة' },
    ]);
    trackingNumberService.generateBatch.mockImplementation((count: number) =>
      Array.from({ length: count }, (_, index) => `TRK-${index + 1}`),
    );
    fraudDetection.calculateRiskScore.mockReturnValue(12);
    tx.shipment.createMany.mockImplementation(
      (args: { data: Prisma.ShipmentCreateManyInput[] }) => {
        const { data } = args;
        createdData.push(...data);
        returnedShipments = data.map((shipment, index) => ({
          ...shipment,
          id: `shipment-${index + 1}`,
          riskScore: shipment.riskScore ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        return Promise.resolve({ count: data.length });
      },
    );
    tx.shipment.findMany.mockImplementation(() =>
      Promise.resolve(returnedShipments),
    );
    tx.shipmentStatusLog.createMany.mockImplementation(
      (args: { data: Prisma.ShipmentStatusLogCreateManyInput[] }) => {
        statusLogData = args.data;
        return Promise.resolve({ count: args.data.length });
      },
    );
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    service = new BulkUploadService(
      prisma as unknown as PrismaService,
      trackingNumberService as unknown as TrackingNumberService,
      fraudDetection as unknown as FraudDetectionService,
    );
  });

  const workbookBuffer = (rows: Array<Record<string, unknown>>) => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipments');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  };

  it('creates valid shipments and initial status logs', async () => {
    const result = await service.processFile(
      workbookBuffer([
        validRow,
        {
          ...validRow,
          customerPhone: '01112345678',
          type: ShipmentType.PREPAID,
          codAmount: '',
          zone: 'CAI',
        },
      ]),
      context,
    );

    expect(result).toMatchObject({
      totalRows: 2,
      successCount: 2,
      failedCount: 0,
      errors: [],
    });
    expect(tx.shipment.createMany).toHaveBeenCalledTimes(1);
    expect(createdData).toHaveLength(2);
    expect(createdData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          merchantId: MERCHANT_ID,
          tenantId: TENANT_ID,
          status: ShipmentStatus.PENDING,
        }),
      ]),
    );
    expect(createdData[0].codAmount).toBeInstanceOf(Prisma.Decimal);
    expect(createdData[0].productValue).toBeInstanceOf(Prisma.Decimal);
    expect(createdData[0].weight).toBeInstanceOf(Prisma.Decimal);
    expect(statusLogData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shipmentId: 'shipment-1',
          newStatus: ShipmentStatus.PENDING,
          changedByUserId: USER_ID,
          changedByRole: UserRole.MERCHANT,
        }),
      ]),
    );
  });

  it('forces Merchant.id and tenantId from context instead of workbook cells', async () => {
    await service.processFile(
      workbookBuffer([
        {
          ...validRow,
          merchantId: USER_ID,
          tenantId: '123e4567-e89b-42d3-a456-426614174099',
        },
      ]),
      context,
    );

    expect(createdData[0].merchantId).toBe(MERCHANT_ID);
    expect(createdData[0].merchantId).not.toBe(USER_ID);
    expect(createdData[0].tenantId).toBe(TENANT_ID);
  });

  it('returns row-level errors and creates only valid rows', async () => {
    const result = await service.processFile(
      workbookBuffer([
        validRow,
        {
          ...validRow,
          customerName: '',
          customerPhone: '02012345678',
          addressText: '',
          type: 'INVALID',
          codAmount: 'NaN',
          productDescription: '',
          productValue: -1,
          weight: 0,
          pieces: 1.5,
          preferredDeliveryDate: '2026-02-30',
          zone: 'INACTIVE-ZONE',
        },
      ]),
      context,
    );

    expect(result.totalRows).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors[0].rowIndex).toBe(3);
    expect(result.errors[0].message).toContain('customerName is required');
    expect(result.errors[0].message).toContain(
      'customerPhone must be a valid Egyptian phone',
    );
    expect(result.errors[0].message).toContain('addressText is required');
    expect(result.errors[0].message).toContain(
      'productDescription is required',
    );
    expect(result.errors[0].message).toContain('type must be one of');
    expect(result.errors[0].message).toContain(
      'codAmount must be finite and non-negative',
    );
    expect(result.errors[0].message).toContain(
      'productValue must be finite and non-negative',
    );
    expect(result.errors[0].message).toContain(
      'weight must be finite and greater than zero',
    );
    expect(result.errors[0].message).toContain(
      'pieces must be a positive integer',
    );
    expect(result.errors[0].message).toContain(
      'preferredDeliveryDate must be a valid date',
    );
    expect(result.errors[0].message).toContain('Use an active zone code');
    expect(createdData).toHaveLength(1);
  });

  it('requires codAmount for COD and accepts zero as non-negative', async () => {
    const result = await service.processFile(
      workbookBuffer([
        { ...validRow, codAmount: '' },
        { ...validRow, customerPhone: '01212345678', codAmount: 0 },
      ]),
      context,
    );

    expect(result.failedCount).toBe(1);
    expect(result.successCount).toBe(1);
    expect(result.errors[0].message).toContain(
      'codAmount is required for COD shipments',
    );
    expect((createdData[0].codAmount as Prisma.Decimal).toString()).toBe('0');
  });

  it('returns errors instead of throwing when every data row is invalid', async () => {
    const result = await service.processFile(
      workbookBuffer([{ ...validRow, customerName: '' }]),
      context,
    );

    expect(result).toEqual({
      totalRows: 1,
      successCount: 0,
      failedCount: 1,
      errors: [{ rowIndex: 2, message: 'customerName is required' }],
    });
    expect(tx.shipment.createMany).not.toHaveBeenCalled();
  });

  it('rejects a missing Merchant before createMany', async () => {
    prisma.merchant.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.processFile(workbookBuffer([validRow]), context),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.shipment.createMany).not.toHaveBeenCalled();
  });

  it('rejects an inactive Merchant before createMany', async () => {
    prisma.merchant.findFirst.mockResolvedValueOnce({
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      isActive: false,
    });

    await expect(
      service.processFile(workbookBuffer([validRow]), context),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.shipment.createMany).not.toHaveBeenCalled();
  });

  it('rejects a mismatched Merchant tenant context before createMany', async () => {
    prisma.merchant.findFirst.mockResolvedValueOnce({
      id: MERCHANT_ID,
      tenantId: '123e4567-e89b-42d3-a456-426614174099',
      isActive: true,
    });

    await expect(
      service.processFile(workbookBuffer([validRow]), context),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.shipment.createMany).not.toHaveBeenCalled();
  });

  it('rechecks Merchant state in the transaction immediately before createMany', async () => {
    tx.merchant.findFirst.mockResolvedValueOnce({
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      isActive: false,
    });

    await expect(
      service.processFile(workbookBuffer([validRow]), context),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.shipment.createMany).not.toHaveBeenCalled();
  });

  it('requires tenant context for Admin bulk processing', async () => {
    await expect(
      service.processFile(workbookBuffer([validRow]), {
        ...context,
        tenantId: null,
        uploadedByRole: UserRole.SUPER_ADMIN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.merchant.findFirst).not.toHaveBeenCalled();
  });
});
