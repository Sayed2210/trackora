import { Test, TestingModule } from '@nestjs/testing';
import { FeeCalculatorService } from '../services/fee-calculator.service';

describe('FeeCalculatorService', () => {
  let service: FeeCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeeCalculatorService],
    }).compile();

    service = module.get<FeeCalculatorService>(FeeCalculatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateNetCredit', () => {
    it('should calculate net credit correctly', () => {
      const result = service.calculateNetCredit(500, {
        commissionRate: 0.1,
        feePerShipment: 25,
      });

      expect(result.grossCod).toBe(500);
      expect(result.commission).toBe(50);
      expect(result.fee).toBe(25);
      expect(result.netCredit).toBe(425);
    });

    it('should handle zero commission and fee', () => {
      const result = service.calculateNetCredit(300, {
        commissionRate: 0,
        feePerShipment: 0,
      });

      expect(result.netCredit).toBe(300);
    });

    it('should not return negative net credit', () => {
      const result = service.calculateNetCredit(10, {
        commissionRate: 0.5,
        feePerShipment: 20,
      });

      expect(result.netCredit).toBe(0);
    });

    it('should handle negative cod amount as zero', () => {
      const result = service.calculateNetCredit(-100, {
        commissionRate: 0.1,
        feePerShipment: 25,
      });

      expect(result.grossCod).toBe(0);
      expect(result.netCredit).toBe(0);
    });
  });

  describe('calculateTieredCommission', () => {
    it('should calculate tiered commission correctly', () => {
      const tiers = [
        { min: 0, max: 100, rate: 0.1 },
        { min: 100, max: 500, rate: 0.08 },
        { min: 500, max: 1000, rate: 0.05 },
      ];

      const result = service.calculateTieredCommission(600, tiers);
      // 100 * 0.1 + 400 * 0.08 + 100 * 0.05 = 10 + 32 + 5 = 47
      expect(result).toBe(47);
    });
  });
});
