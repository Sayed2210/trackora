import { Test, TestingModule } from '@nestjs/testing';
import { TrackingNumberService } from '../services/tracking-number.service';
import { ShipmentsRepository } from '../repositories/shipments.repository';

describe('TrackingNumberService', () => {
  let service: TrackingNumberService;
  let repository: ShipmentsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingNumberService,
        {
          provide: ShipmentsRepository,
          useValue: {
            findByTrackingNumber: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<TrackingNumberService>(TrackingNumberService);
    repository = module.get<ShipmentsRepository>(ShipmentsRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should generate tracking number in correct format', () => {
      const tn = service.generate();
      expect(tn).toMatch(/^TRK-\d{6}-\d{4}$/);
    });

    it('should generate unique tracking numbers', () => {
      const tn1 = service.generate();
      const tn2 = service.generate();
      expect(tn1).not.toBe(tn2);
    });
  });

  describe('validateFormat', () => {
    it('should return true for valid format', () => {
      expect(service.validateFormat('TRK-240502-1234')).toBe(true);
    });

    it('should return false for invalid format', () => {
      expect(service.validateFormat('INVALID')).toBe(false);
      expect(service.validateFormat('TRK-12345-1234')).toBe(false);
      expect(service.validateFormat('TRK-240502-123')).toBe(false);
    });
  });

  describe('generateUnique', () => {
    it('should return tracking number when no collision', async () => {
      const tn = await service.generateUnique();
      expect(tn).toMatch(/^TRK-\d{6}-\d{4}$/);
      expect(repository.findByTrackingNumber).toHaveBeenCalledWith(tn);
    });

    it('should retry on collision', async () => {
      let callCount = 0;
      jest.spyOn(repository, 'findByTrackingNumber').mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? ({ id: '1' } as any) : null);
      });

      const tn = await service.generateUnique();
      expect(tn).toMatch(/^TRK-\d{6}-\d{4}$/);
      expect(repository.findByTrackingNumber).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      jest
        .spyOn(repository, 'findByTrackingNumber')
        .mockResolvedValue({ id: '1' } as any);

      await expect(service.generateUnique()).rejects.toThrow(
        'Unable to generate unique tracking number after max attempts',
      );
    });
  });
});
