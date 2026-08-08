import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { ShipmentsService } from '@modules/shipments/services/shipments.service';
import { AssignmentsService } from '@modules/assignments/services/assignments.service';
import { ShipmentStatus } from '@modules/shipments/entities/shipment.entity';
import { AssignmentStatus } from '@modules/assignments/entities/assignment.entity';
import { UpdateTaskStatusDto } from '../dtos/update-task-status.dto';
import { CourierDepositDto } from '../dtos/courier-deposit.dto';
import { SyncAction, SyncUpdatesDto } from '../dtos/sync-updates.dto';

export interface Task {
  shipmentId: string;
  trackingNumber: string;
  customerName: string;
  customerPhoneMasked: string;
  addressText: string;
  codAmount: number | null;
  status: ShipmentStatus;
  orderInRoute: number;
  productDescription?: string | null;
  notes?: string | null;
}

export interface SyncResult {
  processed: number;
  failed: number;
  conflicts: Array<{
    updateId: string;
    shipmentId: string;
    serverStatus: string;
    localStatus: string;
    resolution: string;
  }>;
}

@Injectable()
export class CourierAppService {
  private readonly logger = new Logger(CourierAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipmentsService: ShipmentsService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  async getTaskById(
    userId: string,
    shipmentId: string,
    tenantId: string,
  ): Promise<Task> {
    const courier = await this.getCourierForUser(userId, tenantId);

    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        assignedCourierId: courier.id,
        tenantId,
        status: {
          in: [
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_WAREHOUSE,
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.POSTPONED,
          ],
        },
      },
      select: {
        id: true,
        trackingNumber: true,
        customerName: true,
        customerPhone: true,
        addressText: true,
        codAmount: true,
        status: true,
        productDescription: true,
        notes: true,
        preferredDeliveryDate: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Task not found or not assigned to you');
    }

    return {
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      customerName: shipment.customerName,
      customerPhoneMasked: this.maskPhone(shipment.customerPhone),
      addressText: shipment.addressText,
      codAmount: shipment.codAmount ? Number(shipment.codAmount) : null,
      status: shipment.status,
      orderInRoute: 1,
      productDescription: shipment.productDescription,
      notes: shipment.notes,
    };
  }

  async getTasks(userId: string, tenantId: string): Promise<Task[]> {
    const courier = await this.getCourierForUser(userId, tenantId);

    const shipments = await this.prisma.shipment.findMany({
      where: {
        assignedCourierId: courier.id,
        tenantId,
        status: {
          in: [
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_WAREHOUSE,
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.POSTPONED,
          ],
        },
      },
      orderBy: { preferredDeliveryDate: 'asc' },
      select: {
        id: true,
        trackingNumber: true,
        customerName: true,
        customerPhone: true,
        addressText: true,
        codAmount: true,
        status: true,
        preferredDeliveryDate: true,
      },
    });

    return shipments.map((s, index) => ({
      shipmentId: s.id,
      trackingNumber: s.trackingNumber,
      customerName: s.customerName,
      customerPhoneMasked: this.maskPhone(s.customerPhone),
      addressText: s.addressText,
      codAmount: s.codAmount ? Number(s.codAmount) : null,
      status: s.status,
      orderInRoute: index + 1,
    }));
  }

