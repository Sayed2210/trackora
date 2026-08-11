import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Server } from 'node:http';
import request from 'supertest';
import { ShipmentsController } from '../controllers/shipments.controller';
import { ShipmentsService } from '../services/shipments.service';
import { BulkUploadService } from '../services/bulk-upload.service';
import { ShipmentStatus, ShipmentType } from '../entities/shipment.entity';
import { UserRole } from '@modules/users/entities/user.entity';
import { PrismaService } from '@core/prisma/prisma.service';

const mockShipmentsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllCursor: jest.fn(),
  findById: jest.fn(),
  findPublicTracking: jest.fn(),
  getTimeline: jest.fn(),
  updateStatus: jest.fn(),
};

type MockBulkUploadResult = {
  totalRows: 1;
  successCount: 1;
  failedCount: 0;
  errors: Array<{ rowIndex: number; message: string }>;
};

const mockBulkUploadService = {
  processFile:
    jest.fn<
      (
        buffer: Buffer,
        tenantId: string,
        actorUserId: string,
        actorRole: UserRole,
        requestedMerchantId?: string,
      ) => Promise<MockBulkUploadResult>
    >(),
};

const AUTH_USER_ID = 'user-account-id';
const mockPrisma = {};

const mockAuthGuard = {
  canActivate: jest.fn((context: ExecutionContext) => {
    const authenticatedRequest = context.switchToHttp().getRequest<{
      user: {
        userId: string;
        role: UserRole;
        tenantId: string;
      };
    }>();
    authenticatedRequest.user = {
      userId: AUTH_USER_ID,
      role: UserRole.MERCHANT,
      tenantId: 'tenant-1',
    };
    return true;
  }),
};

const TEST_UUID = '123e4567-e89b-12d3-a456-426614174002';

const mockShipment = {
  id: TEST_UUID,
  trackingNumber: 'TRK-240502-1234',
  merchantId: 'merchant-1',
  status: ShipmentStatus.PENDING,
  type: ShipmentType.COD,
  customerName: 'Ahmed',
  customerPhone: '01012345678',
  addressText: 'Cairo',
  codAmount: 100,
  productDescription: 'Shoes',
  createdAt: new Date().toISOString(),
};

