/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsController } from '../controllers/assignments.controller';
import { AssignmentsService } from '../services/assignments.service';
import {
  AssignmentStatus,
  AssignmentType,
} from '../entities/assignment.entity';
import { CreateAssignmentDto } from '../dtos/create-assignment.dto';
import { ReassignAssignmentDto } from '../dtos/reassign-assignment.dto';
import { CancelAssignmentDto } from '../dtos/cancel-assignment.dto';
import { QueryAssignmentsDto } from '../dtos/query-assignments.dto';

describe('AssignmentsController (integration)', () => {
  let controller: AssignmentsController;
  let service: AssignmentsService;

  const mockAssignment = {
    id: 'assignment-1',
    shipmentId: 'shipment-1',
    courierId: 'courier-1',
    assignmentType: AssignmentType.MANUAL,
    status: AssignmentStatus.ACTIVE,
    assignedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        {
          provide: AssignmentsService,
          useValue: {
            createManualAssignments: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            reassign: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AssignmentsController>(AssignmentsController);
    service = module.get<AssignmentsService>(AssignmentsService);
  });

  describe('TASK-097: Assignment Endpoints', () => {
    it('should call createManualAssignments with correct params', async () => {
      const dto: CreateAssignmentDto = {
        shipmentIds: ['ship-1', 'ship-2'],
        courierId: 'courier-1',
        type: AssignmentType.MANUAL,
      };

      jest.spyOn(service, 'createManualAssignments').mockResolvedValue({
        assignments: [mockAssignment as any],
        errors: [],
      });

      const result = await controller.create(dto);

      expect(service.createManualAssignments).toHaveBeenCalledWith(
        dto,
        'temp-user-id',
      );
      expect(result.assignments).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should call findAll with correct filters', async () => {
      const query: QueryAssignmentsDto = {
        courierId: 'courier-1',
        status: AssignmentStatus.ACTIVE,
        page: '1',
        limit: '20',
      };

      jest.spyOn(service, 'findAll').mockResolvedValue({
        data: [mockAssignment as any],
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          courierId: 'courier-1',
          status: AssignmentStatus.ACTIVE,
        }),
        1,
        20,
      );
      expect(result.data).toHaveLength(1);
    });

    it('should call findById with correct id', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockAssignment as any);

      const result = await controller.findById('assignment-1');

      expect(service.findById).toHaveBeenCalledWith('assignment-1');
      expect(result.id).toBe('assignment-1');
    });
  });

  describe('TASK-098: Reassignment Flow', () => {
    it('should call reassign with correct params', async () => {
      const dto: ReassignAssignmentDto = {
        newCourierId: 'courier-2',
        reason: 'Overloaded',
      };

      jest.spyOn(service, 'reassign').mockResolvedValue({
        ...mockAssignment,
        courierId: 'courier-2',
      } as any);

      const result = await controller.reassign('assignment-1', dto);

      expect(service.reassign).toHaveBeenCalledWith(
        'assignment-1',
        'courier-2',
        'Overloaded',
        'temp-user-id',
      );
      expect(result.courierId).toBe('courier-2');
    });
  });

  describe('TASK-098: Cancellation', () => {
    it('should call cancel with correct params', async () => {
      const dto: CancelAssignmentDto = { reason: 'Customer postponed' };

      jest.spyOn(service, 'cancel').mockResolvedValue({
        ...mockAssignment,
        status: AssignmentStatus.CANCELLED,
      } as any);

      const result = await controller.cancel('assignment-1', dto);

      expect(service.cancel).toHaveBeenCalledWith(
        'assignment-1',
        'Customer postponed',
      );
      expect(result.status).toBe(AssignmentStatus.CANCELLED);
    });
  });
});
