/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { CourierAppService } from '../services/courier-app.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { ShipmentsService } from '@modules/shipments/services/shipments.service';
import { AssignmentsService } from '@modules/assignments/services/assignments.service';
import { ShipmentStatus } from '@modules/shipments/entities/shipment.entity';
import { SyncAction } from '../dtos/sync-updates.dto';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

const mockPrisma = {
  courier: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  shipment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  assignment: {
    findFirst: jest.fn(),
  },
  courierCashDeposit: {
    create: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
};

const mockShipmentsService = {
  updateStatus: jest.fn(),
};

const mockAssignmentsService = {
  completeAssignment: jest.fn(),
};

describe('CourierAppService', () => {
  let service: CourierAppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourierAppService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ShipmentsService, useValue: mockShipmentsService },
        { provide: AssignmentsService, useValue: mockAssignmentsService },
      ],
    }).compile();

    service = module.get<CourierAppService>(CourierAppService);
    jest.clearAllMocks();
  });

  describe('getTasks', () => {
    it('should return masked tasks for courier', async () => {
      mockPrisma.courier.findUnique.mockResolvedValue({ id: 'courier-1' });
      mockPrisma.shipment.findMany.mockResolvedValue([
        {
          id: 'ship-1',
          trackingNumber: 'TRK-001',
          customerName: 'Ahmed',
          customerPhone: '01001234567',
          addressText: 'Maadi',
          codAmount: 500,
          status: ShipmentStatus.OUT_FOR_DELIVERY,
          preferredDeliveryDate: new Date(),
        },
      ]);

      const result = await service.getTasks('courier-1');

      expect(result).toHaveLength(1);
      expect(result[0].customerPhoneMasked).toBe('0100*****567');
      expect(result[0].codAmount).toBe(500);
    });

    it('should throw if courier not found', async () => {
      mockPrisma.courier.findUnique.mockResolvedValue(null);
      await expect(service.getTasks('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTaskStatus', () => {
    it('should update status and complete assignment on delivery', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValue({
        id: 'ship-1',
        assignedCourierId: 'courier-1',
      });
      mockShipmentsService.updateStatus.mockResolvedValue({
        id: 'ship-1',
        status: ShipmentStatus.DELIVERED,
      });
      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: 'assign-1',
      });
      mockAssignmentsService.completeAssignment.mockResolvedValue({
        id: 'assign-1',
      });

      const result = await service.updateTaskStatus('courier-1', 'ship-1', {
        status: ShipmentStatus.DELIVERED,
        collectedCash: 500,
        otp: '1234',
      });

      expect(result.status).toBe(ShipmentStatus.DELIVERED);
      expect(mockAssignmentsService.completeAssignment).toHaveBeenCalledWith(
        'assign-1',
      );
    });

    it('should throw if shipment not assigned to courier', async () => {
      mockPrisma.shipment.findFirst.mockResolvedValue(null);
      await expect(
        service.updateTaskStatus('courier-1', 'ship-1', {
          status: ShipmentStatus.DELIVERED,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('logDeposit', () => {
    it('should create deposit and decrement cashHeld', async () => {
      mockPrisma.courier.findUnique.mockResolvedValue({
        id: 'courier-1',
        cashHeld: 3000,
      });
      mockPrisma.courierCashDeposit.create.mockResolvedValue({
        id: 'deposit-1',
        amount: 1500,
      });

      const result = await service.logDeposit('courier-1', {
        amount: 1500,
        depositedTo: 'admin-1',
        notes: 'Daily',
      });

      expect(result.amount).toBe(1500);
      expect(mockPrisma.courier.update).toHaveBeenCalledWith({
        where: { id: 'courier-1' },
        data: { cashHeld: { decrement: 1500 } },
      });
    });

    it('should throw if deposit exceeds cashHeld', async () => {
      mockPrisma.courier.findUnique.mockResolvedValue({
        id: 'courier-1',
        cashHeld: 1000,
      });

      await expect(
        service.logDeposit('courier-1', {
          amount: 1500,
          depositedTo: 'admin-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPerformance', () => {
    it('should return performance metrics', async () => {
      mockPrisma.courier.findUnique.mockResolvedValue({
        id: 'courier-1',
        currentPerformanceScore: 87,
        totalDelivered: 245,
        totalFailed: 12,
        totalReturned: 5,
        avgDeliveryTimeMinutes: 28,
        cashHeld: 3200,
        user: { name: 'Ahmed' },
      });

      const result = await service.getPerformance('courier-1');

      expect(result.score).toBe(87);
      expect(result.successRate).toBeCloseTo(93.5, 1);
      expect(result.cashHeld).toBe(3200);
    });

    it('should handle zero deliveries', async () => {
      mockPrisma.courier.findUnique.mockResolvedValue({
        id: 'courier-1',
        currentPerformanceScore: 50,
        totalDelivered: 0,
        totalFailed: 0,
        totalReturned: 0,
        avgDeliveryTimeMinutes: null,
        cashHeld: 0,
        user: { name: 'New Courier' },
      });

      const result = await service.getPerformance('courier-1');

      expect(result.successRate).toBe(0);
    });
  });

  describe('syncUpdates', () => {
    it('should process status updates and reject conflicts', async () => {
      mockPrisma.shipment.findFirst
        .mockResolvedValueOnce({
          id: 'ship-1',
          status: ShipmentStatus.OUT_FOR_DELIVERY,
          assignedCourierId: 'courier-1',
        })
        .mockResolvedValueOnce({
          id: 'ship-2',
          status: ShipmentStatus.DELIVERED,
          assignedCourierId: 'courier-1',
        });

      mockShipmentsService.updateStatus.mockResolvedValue({ id: 'ship-1' });

      const result = await service.syncUpdates('courier-1', {
        updates: [
          {
            id: 'offline-1',
            shipmentId: 'ship-1',
            action: SyncAction.STATUS_UPDATE,
            payload: { status: 'DELIVERED', collectedCash: 500 },
            timestamp: new Date().toISOString(),
          },
          {
            id: 'offline-2',
            shipmentId: 'ship-2',
            action: SyncAction.STATUS_UPDATE,
            payload: { status: 'FAILED' },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      expect(result.processed).toBe(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].shipmentId).toBe('ship-2');
    });
  });
});
