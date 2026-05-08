import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ShipmentsController } from '../controllers/shipments.controller';
import { ShipmentsService } from '../services/shipments.service';
import { BulkUploadService } from '../services/bulk-upload.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ShipmentStatus, ShipmentType } from '../entities/shipment.entity';

const mockShipmentsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllCursor: jest.fn(),
  findById: jest.fn(),
  findByTrackingNumber: jest.fn(),
  getTimeline: jest.fn(),
  updateStatus: jest.fn(),
};

const mockBulkUploadService = {
  processFile: jest.fn(),
};

const mockGuard = { canActivate: jest.fn(() => true) };

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

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ShipmentsController],
      providers: [
        { provide: ShipmentsService, useValue: mockShipmentsService },
        { provide: BulkUploadService, useValue: mockBulkUploadService },
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

      const res = await request(app.getHttpServer())
        .post('/shipments')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(mockShipment);
      expect(mockShipmentsService.create).toHaveBeenCalledWith(
        expect.objectContaining(dto),
        'temp-merchant-id',
      );
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

      const res = await request(app.getHttpServer())
        .get('/shipments')
        .expect(200);

      expect(res.body).toEqual(paginated);
      expect(mockShipmentsService.findAll).toHaveBeenCalledWith(
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

      const res = await request(app.getHttpServer())
        .get('/shipments?status=PENDING&merchantId=merchant-1&page=2&limit=10')
        .expect(200);

      expect(res.body).toEqual(paginated);
      expect(mockShipmentsService.findAll).toHaveBeenCalledWith(
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

      const res = await request(app.getHttpServer())
        .get('/shipments/cursor?cursor=abc&limit=50')
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockShipmentsService.findAllCursor).toHaveBeenCalledWith(
        expect.objectContaining({}),
        'abc',
        50,
      );
    });
  });

  describe('GET /shipments/:id', () => {
    it('should return shipment by id', async () => {
      mockShipmentsService.findById.mockResolvedValue(mockShipment);

      const res = await request(app.getHttpServer())
        .get(`/shipments/${TEST_UUID}`)
        .expect(200);

      expect(res.body).toEqual(mockShipment);
      expect(mockShipmentsService.findById).toHaveBeenCalledWith(TEST_UUID);
    });
  });

  describe('GET /shipments/tracking/:trackingNumber', () => {
    it('should return shipment by tracking number', async () => {
      mockShipmentsService.findByTrackingNumber.mockResolvedValue(mockShipment);

      const res = await request(app.getHttpServer())
        .get('/shipments/tracking/TRK-240502-1234')
        .expect(200);

      expect(res.body).toEqual(mockShipment);
      expect(mockShipmentsService.findByTrackingNumber).toHaveBeenCalledWith(
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

      const res = await request(app.getHttpServer())
        .get(`/shipments/${TEST_UUID}/timeline`)
        .expect(200);

      expect(res.body).toEqual(timeline);
      expect(mockShipmentsService.getTimeline).toHaveBeenCalledWith(TEST_UUID);
    });
  });

  describe('PATCH /shipments/:id/status', () => {
    it('should update shipment status', async () => {
      const updated = { ...mockShipment, status: ShipmentStatus.PICKED_UP };
      mockShipmentsService.updateStatus.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/shipments/${TEST_UUID}/status`)
        .send({ newStatus: ShipmentStatus.PICKED_UP })
        .expect(200);

      expect(res.body).toEqual(updated);
      expect(mockShipmentsService.updateStatus).toHaveBeenCalledWith(
        TEST_UUID,
        expect.objectContaining({ newStatus: ShipmentStatus.PICKED_UP }),
      );
    });
  });
});