  async updateTaskStatus(
    userId: string,
    shipmentId: string,
    dto: UpdateTaskStatusDto,
    tenantId: string,
  ) {
    const courier = await this.getCourierForUser(userId, tenantId);
    // Verify shipment belongs to this courier
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, assignedCourierId: courier.id, tenantId },
    });
    if (!shipment) {
      throw new ForbiddenException('Shipment not assigned to this courier');
    }

    const updated = await this.shipmentsService.updateStatus(
      shipmentId,
      tenantId,
      {
        newStatus: dto.status,
        otp: dto.otp,
        collectedCash: dto.collectedCash,
        notes: dto.notes,
        gpsLocation: dto.gpsLocation,
        returnReason: dto.returnReason,
      },
      userId,
      'COURIER',
    );

    // If terminal status, complete the assignment
    if (
      dto.status === ShipmentStatus.DELIVERED ||
      dto.status === ShipmentStatus.RETURNED ||
      dto.status === ShipmentStatus.CANCELLED
    ) {
      const assignment = await this.prisma.assignment.findFirst({
        where: { shipmentId, status: AssignmentStatus.ACTIVE },
      });
      if (assignment) {
        await this.assignmentsService.completeAssignment(
          assignment.id,
          tenantId,
        );
      }
    }

    return updated;
  }

  async logDeposit(userId: string, dto: CourierDepositDto, tenantId: string) {
    const courier = await this.getCourierForUser(userId, tenantId);

    if (dto.depositedTo) {
      const recipient = await this.prisma.user.findFirst({
        where: { id: dto.depositedTo, tenantId, isActive: true },
        select: { id: true },
      });
      if (!recipient)
        throw new NotFoundException('Deposit recipient not found');
    }

    const amount = dto.amount;
    const currentCashHeld = Number(courier.cashHeld);

    if (amount > currentCashHeld) {
      throw new BadRequestException(
        `Deposit amount (${amount}) exceeds cash held (${currentCashHeld})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Create deposit record
      const deposit = await tx.courierCashDeposit.create({
        data: {
          courierId: courier.id,
          amount,
          verifiedByUserId: dto.depositedTo,
          notes: dto.notes || null,
        },
      });

      // Decrease courier cashHeld
      await tx.courier.update({
        where: { id: courier.id, tenantId },
        data: {
          cashHeld: { decrement: amount },
        },
      });

      return deposit;
    });
  }

  async getPerformance(userId: string, tenantId: string) {
    const courier = await this.prisma.courier.findFirst({
      where: { userId, tenantId },
      include: { user: true },
    });
    if (!courier) throw new NotFoundException('Courier not found');

    const total =
      courier.totalDelivered + courier.totalFailed + courier.totalReturned;
    const successRate = total > 0 ? (courier.totalDelivered / total) * 100 : 0;

    // TODO: Calculate rank and weekly trend from analytics (Phase 2+)
    return {
      score: courier.currentPerformanceScore,
      totalDelivered: courier.totalDelivered,
      totalFailed: courier.totalFailed,
      totalReturned: courier.totalReturned,
      successRate: parseFloat(successRate.toFixed(1)),
      avgDeliveryTimeMinutes: courier.avgDeliveryTimeMinutes,
      cashHeld: Number(courier.cashHeld),
      rank: null,
      weeklyTrend: [],
    };
  }

  async syncUpdates(
    userId: string,
    dto: SyncUpdatesDto,
    tenantId: string,
  ): Promise<SyncResult> {
    const courier = await this.getCourierForUser(userId, tenantId);
    const result: SyncResult = {
      processed: 0,
      failed: 0,
      conflicts: [],
    };

    for (const update of dto.updates) {
      try {
        const shipment = await this.prisma.shipment.findFirst({
          where: {
            id: update.shipmentId,
            assignedCourierId: courier.id,
            tenantId,
          },
        });

        if (!shipment) {
          result.conflicts.push({
            updateId: update.id,
            shipmentId: update.shipmentId,
            serverStatus: 'NOT_FOUND',
            localStatus: (update.payload?.status as string) || 'UNKNOWN',
            resolution: 'REJECTED_LOCAL',
          });
          continue;
        }

        if (update.action === SyncAction.STATUS_UPDATE) {
          const payload = update.payload as {
            status: ShipmentStatus;
            collectedCash?: number;
            otp?: string;
            notes?: string;
            gpsLocation?: { lat: number; lng: number };
            returnReason?: string;
          };

          // Check if server status has already progressed beyond the local update
          const statusOrder = [
            ShipmentStatus.PENDING,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_WAREHOUSE,
            ShipmentStatus.OUT_FOR_DELIVERY,
            ShipmentStatus.DELIVERED,
            ShipmentStatus.FAILED,
            ShipmentStatus.POSTPONED,
            ShipmentStatus.RETURNED,
            ShipmentStatus.CANCELLED,
          ];
          const serverIndex = statusOrder.indexOf(shipment.status);
          const localIndex = statusOrder.indexOf(payload.status);

          if (serverIndex > localIndex) {
            result.conflicts.push({
              updateId: update.id,
              shipmentId: update.shipmentId,
              serverStatus: shipment.status,
              localStatus: payload.status,
              resolution: 'REJECTED_LOCAL',
            });
            continue;
          }

          await this.updateTaskStatus(
            userId,
            update.shipmentId,
            {
              status: payload.status,
              collectedCash: payload.collectedCash,
              otp: payload.otp,
              notes: payload.notes,
              gpsLocation: payload.gpsLocation,
              returnReason: payload.returnReason as
                | import('@prisma/client').ReturnReason
                | undefined,
            },
            tenantId,
          );

          result.processed++;
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to process sync update ${update.id}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
        result.failed++;
      }
    }

    return result;
  }

  private async getCourierForUser(userId: string, tenantId: string) {
    const courier = await this.prisma.courier.findFirst({
      where: { userId, tenantId, isActive: true },
    });
    if (!courier) throw new NotFoundException('Courier not found');
    return courier;
  }

  private maskPhone(phone: string): string {
    if (phone.length < 7) return phone;
    return `${phone.slice(0, 4)}*****${phone.slice(-3)}`;
  }
}
