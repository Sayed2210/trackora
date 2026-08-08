import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@core/prisma/prisma.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { UserRole } from '@modules/users/entities/user.entity';
import {
  BulkUploadContext,
  BulkUploadService,
} from '@modules/shipments/services/bulk-upload.service';
import { PlatformAuditLogService } from '@modules/platform/audit-logs/services/platform-audit-log.service';
import { AdminShipmentBulkUploadController } from '../controllers/admin-shipment-bulk-upload.controller';

const ADMIN_USER_ID = '123e4567-e89b-42d3-a456-426614174001';
const MERCHANT_ID = '123e4567-e89b-42d3-a456-426614174002';
const TENANT_ID = '123e4567-e89b-42d3-a456-426614174003';
const OTHER_TENANT_ID = '123e4567-e89b-42d3-a456-426614174004';

const bulkResult = {
  totalRows: 2,
  successCount: 1,
  failedCount: 1,
  errors: [{ rowIndex: 3, message: 'customerName is required' }],
};

describe('AdminShipmentBulkUploadController', () => {
  let app: INestApplication;
  let currentRole = UserRole.SUPER_ADMIN;
  let capturedUploadContext: BulkUploadContext | undefined;

  const prisma = {
    user: { findUnique: jest.fn() },
    merchant: { findUnique: jest.fn() },
  };
  const bulkUploadService = {
    processFile:
      jest.fn<
        (
          buffer: Buffer,
          context: BulkUploadContext,
        ) => Promise<typeof bulkResult>
      >(),
  };
  const auditLogService = { writeAuditLog: jest.fn() };
  const authGuard = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const httpRequest = context
        .switchToHttp()
        .getRequest<{ user?: AuthenticatedRequestUser }>();
      httpRequest.user = {
        userId: ADMIN_USER_ID,
        role: currentRole,
        permissions: [],
        tenantId: TENANT_ID,
      };
      return true;
    }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminShipmentBulkUploadController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: BulkUploadService, useValue: bulkUploadService },
        { provide: PlatformAuditLogService, useValue: auditLogService },
        { provide: APP_GUARD, useValue: authGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentRole = UserRole.SUPER_ADMIN;
    capturedUploadContext = undefined;
    prisma.user.findUnique.mockResolvedValue({
      id: ADMIN_USER_ID,
      tenantId: TENANT_ID,
      role: currentRole,
      isActive: true,
    });
    prisma.merchant.findUnique.mockResolvedValue({
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      isActive: true,
    });
    bulkUploadService.processFile.mockImplementation(
      (_buffer: Buffer, uploadContext: BulkUploadContext) => {
        capturedUploadContext = uploadContext;
        return Promise.resolve(bulkResult);
      },
    );
    auditLogService.writeAuditLog.mockResolvedValue({ id: 'audit-id' });
  });

  const upload = (merchantId = MERCHANT_ID) =>
    request(app.getHttpServer())
      .post(`/admin/merchants/${merchantId}/shipments/bulk-upload`)
      .attach('file', Buffer.from('workbook'), 'shipments.xlsx');

  it('allows SUPER_ADMIN to upload for an active Merchant in the same tenant', async () => {
    await upload().expect(201);

    expect(bulkUploadService.processFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      {
        merchantId: MERCHANT_ID,
        tenantId: TENANT_ID,
        uploadedByUserId: ADMIN_USER_ID,
        uploadedByRole: UserRole.SUPER_ADMIN,
      },
    );
    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: ADMIN_USER_ID,
        actorRole: UserRole.SUPER_ADMIN,
        tenantId: TENANT_ID,
        action: 'shipment.bulk-upload',
        resourceType: 'Merchant',
        resourceId: MERCHANT_ID,
        newValue: {
          merchantId: MERCHANT_ID,
          tenantId: TENANT_ID,
          totalRows: 2,
          successCount: 1,
          failedCount: 1,
        },
      }),
    );
  });

  it('allows OPERATIONS_MANAGER to upload for an active Merchant', async () => {
    currentRole = UserRole.OPERATIONS_MANAGER;
    prisma.user.findUnique.mockResolvedValueOnce({
      id: ADMIN_USER_ID,
      tenantId: TENANT_ID,
      role: currentRole,
      isActive: true,
    });

    await upload().expect(201);

    expect(bulkUploadService.processFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        merchantId: MERCHANT_ID,
        uploadedByRole: UserRole.OPERATIONS_MANAGER,
      }),
    );
  });

  it('rejects MERCHANT from the Admin endpoint', async () => {
    currentRole = UserRole.MERCHANT;

    await upload().expect(403);

    expect(bulkUploadService.processFile).not.toHaveBeenCalled();
  });

  it('rejects unsupported Admin roles', async () => {
    currentRole = UserRole.FINANCE_ADMIN;

    await upload().expect(403);

    expect(bulkUploadService.processFile).not.toHaveBeenCalled();
  });

  it('rejects direct platform-role access', async () => {
    currentRole = UserRole.PLATFORM_ADMIN;

    await upload().expect(403);

    expect(bulkUploadService.processFile).not.toHaveBeenCalled();
  });

  it('rejects an invalid Merchant UUID', async () => {
    await upload('not-a-uuid').expect(400);

    expect(prisma.merchant.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the selected Merchant does not exist', async () => {
    prisma.merchant.findUnique.mockResolvedValueOnce(null);

    await upload().expect(404);

    expect(bulkUploadService.processFile).not.toHaveBeenCalled();
  });

  it('rejects an inactive Merchant', async () => {
    prisma.merchant.findUnique.mockResolvedValueOnce({
      id: MERCHANT_ID,
      tenantId: TENANT_ID,
      isActive: false,
    });

    await upload().expect(403);

    expect(bulkUploadService.processFile).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant Merchant access', async () => {
    prisma.merchant.findUnique.mockResolvedValueOnce({
      id: MERCHANT_ID,
      tenantId: OTHER_TENANT_ID,
      isActive: true,
    });

    await upload().expect(403);

    expect(bulkUploadService.processFile).not.toHaveBeenCalled();
  });

  it('rejects an Admin without tenant context', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: ADMIN_USER_ID,
      tenantId: null,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    });

    await upload().expect(403);

    expect(prisma.merchant.findUnique).not.toHaveBeenCalled();
  });

  it('never uses the Admin User.id as Shipment.merchantId', async () => {
    await upload().expect(201);

    expect(capturedUploadContext?.merchantId).toBe(MERCHANT_ID);
    expect(capturedUploadContext?.merchantId).not.toBe(ADMIN_USER_ID);
  });
});
