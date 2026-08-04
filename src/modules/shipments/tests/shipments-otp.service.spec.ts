/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentsService } from '../services/shipments.service';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { ShipmentStatusLogsRepository } from '../repositories/shipment-status-logs.repository';
import { StateMachineService } from '../services/state-machine.service';
import { TrackingNumberService } from '../services/tracking-number.service';
import { FraudDetectionService } from '../services/fraud-detection.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/prisma/prisma.service';
import { RedisService } from '@infrastructure/cache/redis.service';
import { ShipmentStatus, ShipmentType } from '../entities/shipment.entity';
import { UpdateShipmentStatusDto } from '../dtos/update-shipment-status.dto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$10$hashedotp'),
  compare: jest.fn().mockResolvedValue(true),
}));

const mockShipment = {
  id: 'ship-1',
  status: ShipmentStatus.OUT_FOR_DELIVERY,
  type: ShipmentType.COD,
  customerOtp: '$2a$10$hashedotp',
  assignedCourierId: 'courier-1',
  codAmount: 500,
};

describe('ShipmentsService — OTP Validation (integration) TASK-111', () => {
  let service: ShipmentsService;
  let redis: RedisService;

  const mockShipmentsRepository = {
    findByIdForTenant: jest.fn(),
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
    set: jest.fn().mockResolvedValue(undefined),
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
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
    redis = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$10$hashedotp');
    mockRedis.get.mockResolvedValue('0');
    mockRedis.increment.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue(undefined);
  });

  it('should verify correct OTP and allow delivery', async () => {
    mockShipmentsRepository.findByIdForTenant.mockResolvedValue(mockShipment);

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.DELIVERED,
      otp: '1234',
      collectedCash: 500,
    };

    const result = await service.updateStatus('ship-1', 'tenant-1', dto);

    expect(result.status).toBe(ShipmentStatus.DELIVERED);
    expect(bcrypt.compare).toHaveBeenCalledWith('1234', '$2a$10$hashedotp');
    expect(redis.increment).toHaveBeenCalled();
  });

  it('should reject wrong OTP with remaining attempts', async () => {
    mockShipmentsRepository.findByIdForTenant.mockResolvedValue(mockShipment);
    mockRedis.get.mockResolvedValue('1');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.DELIVERED,
      otp: '9999',
      collectedCash: 500,
    };

    await expect(
      service.updateStatus('ship-1', 'tenant-1', dto),
    ).rejects.toThrow(BadRequestException);
  });

  it('should lock OTP after 3 failed attempts', async () => {
    mockShipmentsRepository.findByIdForTenant.mockResolvedValue(mockShipment);
    mockRedis.get.mockResolvedValue('3');

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.DELIVERED,
      otp: '9999',
      collectedCash: 500,
    };

    await expect(
      service.updateStatus('ship-1', 'tenant-1', dto),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should reject delivery without OTP', async () => {
    mockShipmentsRepository.findByIdForTenant.mockResolvedValue(mockShipment);

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.DELIVERED,
      collectedCash: 500,
    };

    await expect(
      service.updateStatus('ship-1', 'tenant-1', dto),
    ).rejects.toThrow(BadRequestException);
  });

  it('should generate hashed OTP when transitioning to OUT_FOR_DELIVERY for COD', async () => {
    mockShipmentsRepository.findByIdForTenant.mockResolvedValue({
      ...mockShipment,
      status: ShipmentStatus.PICKED_UP,
      customerOtp: null,
    });

    const dto: UpdateShipmentStatusDto = {
      newStatus: ShipmentStatus.OUT_FOR_DELIVERY,
    };

    await service.updateStatus('ship-1', 'tenant-1', dto);

    expect(bcrypt.hash).toHaveBeenCalled();
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining('shipment_otp_plain:'),
      expect.any(String),
      86400,
    );
  });
});
