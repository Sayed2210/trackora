import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { CouriersService } from '../services/couriers.service';
import { CouriersRepository } from '../repositories/couriers.repository';
import { VehicleType } from '../entities/courier.entity';

const mockCourier: any = {
  id: 'courier-1',
  userId: 'user-1',
  employeeId: 'EMP001',
  vehicleType: VehicleType.MOTORCYCLE,
  licensePlate: 'ABC123',
  zoneCodes: ['Cairo-1', 'Giza-2'],
  maxDailyCapacity: 25,
  currentPerformanceScore: 50,
  cashHeld: 0,
  cashHeldLimit: 5000,
  documents: null,
  isActive: true,
  isAvailable: true,
  avgDeliveryTimeMinutes: null,
  totalDelivered: 0,
  totalFailed: 0,
  totalReturned: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCourierWithUser: any = {
  ...mockCourier,
  maxDailyCapacity: 30,
  zoneCodes: ['Cairo-1'],
  cashHeld: new Prisma.Decimal(0),
  cashHeldLimit: new Prisma.Decimal(5000),
  user: {
    id: 'user-1',
    name: 'Ahmed Hassan',
    phone: '01012345678',
    email: 'ahmed@trackora.test',
    role: UserRole.COURIER,
  },
};

const createCourierDto = {
  name: 'Ahmed Hassan',
  phone: '01012345678',
  email: 'ahmed@trackora.test',
  employeeId: 'EMP001',
  vehicleType: VehicleType.MOTORCYCLE,
  licensePlate: 'ABC123',
  zoneCodes: ['Cairo-1'],
  maxDailyCapacity: 30,
  isActive: true,
  isAvailable: true,
};

describe('CouriersService', () => {
  let service: CouriersService;
  let repository: CouriersRepository;
  let prisma: {
    $transaction: jest.Mock;
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    zone: {
      findMany: jest.Mock;
    };
    courier: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      zone: {
        findMany: jest.fn().mockResolvedValue([{ code: 'Cairo-1' }]),
      },
      courier: {
        create: jest.fn().mockResolvedValue(mockCourierWithUser),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouriersService,
        {
          provide: CouriersRepository,
          useValue: {
            findByUserId: jest.fn(),
            findById: jest.fn(),
            create: jest.fn().mockResolvedValue(mockCourier),
            update: jest.fn().mockResolvedValue(mockCourier),
            softDelete: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CouriersService>(CouriersService);
    repository = module.get<CouriersRepository>(CouriersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create courier with linked COURIER user', async () => {
      const result = await service.create(createCourierDto);

      expect(result).toEqual(
        expect.objectContaining({
          id: mockCourier.id,
          userId: 'user-1',
          name: 'Ahmed Hassan',
          phone: '01012345678',
          email: 'ahmed@trackora.test',
          zoneCodes: ['Cairo-1'],
          maxDailyCapacity: 30,
          user: expect.objectContaining({
            id: 'user-1',
            role: UserRole.COURIER,
          }),
        }),
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Ahmed Hassan',
          phone: '01012345678',
          email: 'ahmed@trackora.test',
          role: UserRole.COURIER,
          isActive: true,
        }),
        select: { id: true },
      });
      expect(prisma.courier.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          employeeId: 'EMP001',
          vehicleType: VehicleType.MOTORCYCLE,
          licensePlate: 'ABC123',
          zoneCodes: ['Cairo-1'],
          maxDailyCapacity: 30,
          isActive: true,
          isAvailable: true,
        }),
        include: expect.any(Object),
      });
    });

    it('should reject duplicate phone', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-user' });

      await expect(service.create(createCourierDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.courier.create).not.toHaveBeenCalled();
    });

    it('should reject invalid zoneCode', async () => {
      prisma.zone.findMany.mockResolvedValueOnce([]);

      try {
        await service.create(createCourierDto);
        fail('Expected invalid zoneCode to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual(
          expect.objectContaining({
            field: 'zoneCodes',
            invalidZoneCodes: ['Cairo-1'],
          }),
        );
      }
    });

    it('should create User role as COURIER', async () => {
      await service.create(createCourierDto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: UserRole.COURIER }),
        }),
      );
    });

    it('should link Courier to created User', async () => {
      prisma.user.create.mockResolvedValueOnce({ id: 'created-user-id' });

      await service.create(createCourierDto);

      expect(prisma.courier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'created-user-id' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return courier', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockCourier);

      const result = await service.findById('courier-1');
      expect(result).toEqual(mockCourier);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(null);

      await expect(service.findById('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateZones', () => {
    it('should update zone codes', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockCourier);
      jest.spyOn(repository, 'update').mockResolvedValueOnce({
        ...mockCourier,
        zoneCodes: ['Alexandria-1'],
      });

      const result = await service.updateZones('courier-1', ['Alexandria-1']);

      expect(result.zoneCodes).toEqual(['Alexandria-1']);
      expect(repository.update).toHaveBeenCalledWith('courier-1', {
        zoneCodes: ['Alexandria-1'],
      });
    });
  });

  describe('updateAvailability', () => {
    it('should update availability', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockCourier);
      jest.spyOn(repository, 'update').mockResolvedValueOnce({
        ...mockCourier,
        isAvailable: false,
      });

      const result = await service.updateAvailability('courier-1', false);

      expect(result.isAvailable).toBe(false);
      expect(repository.update).toHaveBeenCalledWith('courier-1', {
        isAvailable: false,
      });
    });
  });

  describe('remove', () => {
    it('should soft delete courier', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockCourier);

      await service.remove('courier-1');
      expect(repository.softDelete).toHaveBeenCalledWith('courier-1');
    });
  });
});
