/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsService } from '../services/assignments.service';
import { AssignmentsRepository } from '../repositories/assignments.repository';
import { PrismaService } from '@core/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssignmentStatus,
  AssignmentType,
} from '../entities/assignment.entity';
import { ShipmentStatus } from '@modules/shipments/entities/shipment.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  $transaction: jest.fn((fn) => fn(mockPrisma)),
  courier: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  shipment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  assignment: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
};

const mockRepository = {
  findById: jest.fn(),
  countActiveByCourierId: jest.fn(),
  findWithFilters: jest.fn(),
  countWithFilters: jest.fn(),
  complete: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

describe('AssignmentsService', () => {
  let service: AssignmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AssignmentsRepository, useValue: mockRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
    jest.clearAllMocks();
  });

  describe('createManualAssignments', () => {
    const courierId = 'courier-1';
    const shipmentId = 'shipment-1';
    const dto = {
      shipmentIds: [shipmentId],
      courierId,
      type: AssignmentType.MANUAL,
    };

    it('should create assignments for valid pending shipments', async () => {
      mockPrisma.courier.findFirst.mockResolvedValue({
        id: courierId,
        isActive: true,
        isAvailable: true,
        maxDailyCapacity: 25,
        user: { name: 'Ahmed', phone: '01000000000' },
      });
      mockRepository.countActiveByCourierId.mockResolvedValue(5);
      mockPrisma.shipment.findUnique.mockResolvedValue({
        id: shipmentId,
        status: ShipmentStatus.PENDING,
      });
      mockPrisma.assignment.findFirst.mockResolvedValue(null);
      mockPrisma.assignment.create.mockResolvedValue({
        id: 'assignment-1',
        shipmentId,
        courierId,
        assignmentType: AssignmentType.MANUAL,
        status: AssignmentStatus.ACTIVE,
      });

      const result = await service.createManualAssignments(dto, 'admin-1');

      expect(result.assignments).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'assignment.created',
        expect.any(Object),
      );
    });

    it('should throw if courier not found', async () => {
      mockPrisma.courier.findFirst.mockResolvedValue(null);

      await expect(service.createManualAssignments(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if courier is unavailable', async () => {
      mockPrisma.courier.findFirst.mockResolvedValue({
        id: courierId,
        isActive: true,
        isAvailable: false,
        maxDailyCapacity: 25,
      });

      await expect(service.createManualAssignments(dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if courier at capacity', async () => {
      mockPrisma.courier.findFirst.mockResolvedValue({
        id: courierId,
        isActive: true,
        isAvailable: true,
        maxDailyCapacity: 10,
      });
      mockRepository.countActiveByCourierId.mockResolvedValue(9); // 90% of 10 = 9

      await expect(service.createManualAssignments(dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should collect errors for invalid shipments without failing all', async () => {
      mockPrisma.courier.findFirst.mockResolvedValue({
        id: courierId,
        isActive: true,
        isAvailable: true,
        maxDailyCapacity: 25,
        user: { name: 'Ahmed', phone: '01000000000' },
      });
      mockRepository.countActiveByCourierId.mockResolvedValue(0);

      const shipmentIds = ['valid-shipment', 'invalid-shipment'];
      mockPrisma.shipment.findUnique
        .mockResolvedValueOnce({
          id: 'valid-shipment',
          status: ShipmentStatus.PENDING,
        })
        .mockResolvedValueOnce({
          id: 'invalid-shipment',
          status: ShipmentStatus.OUT_FOR_DELIVERY,
        });
      mockPrisma.assignment.findFirst.mockResolvedValue(null);
      mockPrisma.assignment.create.mockResolvedValue({
        id: 'assignment-1',
        shipmentId: 'valid-shipment',
        courierId,
        assignmentType: AssignmentType.MANUAL,
        status: AssignmentStatus.ACTIVE,
      });

      const result = await service.createManualAssignments({
        ...dto,
        shipmentIds,
      });

      expect(result.assignments).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].shipmentId).toBe('invalid-shipment');
    });
  });

  describe('reassign', () => {
    it('should cancel old and create new assignment', async () => {
      const assignmentId = 'assignment-1';
      const oldCourierId = 'courier-old';
      const newCourierId = 'courier-new';

      mockRepository.findById.mockResolvedValue({
        id: assignmentId,
        status: AssignmentStatus.ACTIVE,
        shipmentId: 'shipment-1',
        courierId: oldCourierId,
      });

      mockPrisma.courier.findFirst.mockResolvedValue({
        id: newCourierId,
        isActive: true,
        isAvailable: true,
        maxDailyCapacity: 25,
      });

      mockRepository.countActiveByCourierId.mockResolvedValue(5);
      mockPrisma.assignment.update.mockResolvedValue({
        id: assignmentId,
        status: AssignmentStatus.CANCELLED,
      });
      mockPrisma.assignment.create.mockResolvedValue({
        id: 'assignment-2',
        shipmentId: 'shipment-1',
        courierId: newCourierId,
        status: AssignmentStatus.ACTIVE,
      });

      const result = await service.reassign(
        assignmentId,
        newCourierId,
        'Overloaded',
      );

      expect(result.courierId).toBe(newCourierId);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'assignment.cancelled',
        expect.any(Object),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'assignment.created',
        expect.any(Object),
      );
    });

    it('should throw if assignment not active', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'assignment-1',
        status: AssignmentStatus.COMPLETED,
      });

      await expect(
        service.reassign('assignment-1', 'courier-new'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('should cancel active assignment and clear courier from shipment', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'assignment-1',
        status: AssignmentStatus.ACTIVE,
        shipmentId: 'shipment-1',
      });
      mockPrisma.assignment.update.mockResolvedValue({
        id: 'assignment-1',
        status: AssignmentStatus.CANCELLED,
      });

      const result = await service.cancel('assignment-1', 'Customer postponed');

      expect(result.status).toBe(AssignmentStatus.CANCELLED);
      expect(mockPrisma.shipment.update).toHaveBeenCalledWith({
        where: { id: 'shipment-1' },
        data: { assignedCourierId: null },
      });
    });

    it('should throw if assignment not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.cancel('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeAssignment', () => {
    it('should complete active assignment', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'assignment-1',
        status: AssignmentStatus.ACTIVE,
      });
      mockRepository.complete.mockResolvedValue({
        id: 'assignment-1',
        status: AssignmentStatus.COMPLETED,
      });

      const result = await service.completeAssignment('assignment-1');

      expect(result.status).toBe(AssignmentStatus.COMPLETED);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'assignment.completed',
        expect.any(Object),
      );
    });
  });
});
