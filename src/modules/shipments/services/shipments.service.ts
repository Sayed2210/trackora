import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@core/prisma/prisma.service';
import { RedisService } from '@infrastructure/cache/redis.service';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { ShipmentStatusLogsRepository } from '../repositories/shipment-status-logs.repository';
import { StateMachineService } from './state-machine.service';
import { TrackingNumberService } from './tracking-number.service';
import { FraudDetectionService } from './fraud-detection.service';
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
  private readonly OTP_MAX_ATTEMPTS = 3;
  private readonly OTP_ATTEMPT_TTL = 86400; // 24 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly shipmentsRepository: ShipmentsRepository,
    private readonly statusLogsRepository: ShipmentStatusLogsRepository,
    private readonly stateMachine: StateMachineService,
    private readonly trackingNumberService: TrackingNumberService,
    private readonly fraudDetection: FraudDetectionService,
    private readonly eventEmitter: EventEmitter2,
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

  private buildWhere(filters: ShipmentFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

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

    return where;
  }

  async findAll(
    filters: ShipmentFilters,
    page = 1,
    limit = 20,
  ): Promise<{ data: Shipment[]; total: number; page: number; limit: number }> {
    const where = this.buildWhere(filters);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.shipmentsRepository.findWithFilters(where, skip, limit),
      this.shipmentsRepository.countWithFilters(where),
    ]);

    return { data, total, page, limit };
  }

  async findAllCursor(
    filters: ShipmentFilters,
    cursor?: string,
    limit = 20,
  ): Promise<{
    data: Shipment[];
    nextCursor: string | null;
    limit: number;
  }> {
    const where = this.buildWhere(filters);
    const data = await this.shipmentsRepository.findWithCursor(
      where,
      cursor,
      limit + 1,
    );

    const hasMore = data.length > limit;
    const results = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore
      ? (results[results.length - 1]?.id ?? null)
      : null;

    return { data: results, nextCursor, limit };
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
    const updateData: Record<string, unknown> = { status: dto.newStatus };

    if (dto.notes) updateData.notes = dto.notes;
    if (dto.collectedCash !== undefined)
      updateData.collectedCash = dto.collectedCash;
    if (dto.gpsLocation) updateData.geoLocation = dto.gpsLocation;

    // Generate OTP when going OUT_FOR_DELIVERY for COD shipments
    if (
      dto.newStatus === ShipmentStatus.OUT_FOR_DELIVERY &&
      shipment.type === ShipmentType.COD
    ) {
      const plainOtp = this.generateOtp();
      updateData.customerOtp = await bcrypt.hash(plainOtp, 10);
      await this.redis.set(
        `shipment_otp_plain:${id}`,
        plainOtp,
        86400,
      );
    }

    if (dto.newStatus === ShipmentStatus.DELIVERED) {
      updateData.deliveredAt = new Date();

      if (shipment.type === ShipmentType.COD) {
        if (!dto.collectedCash) {
          throw new ForbiddenException(
            'COD amount must be collected for delivery',
          );
        }
        const codAmount = Number(shipment.codAmount);
        const tolerance = Math.max(codAmount * 0.05, 1);
        if (Math.abs(Number(dto.collectedCash) - codAmount) > tolerance) {
          throw new BadRequestException(
            `Collected cash (${dto.collectedCash}) does not match COD amount (${shipment.codAmount}). Difference exceeds 5% tolerance.`,
          );
        }
        await this.verifyDeliveryOtp(id, shipment.customerOtp, dto.otp);
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

    // Use Prisma transaction for shipment + courier updates
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedShipment = await tx.shipment.update({
        where: { id },
        data: updateData,
      });

      // Update courier stats and cash on terminal statuses
      if (shipment.assignedCourierId) {
        if (dto.newStatus === ShipmentStatus.DELIVERED) {
          const courierUpdate: Record<string, unknown> = {
            totalDelivered: { increment: 1 },
          };
          if (shipment.type === ShipmentType.COD && dto.collectedCash) {
            courierUpdate.cashHeld = {
              increment: dto.collectedCash,
            };
          }
          await tx.courier.update({
            where: { id: shipment.assignedCourierId },
            data: courierUpdate,
          });
        } else if (dto.newStatus === ShipmentStatus.FAILED) {
          await tx.courier.update({
            where: { id: shipment.assignedCourierId },
            data: { totalFailed: { increment: 1 } },
          });
        } else if (dto.newStatus === ShipmentStatus.RETURNED) {
          await tx.courier.update({
            where: { id: shipment.assignedCourierId },
            data: { totalReturned: { increment: 1 } },
          });
        }
      }

      return updatedShipment;
    });

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
        photoUrl: (dto as unknown as Record<string, unknown>).photoUrl || null,
        signatureUrl:
          (dto as unknown as Record<string, unknown>).signatureUrl || null,
      },
    });

    // Emit COD delivered event for wallet processing
    if (dto.newStatus === ShipmentStatus.DELIVERED) {
      this.eventEmitter.emit('shipment.delivered', {
        shipmentId: id,
        merchantId: shipment.merchantId,
        courierId: shipment.assignedCourierId || undefined,
        codAmount: Number(shipment.codAmount),
        collectedCash: dto.collectedCash || 0,
        type: shipment.type,
      });
    }

    return updated;
  }

  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private async verifyDeliveryOtp(
    shipmentId: string,
    hashedOtp: string | null,
    providedOtp?: string,
  ): Promise<void> {
    if (!hashedOtp) {
      throw new BadRequestException('No OTP configured for this shipment');
    }
    if (!providedOtp) {
      throw new BadRequestException('OTP is required for COD delivery');
    }

    const attemptKey = `shipment_otp_attempts:${shipmentId}`;
    const attempts = parseInt((await this.redis.get(attemptKey)) || '0', 10);

    if (attempts >= this.OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException(
        'Maximum OTP attempts exceeded. Contact admin for override.',
      );
    }

    await this.redis.increment(attemptKey);
    await this.redis.expire(attemptKey, this.OTP_ATTEMPT_TTL);

    const isValid = await bcrypt.compare(providedOtp, hashedOtp);
    if (!isValid) {
      const remaining = this.OTP_MAX_ATTEMPTS - (attempts + 1);
      throw new BadRequestException(
        `Invalid OTP. ${remaining} attempts remaining.`,
      );
    }
  }

  async getTimeline(id: string) {
    await this.findById(id);
    return this.statusLogsRepository.findByShipmentId(id);
  }
}
