/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentsService } from '../services/shipments.service';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { ShipmentStatusLogsRepository } from '../repositories/shipment-status-logs.repository';
import { StateMachineService } from '../services/state-machine.service';
import { TrackingNumberService } from '../services/tracking-number.service';
import { FraudDetectionService } from '../services/fraud-detection.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { RedisService } from '@infrastructure/cache/redis.service';
import { ShipmentStatus, ShipmentType } from '../entities/shipment.entity';
import { UpdateShipmentStatusDto } from '../dtos/update-shipment-status.dto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

const mockShipment = {
  id: 'ship-1',
  status: ShipmentStatus.OUT_FOR_DELIVERY,
  type: ShipmentType.COD,
  customerOtp: '1234',
  assignedCourierId: 'courier-1',
};

describe('ShipmentsService — OTP Validation (integration) TASK-111', () => {
  let service: ShipmentsService;
  let redis: RedisService;

  const mockShipmentsRepository = {
    findById: jest.fn(),
    update: jest
      .fn()
      .mockImplementation((id, data) =>
        Promise.resolve({ ...mockShipment, ...data }),
      ),
  };

  const mockStatusLogsRepository = {
    create: jest.fn().mockResolvedValue({}),
  };

  const mockPrisma = {
    $transaction: jest.fn((fn) =>
      fn({
        shipment: {
          update: jest
            .fn()
            .mockImplementation(({ data }: { data: any }) =>
              Promise.resolve({ ...mockShipment, ...data }),
            ),
        },
        courier: { update: jest.fn().mockResolvedValue({}) },
      }),
    ),
  };

  const mockRedis = {
    get: jest.fn().mockResolvedValue('0'),
    increment: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        StateMachineService,
        TrackingNumberService,
        FraudDetectionService,
        { provide: ShipmentsRepository, useValue: mockShipmentsRepository },
        {
          provide: ShipmentStatusLogsRepository,
          useValue: mockStatusLogsRepository,
        },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
    redis = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  it('should verify correct OTP and allow delivery', async () => {
    mockShipmentsRepository.findById.mockResolvedValue(mockShipment);

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.DELIVERED,
      otp: '1234',
      collectedCash: 500,
    };

    const result = await service.updateStatus('ship-1', dto);

    expect(result.status).toBe(ShipmentStatus.DELIVERED);
    expect(redis.increment).toHaveBeenCalled();
  });

  it('should reject wrong OTP with remaining attempts', async () => {
    mockShipmentsRepository.findById.mockResolvedValue(mockShipment);
    mockRedis.get.mockResolvedValue('1');

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.DELIVERED,
      otp: '9999',
      collectedCash: 500,
    };

    await expect(service.updateStatus('ship-1', dto)).rejects.toThrow(
      BadRequestException,
    );

    await expect(service.updateStatus('ship-1', dto)).rejects.toThrow(
      /1 attempts remaining/,
    );
  });

  it('should lock OTP after 3 failed attempts', async () => {
    mockShipmentsRepository.findById.mockResolvedValue(mockShipment);
    mockRedis.get.mockResolvedValue('3');

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.DELIVERED,
      otp: '9999',
      collectedCash: 500,
    };

    await expect(service.updateStatus('ship-1', dto)).rejects.toThrow(
      ForbiddenException,
    );

    await expect(service.updateStatus('ship-1', dto)).rejects.toThrow(
      /Maximum OTP attempts exceeded/,
    );
  });

  it('should reject delivery without OTP', async () => {
    mockShipmentsRepository.findById.mockResolvedValue(mockShipment);

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.DELIVERED,
      collectedCash: 500,
    };

    await expect(service.updateStatus('ship-1', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should generate OTP when transitioning to OUT_FOR_DELIVERY for COD', async () => {
    mockShipmentsRepository.findById.mockResolvedValue({
      ...mockShipment,
      status: ShipmentStatus.PICKED_UP,
      customerOtp: null,
    });

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.OUT_FOR_DELIVERY,
    };

    await service.updateStatus('ship-1', dto);

    const updateCall = mockPrisma.$transaction.mock.calls[0][0];
    const tx = {
      shipment: { update: jest.fn() },
      courier: { update: jest.fn() },
    };
    await updateCall(tx);

    expect(tx.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerOtp: expect.stringMatching(/^\d{4}$/),
        }),
      }),
    );
  });
});
