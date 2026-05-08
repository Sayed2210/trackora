import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { CouriersController } from '../controllers/couriers.controller';
import { CouriersService } from '../services/couriers.service';
import { VehicleType } from '../entities/courier.entity';
import { UserRole } from '@modules/users/entities/user.entity';

const mockCouriersService = {
  create: jest.fn(),
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
  employeeId: 'EMP001',
  vehicleType: VehicleType.MOTORCYCLE,
  zoneCodes: ['CAI-01', 'CAI-02'],
  isAvailable: true,
  cashHeld: 0,
  totalDeliveries: 0,
  createdAt: new Date().toISOString(),
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
        zoneCodes: ['CAI-01'],
        vehicleType: VehicleType.MOTORCYCLE,
      };

      const res = await request(app.getHttpServer())
        .post('/couriers')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(mockCourier);
      expect(mockCouriersService.create).toHaveBeenCalledWith(
        expect.objectContaining(dto),
        'mock-user-id',
      );
    });
  });

  describe('GET /couriers/:id', () => {
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
