/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { CourierAppController } from '../controllers/courier-app.controller';
import { CourierAppService } from '../services/courier-app.service';
import { ShipmentStatus } from '@modules/shipments/entities/shipment.entity';
import { UpdateTaskStatusDto } from '../dtos/update-task-status.dto';
import { CourierDepositDto } from '../dtos/courier-deposit.dto';
import { SyncUpdatesDto } from '../dtos/sync-updates.dto';
import { UserRole } from '@modules/users/entities/user.entity';

const mockAuthGuard = {
  canActivate: jest.fn((context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    request.user = { userId: 'mock-courier-id', role: UserRole.COURIER };
    return true;
  }),
};

describe('CourierAppController (integration)', () => {
  let controller: CourierAppController;
  let service: CourierAppService;

  const mockReq = {
    user: { userId: 'mock-courier-id', role: UserRole.COURIER },
  } as any;

  const mockTask = {
    shipmentId: 'ship-1',
    trackingNumber: 'TRK-240502-1234',
    customerName: 'Ahmed',
    customerPhoneMasked: '0101*****678',
    addressText: 'Cairo',
    codAmount: 500,
    status: ShipmentStatus.OUT_FOR_DELIVERY,
    orderInRoute: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourierAppController],
      providers: [
        {
          provide: CourierAppService,
          useValue: {
            getTasks: jest.fn(),
            getTaskById: jest.fn(),
            updateTaskStatus: jest.fn(),
            logDeposit: jest.fn(),
            getPerformance: jest.fn(),
            syncUpdates: jest.fn(),
          },
        },
        { provide: 'APP_GUARD', useValue: mockAuthGuard },
      ],
    }).compile();

    controller = module.get<CourierAppController>(CourierAppController);
    service = module.get<CourierAppService>(CourierAppService);
  });

  describe('TASK-107: Courier Task Endpoints', () => {
    it('should call getTasks with courier id from req.user', async () => {
      jest.spyOn(service, 'getTasks').mockResolvedValue([mockTask]);

      const result = await controller.getTasks(mockReq);

      expect(service.getTasks).toHaveBeenCalledWith('mock-courier-id');
      expect(result).toHaveLength(1);
      expect(result[0].trackingNumber).toBe('TRK-240502-1234');
    });

    it('should call updateTaskStatus with correct params', async () => {
      const dto: UpdateTaskStatusDto = {
        status: ShipmentStatus.DELIVERED,
        otp: '1234',
        collectedCash: 500,
        notes: 'Customer happy',
      };

      jest.spyOn(service, 'updateTaskStatus').mockResolvedValue({
        id: 'ship-1',
        status: ShipmentStatus.DELIVERED,
      } as any);

      const result = await controller.updateTaskStatus('ship-1', dto, mockReq);

      expect(service.updateTaskStatus).toHaveBeenCalledWith(
        'mock-courier-id',
        'ship-1',
        dto,
      );
      expect(result.status).toBe(ShipmentStatus.DELIVERED);
    });
  });

  describe('TASK-100: Single Task Detail', () => {
    it('should call getTaskById with correct params', async () => {
      jest.spyOn(service, 'getTaskById').mockResolvedValue(mockTask);

      const result = await controller.getTaskById('ship-1', mockReq);

      expect(service.getTaskById).toHaveBeenCalledWith(
        'mock-courier-id',
        'ship-1',
      );
      expect(result.shipmentId).toBe('ship-1');
    });
  });

  describe('TASK-109: Cash Deposit', () => {
    it('should call logDeposit with correct params', async () => {
      const dto: CourierDepositDto = {
        amount: 1500,
        depositedTo: 'admin-1',
        notes: 'Daily collection',
      };

      jest.spyOn(service, 'logDeposit').mockResolvedValue({
        id: 'deposit-1',
        amount: 1500,
      } as any);

      const result = await controller.logDeposit(dto, mockReq);

      expect(service.logDeposit).toHaveBeenCalledWith('mock-courier-id', dto);
      expect(result.amount).toBe(1500);
    });
  });

  describe('TASK-108: Offline Sync', () => {
    it('should call syncUpdates with correct params', async () => {
      const dto: SyncUpdatesDto = {
        updates: [
          {
            id: 'offline-1',
            shipmentId: 'ship-1',
            action: 'STATUS_UPDATE' as any,
            payload: { status: 'DELIVERED' },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      jest.spyOn(service, 'syncUpdates').mockResolvedValue({
        processed: 1,
        failed: 0,
        conflicts: [],
      });

      const result = await controller.syncUpdates(dto, mockReq);

      expect(service.syncUpdates).toHaveBeenCalledWith('mock-courier-id', dto);
      expect(result.processed).toBe(1);
    });
  });

  describe('TASK-107: Performance', () => {
    it('should call getPerformance with courier id from req.user', async () => {
      jest.spyOn(service, 'getPerformance').mockResolvedValue({
        score: 87,
        totalDelivered: 245,
        totalFailed: 12,
        successRate: 93.5,
        cashHeld: 3000,
        rank: null,
        weeklyTrend: [],
      } as any);

      const result = await controller.getPerformance(mockReq);

      expect(service.getPerformance).toHaveBeenCalledWith('mock-courier-id');
      expect(result.score).toBe(87);
      expect(result.successRate).toBe(93.5);
    });
  });
});
