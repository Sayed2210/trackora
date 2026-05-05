import { Test, TestingModule } from '@nestjs/testing';
import { StateMachineService } from '../services/state-machine.service';
import { ShipmentStatus } from '../entities/shipment.entity';
import { ConflictException } from '@nestjs/common';

describe('StateMachineService', () => {
  let service: StateMachineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StateMachineService],
    }).compile();

    service = module.get<StateMachineService>(StateMachineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateTransition', () => {
    it('should allow PENDING -> PICKED_UP', () => {
      expect(() =>
        service.validateTransition(
          ShipmentStatus.PENDING,
          ShipmentStatus.PICKED_UP,
        ),
      ).not.toThrow();
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(() =>
        service.validateTransition(
          ShipmentStatus.PENDING,
          ShipmentStatus.CANCELLED,
        ),
      ).not.toThrow();
    });

    it('should block PENDING -> DELIVERED', () => {
      expect(() =>
        service.validateTransition(
          ShipmentStatus.PENDING,
          ShipmentStatus.DELIVERED,
        ),
      ).toThrow(ConflictException);
    });

    it('should allow OUT_FOR_DELIVERY -> DELIVERED', () => {
      expect(() =>
        service.validateTransition(
          ShipmentStatus.OUT_FOR_DELIVERY,
          ShipmentStatus.DELIVERED,
        ),
      ).not.toThrow();
    });

    it('should block DELIVERED -> anything', () => {
      expect(() =>
        service.validateTransition(
          ShipmentStatus.DELIVERED,
          ShipmentStatus.PENDING,
        ),
      ).toThrow(ConflictException);
    });

    it('should allow override when allowOverride is true', () => {
      expect(() =>
        service.validateTransition(
          ShipmentStatus.PENDING,
          ShipmentStatus.DELIVERED,
          true,
        ),
      ).not.toThrow();
    });

    it('should allow same status transition without error', () => {
      expect(() =>
        service.validateTransition(
          ShipmentStatus.PENDING,
          ShipmentStatus.PENDING,
        ),
      ).not.toThrow();
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for DELIVERED', () => {
      expect(service.isTerminalStatus(ShipmentStatus.DELIVERED)).toBe(true);
    });

    it('should return true for RETURNED', () => {
      expect(service.isTerminalStatus(ShipmentStatus.RETURNED)).toBe(true);
    });

    it('should return true for CANCELLED', () => {
      expect(service.isTerminalStatus(ShipmentStatus.CANCELLED)).toBe(true);
    });

    it('should return false for PENDING', () => {
      expect(service.isTerminalStatus(ShipmentStatus.PENDING)).toBe(false);
    });

    it('should return false for OUT_FOR_DELIVERY', () => {
      expect(service.isTerminalStatus(ShipmentStatus.OUT_FOR_DELIVERY)).toBe(
        false,
      );
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return correct transitions for PENDING', () => {
      const allowed = service.getAllowedTransitions(ShipmentStatus.PENDING);
      expect(allowed).toContain(ShipmentStatus.PICKED_UP);
      expect(allowed).toContain(ShipmentStatus.CANCELLED);
      expect(allowed).not.toContain(ShipmentStatus.DELIVERED);
    });

    it('should return empty array for terminal statuses', () => {
      expect(service.getAllowedTransitions(ShipmentStatus.DELIVERED)).toEqual(
        [],
      );
    });
  });
});
