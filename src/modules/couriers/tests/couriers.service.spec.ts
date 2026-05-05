import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
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

describe('CouriersService', () => {
  let service: CouriersService;
  let repository: CouriersRepository;

  beforeEach(async () => {
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
      ],
    }).compile();

    service = module.get<CouriersService>(CouriersService);
    repository = module.get<CouriersRepository>(CouriersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create courier', async () => {
      jest.spyOn(repository, 'findByUserId').mockResolvedValueOnce(null);

      const result = await service.create(
        { employeeId: 'EMP001', zoneCodes: ['Cairo-1'] },
        'user-1',
      );

      expect(result).toEqual(mockCourier);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'EMP001',
          zoneCodes: ['Cairo-1'],
          userId: 'user-1',
          cashHeld: 0,
          currentPerformanceScore: 50,
        }),
      );
    });

    it('should throw if courier already exists for user', async () => {
      jest.spyOn(repository, 'findByUserId').mockResolvedValueOnce(mockCourier);

      await expect(
        service.create(
          { employeeId: 'EMP001', zoneCodes: ['Cairo-1'] },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
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
