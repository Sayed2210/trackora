import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { ShipmentStatusLogsRepository } from '../repositories/shipment-status-logs.repository';
import { StateMachineService } from './state-machine.service';
import { TrackingNumberService } from './tracking-number.service';
import { FraudDetectionService } from './fraud-detection.service';
import { Prisma } from '@prisma/client';
import {
  Shipment,
  ShipmentStatus,
  ShipmentType,
} from '../entities/shipment.entity';
import { CreateShipmentDto } from '../dtos/create-shipment.dto';
import { UpdateShipmentStatusDto } from '../dtos/update-shipment-status.dto';

interface ShipmentFilters {
  status?: ShipmentStatus | ShipmentStatus[];
  merchantId?: string;
  courierId?: string;
  zoneId?: string;
  from?: Date;
  to?: Date;
  trackingNumber?: string;
  search?: string;
}

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly shipmentsRepository: ShipmentsRepository,
    private readonly statusLogsRepository: ShipmentStatusLogsRepository,
    private readonly stateMachine: StateMachineService,
    private readonly trackingNumberService: TrackingNumberService,
    private readonly fraudDetection: FraudDetectionService,
  ) {}

  async create(dto: CreateShipmentDto, merchantId: string): Promise<Shipment> {
    const trackingNumber = await this.trackingNumberService.generateUnique();

    const riskScore = this.fraudDetection.calculateRiskScore({
      customerPhone: dto.customerPhone,
      addressText: dto.addressText,
      codAmount: dto.type === ShipmentType.COD ? dto.codAmount : 0,
      customerName: dto.customerName,
    });

    const shipment = await this.shipmentsRepository.create({
      ...dto,
      trackingNumber,
      merchantId,
      status: ShipmentStatus.PENDING,
      riskScore,
      deliveryAttempts: 0,
      autoDispatchEligible: true,
      addressVerified: false,
    });

    await this.statusLogsRepository.create({
      shipmentId: shipment.id,
      newStatus: ShipmentStatus.PENDING,
      previousStatus: null,
      metadata: { riskScore, source: 'creation' },
    });

    return shipment;
  }

  async findAll(
    filters: ShipmentFilters,
    page = 1,
    limit = 20,
  ): Promise<{ data: Shipment[]; total: number; page: number; limit: number }> {
    const where: Prisma.ShipmentWhereInput = {};

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }
    if (filters.merchantId) where.merchantId = filters.merchantId;
    if (filters.courierId) where.assignedCourierId = filters.courierId;
    if (filters.zoneId) where.zoneId = filters.zoneId;
    if (filters.trackingNumber) where.trackingNumber = filters.trackingNumber;

    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from)
        (where.createdAt as Record<string, Date>).gte = filters.from;
      if (filters.to)
        (where.createdAt as Record<string, Date>).lte = filters.to;
    }

    if (filters.search) {
      where.OR = [
        { customerName: { contains: filters.search, mode: 'insensitive' } },
        { customerPhone: { contains: filters.search } },
        { addressText: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.shipmentsRepository.findWithFilters(where, skip, limit),
      this.shipmentsRepository.countWithFilters(where),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepository.findById(id);
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    return shipment;
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Shipment> {
    const shipment =
      await this.shipmentsRepository.findByTrackingNumber(trackingNumber);
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    return shipment;
  }

  async updateStatus(
    id: string,
    dto: UpdateShipmentStatusDto,
    changedByUserId?: string,
    changedByRole?: string,
    allowOverride = false,
  ): Promise<Shipment> {
    const shipment = await this.findById(id);

    this.stateMachine.validateTransition(
      shipment.status,
      dto.newStatus,
      allowOverride,
    );

    const previousStatus = shipment.status;
    const updateData: Prisma.ShipmentUpdateInput = { status: dto.newStatus };

    if (dto.notes) updateData.notes = dto.notes;
    if (dto.collectedCash !== undefined)
      updateData.collectedCash = dto.collectedCash;
    if (dto.gpsLocation) updateData.geoLocation = dto.gpsLocation as Prisma.InputJsonValue;

    if (dto.newStatus === ShipmentStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
      if (shipment.type === ShipmentType.COD && !dto.collectedCash) {
        throw new ForbiddenException(
          'COD amount must be collected for delivery',
        );
      }
    }
    if (dto.newStatus === ShipmentStatus.RETURNED) {
      updateData.returnedAt = new Date();
      if (dto.returnReason) updateData.returnReason = dto.returnReason;
    }
    if (dto.newStatus === ShipmentStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }
    if (dto.newStatus === ShipmentStatus.FAILED) {
      updateData.deliveryAttempts = { increment: 1 };
    }

    const updated = await this.shipmentsRepository.update(id, updateData);

    await this.statusLogsRepository.create({
      shipmentId: id,
      previousStatus,
      newStatus: dto.newStatus,
      changedByUserId: changedByUserId || null,
      changedByRole: changedByRole || null,
      reason: dto.reason || null,
      metadata: {
        otp: dto.otp || null,
        collectedCash: dto.collectedCash || null,
        gpsLocation: dto.gpsLocation || null,
      },
    });

    return updated;
  }

  async getTimeline(id: string) {
    await this.findById(id);
    return this.statusLogsRepository.findByShipmentId(id);
  }
}
