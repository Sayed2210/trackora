import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { CouriersController } from '../controllers/couriers.controller';
import { CouriersService } from '../services/couriers.service';
import { VehicleType } from '../entities/courier.entity';
import { UserRole } from '@modules/users/entities/user.entity';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const mockCouriersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  updateZones: jest.fn(),
  updateAvailability: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn((context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    request.user = { userId: 'mock-user-id', role: UserRole.SUPER_ADMIN };
    return true;
  }),
};

const TEST_UUID = '123e4567-e89b-12d3-a456-426614174000';

const mockCourier = {
  id: TEST_UUID,
  userId: 'user-1',
  user: {
    id: 'user-1',
    name: 'Ahmed Hassan',
    phone: '01012345678',
    email: 'ahmed@trackora.test',
    role: UserRole.COURIER,
  },
  name: 'Ahmed Hassan',
  phone: '01012345678',
  email: 'ahmed@trackora.test',
  employeeId: 'EMP001',
  vehicleType: VehicleType.MOTORCYCLE,
  licensePlate: 'ABC123',
  zoneCodes: ['CAI-01', 'CAI-02'],
  maxDailyCapacity: 25,
  isActive: true,
  isAvailable: true,
  cashHeld: 0,
  cashHeldLimit: 5000,
  currentPerformanceScore: 50,
  avgDeliveryTimeMinutes: null,
  totalDelivered: 0,
  totalFailed: 0,
  totalReturned: 0,
  totalDeliveries: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('CouriersController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CouriersController],
      providers: [
        { provide: CouriersService, useValue: mockCouriersService },
        { provide: 'APP_GUARD', useValue: mockAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /couriers', () => {
    it('should create a courier', async () => {
      mockCouriersService.create.mockResolvedValue(mockCourier);

      const dto = {
        name: 'Ahmed Hassan',
        phone: '01012345678',
        email: 'ahmed@trackora.test',
        employeeId: 'EMP001',
        vehicleType: VehicleType.MOTORCYCLE,
        licensePlate: 'ABC123',
        zoneCodes: ['CAI-01'],
        maxDailyCapacity: 25,
        isActive: true,
        isAvailable: true,
      };

      const res = await request(app.getHttpServer())
        .post('/couriers')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(mockCourier);
      expect(mockCouriersService.create).toHaveBeenCalledWith(
        expect.objectContaining(dto),
      );
    });

    it('should reject missing zoneCodes', async () => {
      await request(app.getHttpServer())
        .post('/couriers')
        .send({
          name: 'Ahmed Hassan',
          phone: '01012345678',
          vehicleType: VehicleType.MOTORCYCLE,
        })
        .expect(400);

      expect(mockCouriersService.create).not.toHaveBeenCalled();
    });

    it('should document full admin onboarding request and response in Swagger', () => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Test API').build(),
      );
      const operation = document.paths['/couriers'].post;
      const schemaRef =
        operation.requestBody?.content?.['application/json']?.schema?.$ref;
      const schemaName = schemaRef?.split('/').pop();
      const createSchema = schemaName
        ? document.components?.schemas?.[schemaName]
        : undefined;
      const responseRef =
        operation.responses?.['201']?.content?.['application/json']?.schema
          ?.$ref;

      expect(createSchema?.properties).toEqual(
        expect.objectContaining({
          name: expect.any(Object),
          phone: expect.any(Object),
          email: expect.any(Object),
          employeeId: expect.any(Object),
          vehicleType: expect.objectContaining({
            enum: expect.arrayContaining([
              VehicleType.MOTORCYCLE,
              VehicleType.CAR,
              VehicleType.VAN,
              VehicleType.BICYCLE,
            ]),
          }),
          licensePlate: expect.any(Object),
          zoneCodes: expect.objectContaining({ type: 'array' }),
          maxDailyCapacity: expect.any(Object),
          isActive: expect.any(Object),
          isAvailable: expect.any(Object),
        }),
      );
      expect(createSchema?.required).toEqual(
        expect.arrayContaining(['name', 'phone', 'vehicleType', 'zoneCodes']),
      );
      expect(responseRef).toContain('CourierResponseDto');
    });
  });

  describe('GET /couriers/:id', () => {
    it('should return paginated couriers', async () => {
      const result = {
        data: [mockCourier],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockCouriersService.findAll.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .get(
          '/couriers?search=ahmed&isActive=true&isAvailable=false&zoneCode=CAI-01&page=1&limit=20',
        )
        .expect(200);

      expect(res.body).toEqual(JSON.parse(JSON.stringify(result)));
      expect(mockCouriersService.findAll).toHaveBeenCalledWith({
        search: 'ahmed',
        isActive: true,
        isAvailable: false,
        zoneCode: 'CAI-01',
        page: 1,
        limit: 20,
      });
    });

    it('should return courier by id', async () => {
      mockCouriersService.findById.mockResolvedValue(mockCourier);

      const res = await request(app.getHttpServer())
        .get(`/couriers/${TEST_UUID}`)
        .expect(200);

      expect(res.body).toEqual(mockCourier);
      expect(mockCouriersService.findById).toHaveBeenCalledWith(TEST_UUID);
    });
  });

  describe('PATCH /couriers/:id/zones', () => {
    it('should update courier zones', async () => {
      const updated = { ...mockCourier, zoneCodes: ['CAI-03'] };
      mockCouriersService.updateZones.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/couriers/${TEST_UUID}/zones`)
        .send({ zoneCodes: ['CAI-03'] })
        .expect(200);

      expect(res.body).toEqual(updated);
      expect(mockCouriersService.updateZones).toHaveBeenCalledWith(TEST_UUID, [
        'CAI-03',
      ]);
    });
  });

  describe('PATCH /couriers/:id/availability', () => {
    it('should update courier availability', async () => {
      const updated = { ...mockCourier, isAvailable: false };
      mockCouriersService.updateAvailability.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch(`/couriers/${TEST_UUID}/availability`)
        .send({ isAvailable: false })
        .expect(200);

      expect(res.body).toEqual(updated);
      expect(mockCouriersService.updateAvailability).toHaveBeenCalledWith(
        TEST_UUID,
        false,
      );
    });
  });
});