describe('ShipmentsController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ShipmentsController],
      providers: [
        { provide: ShipmentsService, useValue: mockShipmentsService },
        { provide: BulkUploadService, useValue: mockBulkUploadService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'APP_GUARD', useValue: mockAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /shipments', () => {
    it('should create a shipment', async () => {
      mockShipmentsService.create.mockResolvedValue(mockShipment);

      const dto = {
        customerName: 'Ahmed',
        customerPhone: '01012345678',
        address: { city: 'Cairo' },
        addressText: 'Cairo',
        type: ShipmentType.COD,
        codAmount: 100,
        productDescription: 'Shoes',
      };

      const res = await request(httpServer)
        .post('/shipments')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(mockShipment);
      expect(mockShipmentsService.create).toHaveBeenCalledWith(
        expect.objectContaining(dto),
        'tenant-1',
        AUTH_USER_ID,
        UserRole.MERCHANT,
      );
    });

    it('propagates a missing Merchant profile error from bulk upload', async () => {
      mockBulkUploadService.processFile.mockRejectedValueOnce(
        new NotFoundException('Merchant not found'),
      );

      await request(httpServer)
        .post('/shipments/bulk-upload')
        .attach('file', Buffer.from('workbook'), 'shipments.xlsx')
        .expect(404);

      expect(mockBulkUploadService.processFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        'tenant-1',
        AUTH_USER_ID,
        UserRole.MERCHANT,
        undefined,
      );
    });

    it('propagates an inactive Merchant profile error from bulk upload', async () => {
      mockBulkUploadService.processFile.mockRejectedValueOnce(
        new ForbiddenException('Merchant profile is inactive'),
      );

      await request(httpServer)
        .post('/shipments/bulk-upload')
        .attach('file', Buffer.from('workbook'), 'shipments.xlsx')
        .expect(403);

      expect(mockBulkUploadService.processFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        'tenant-1',
        AUTH_USER_ID,
        UserRole.MERCHANT,
        undefined,
      );
    });

    it('keeps the Merchant endpoint restricted to MERCHANT', () => {
      const roles = Reflect.getMetadata(
        'roles',
        ShipmentsController.prototype.bulkUpload,
      ) as UserRole[] | undefined;
      expect(roles).toEqual([UserRole.MERCHANT]);
    });
  });

  describe('GET /shipments', () => {
    it('should return paginated shipments', async () => {
      const paginated = {
        data: [mockShipment],
        total: 1,
        page: 1,
        limit: 20,
      };
      mockShipmentsService.findAll.mockResolvedValue(paginated);

      const res = await request(httpServer).get('/shipments').expect(200);

      expect(res.body).toEqual(paginated);
      expect(mockShipmentsService.findAll).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({}),
        1,
        20,
      );
    });

    it('should filter by query params', async () => {
      const paginated = {
        data: [mockShipment],
        total: 1,
        page: 2,
        limit: 10,
      };
      mockShipmentsService.findAll.mockResolvedValue(paginated);

      const res = await request(httpServer)
        .get('/shipments?status=PENDING&merchantId=merchant-1&page=2&limit=10')
        .expect(200);

      expect(res.body).toEqual(paginated);
      expect(mockShipmentsService.findAll).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          status: 'PENDING',
          merchantId: 'merchant-1',
        }),
        2,
        10,
      );
    });
  });

  describe('GET /shipments/cursor', () => {
    it('should return cursor-paginated shipments', async () => {
      const result = {
        data: [mockShipment],
        nextCursor: 'cursor-1',
        hasMore: true,
      };
      mockShipmentsService.findAllCursor.mockResolvedValue(result);

      const res = await request(httpServer)
        .get('/shipments/cursor?cursor=abc&limit=50')
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockShipmentsService.findAllCursor).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({}),
        'abc',
        50,
      );
    });
  });

  describe('GET /shipments/:id', () => {
    it('should return shipment by id', async () => {
      mockShipmentsService.findById.mockResolvedValue(mockShipment);

      const res = await request(httpServer)
        .get(`/shipments/${TEST_UUID}`)
        .expect(200);

      expect(res.body).toEqual(mockShipment);
      expect(mockShipmentsService.findById).toHaveBeenCalledWith(
        TEST_UUID,
        'tenant-1',
      );
    });
  });

  describe('GET /shipments/tracking/:trackingNumber', () => {
    it('should return shipment by tracking number', async () => {
      mockShipmentsService.findPublicTracking.mockResolvedValue(mockShipment);

      const res = await request(httpServer)
        .get('/shipments/tracking/TRK-240502-1234')
        .expect(200);

      expect(res.body).toEqual(mockShipment);
      expect(mockShipmentsService.findPublicTracking).toHaveBeenCalledWith(
        'TRK-240502-1234',
      );
    });
  });

  describe('GET /shipments/:id/timeline', () => {
    it('should return shipment timeline', async () => {
      const timeline = [
        { status: 'PENDING', createdAt: new Date().toISOString() },
      ];
      mockShipmentsService.getTimeline.mockResolvedValue(timeline);

      const res = await request(httpServer)
        .get(`/shipments/${TEST_UUID}/timeline`)
        .expect(200);

      expect(res.body).toEqual(timeline);
      expect(mockShipmentsService.getTimeline).toHaveBeenCalledWith(
        TEST_UUID,
        'tenant-1',
      );
    });
  });

  describe('PATCH /shipments/:id/status', () => {
    it('should update shipment status', async () => {
      const updated = { ...mockShipment, status: ShipmentStatus.PICKED_UP };
      mockShipmentsService.updateStatus.mockResolvedValue(updated);

      const res = await request(httpServer)
        .patch(`/shipments/${TEST_UUID}/status`)
        .send({ newStatus: ShipmentStatus.PICKED_UP })
        .expect(200);

      expect(res.body).toEqual(updated);
      expect(mockShipmentsService.updateStatus).toHaveBeenCalledWith(
        TEST_UUID,
        'tenant-1',
        expect.objectContaining({ newStatus: ShipmentStatus.PICKED_UP }),
        AUTH_USER_ID,
        UserRole.MERCHANT,
      );
    });
  });
});