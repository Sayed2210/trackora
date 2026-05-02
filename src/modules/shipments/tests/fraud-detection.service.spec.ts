import { Test, TestingModule } from '@nestjs/testing';
import { FraudDetectionService } from '../services/fraud-detection.service';

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FraudDetectionService],
    }).compile();

    service = module.get<FraudDetectionService>(FraudDetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateRiskScore', () => {
    it('should return low score for valid shipment', () => {
      const shipment = {
        customerPhone: '01012345678',
        addressText: 'Cairo, near Tahrir Square, Building 5',
        codAmount: 100,
        customerName: 'Ahmed Mohamed',
      };
      const score = service.calculateRiskScore(shipment);
      expect(score).toBeLessThan(50);
    });

    it('should return high score for invalid phone', () => {
      const shipment = {
        customerPhone: '12345',
        addressText: 'Cairo, near Tahrir Square, Building 5',
        codAmount: 100,
        customerName: 'Ahmed Mohamed',
      };
      const score = service.calculateRiskScore(shipment);
      expect(score).toBeGreaterThanOrEqual(30);
    });

    it('should return high score for high COD amount', () => {
      const shipment = {
        customerPhone: '01012345678',
        addressText: 'Cairo, near Tahrir Square, Building 5',
        codAmount: 10000,
        customerName: 'Ahmed Mohamed',
      };
      const score = service.calculateRiskScore(shipment);
      expect(score).toBeGreaterThanOrEqual(25);
    });

    it('should return high score for short customer name', () => {
      const shipment = {
        customerPhone: '01012345678',
        addressText: 'Cairo, near Tahrir Square, Building 5',
        codAmount: 100,
        customerName: 'A',
      };
      const score = service.calculateRiskScore(shipment);
      expect(score).toBeGreaterThanOrEqual(15);
    });

    it('should return high score for missing landmark', () => {
      const shipment = {
        customerPhone: '01012345678',
        addressText: 'Cairo',
        codAmount: 100,
        customerName: 'Ahmed Mohamed',
      };
      const score = service.calculateRiskScore(shipment);
      expect(score).toBeGreaterThanOrEqual(20);
    });
  });

  describe('isHighRisk', () => {
    it('should return true for score > 50', () => {
      expect(service.isHighRisk(51)).toBe(true);
    });

    it('should return false for score <= 50', () => {
      expect(service.isHighRisk(50)).toBe(false);
      expect(service.isHighRisk(30)).toBe(false);
    });
  });
});
