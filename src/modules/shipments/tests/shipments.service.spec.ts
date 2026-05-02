import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ShipmentsService } from '../services/shipments.service';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { ShipmentStatusLogsRepository } from '../repositories/shipment-status-logs.repository';
import { StateMachineService } from '../services/state-machine.service';
import { TrackingNumberService } from '../services/tracking-number.service';
import { FraudDetectionService } from '../services/fraud-detection.service';
import { ShipmentStatus, ShipmentType } from '../entities/shipment.entity';
import { CreateShipmentDto } from '../dtos/create-shipment.dto';
import { UpdateShipmentStatusDto } from '../dtos/update-shipment-status.dto';

const mockShipment = {
  id: 'ship-1',
  trackingNumber: 'TRK-240502-1234',
  merchantId: 'merchant-1',
  status: ShipmentStatus.PENDING,
  type: ShipmentType.COD,
  customerName: 'Ahmed',
  customerPhone: '01012345678',
  customerPhone2: null,
  address: {},
  addressText: 'Cairo',
  geoLocation: null,
  zoneId: null,
  codAmount: 100,
  productDescription: 'Shoes',
  productValue: 200,
  weight: 1,
  pieces: 1,
  notes: null,
  deliveryAttempts: 0,
  preferredDeliveryDate: null,
  assignedCourierId: null,
  returnReason: null,
  returnNotes: null,
  collectedCash: null,
  customerOtp: null,
  deliveredAt: null,
  returnedAt: null,
  cancelledAt: null,
  autoDispatchEligible: true,
  addressVerified: false,
  riskScore: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let shipmentsRepo: ShipmentsRepository;
  let logsRepo: ShipmentStatusLogsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        StateMachineService,
        FraudDetectionService,
        {
          provide: ShipmentsRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(mockShipment),
            findById: jest.fn().mockResolvedValue(mockShipment),
            findByTrackingNumber: jest.fn().mockResolvedValue(mockShipment),
            findWithFilters: jest.fn().mockResolvedValue([mockShipment]),
            countWithFilters: jest.fn().mockResolvedValue(1),
            update: jest.fn().mockResolvedValue(mockShipment),
          },
        },
        {
          provide: ShipmentStatusLogsRepository,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
            findByShipmentId: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: TrackingNumberService,
          useValue: {
            generateUnique: jest.fn().mockResolvedValue('TRK-240502-9999'),
          },
        },
      ],
    }).compile();

    service = module.get<ShipmentsService>(ShipmentsService);
    shipmentsRepo = module.get<ShipmentsRepository>(ShipmentsRepository);
    logsRepo = module.get<ShipmentStatusLogsRepository>(
      ShipmentStatusLogsRepository,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create shipment with tracking number and log', async () => {
      const dto: CreateShipmentDto = {
        customerName: 'Ahmed',
        customerPhone: '01012345678',
        address: {},
        addressText: 'Cairo',
        type: ShipmentType.COD,
        codAmount: 100,
        productDescription: 'Shoes',
      };

      const result = await service.create(dto, 'merchant-1');
      expect(result).toEqual(mockShipment);
      expect(shipmentsRepo.create).toHaveBeenCalled();
      expect(logsRepo.create).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return shipment by id', async () => {
      const result = await service.findById('ship-1');
      expect(result).toEqual(mockShipment);
    });

    it('should throw NotFoundException for missing shipment', async () => {
      jest.spyOn(shipmentsRepo, 'findById').mockResolvedValueOnce(null);
      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status and create log', async () => {
      const dto: UpdateShipmentStatusDto = {
        newStatus: ShipmentStatus.PICKED_UP,
      };

      const result = await service.updateStatus('ship-1', dto);
      expect(result).toEqual(mockShipment);
      expect(shipmentsRepo.update).toHaveBeenCalled();
      expect(logsRepo.create).toHaveBeenCalled();
    });

    it('should block invalid transition', async () => {
      const dto: UpdateShipmentStatusDto = {
        newStatus: ShipmentStatus.DELIVERED,
      };

      await expect(service.updateStatus('ship-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should require collectedCash for COD delivery', async () => {
      jest.spyOn(shipmentsRepo, 'findById').mockResolvedValueOnce({
        ...mockShipment,
        status: ShipmentStatus.OUT_FOR_DELIVERY,
      } as any);

      const dto: UpdateShipmentStatusDto = {
        newStatus: ShipmentStatus.DELIVERED,
      };

      await expect(service.updateStatus('ship-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const result = await service.findAll({}, 1, 20);
      expect(result.data).toEqual([mockShipment]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
