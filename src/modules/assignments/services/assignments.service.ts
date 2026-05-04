import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/prisma/prisma.service';
import { AssignmentsRepository } from '../repositories/assignments.repository';
import {
  Assignment,
  AssignmentStatus,
  AssignmentType,
} from '../entities/assignment.entity';
import { ShipmentStatus } from '@modules/shipments/entities/shipment.entity';
import { Courier } from '@modules/couriers/entities/courier.entity';
import { CreateAssignmentDto } from '../dtos/create-assignment.dto';

interface AssignmentFilters {
  courierId?: string;
  shipmentId?: string;
  status?: AssignmentStatus;
  assignmentType?: AssignmentType;
  from?: Date;
  to?: Date;
}

interface AssignmentResult {
  data: Assignment[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createManualAssignments(
    dto: CreateAssignmentDto,
    assignedByUserId?: string,
  ): Promise<{
    assignments: Assignment[];
    errors: Array<{ shipmentId: string; reason: string }>;
  }> {
    const courier = await this.prisma.courier.findFirst({
      where: { id: dto.courierId, isActive: true },
      include: { user: true },
    });

    if (!courier) {
      throw new NotFoundException('Courier not found');
    }

    this.validateCourierAvailability(courier);

    const assignments: Assignment[] = [];
    const errors: Array<{ shipmentId: string; reason: string }> = [];

    // Check capacity for all shipments first
    const activeCount = await this.assignmentsRepository.countActiveByCourierId(
      dto.courierId,
    );
    const effectiveCapacity = Math.floor(courier.maxDailyCapacity * 0.9);
    const remainingCapacity = effectiveCapacity - activeCount;

    if (remainingCapacity <= 0) {
      throw new ForbiddenException(
        `Courier is at capacity (${activeCount}/${effectiveCapacity} tasks). Cannot assign more shipments.`,
      );
    }

    if (dto.shipmentIds.length > remainingCapacity) {
      throw new ForbiddenException(
        `Cannot assign ${dto.shipmentIds.length} shipments. Courier has ${remainingCapacity} slots remaining.`,
      );
    }

    // Process each shipment
    for (const shipmentId of dto.shipmentIds) {
      try {
        const assignment = await this.assignShipment(
          shipmentId,
          dto.courierId,
          dto.type,
          assignedByUserId,
        );
        assignments.push(assignment);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ shipmentId, reason: message });
      }
    }

    // Emit notifications for successful assignments
    for (const assignment of assignments) {
      this.eventEmitter.emit('assignment.created', {
        assignmentId: assignment.id,
        shipmentId: assignment.shipmentId,
        courierId: assignment.courierId,
        type: assignment.assignmentType,
      });
    }

    return { assignments, errors };
  }

  private async assignShipment(
    shipmentId: string,
    courierId: string,
    type: AssignmentType,
    assignedByUserId?: string,
  ): Promise<Assignment> {
    return this.prisma.$transaction(async (tx) => {
      // Lock shipment for update to prevent race conditions
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
      });

      if (!shipment) {
        throw new NotFoundException(`Shipment ${shipmentId} not found`);
      }

      if (shipment.status !== ShipmentStatus.PENDING) {
        throw new ConflictException(
          `Shipment must be PENDING to assign. Current status: ${shipment.status}`,
        );
      }

      // Check for existing active assignment
      const existingAssignment = await tx.assignment.findFirst({
        where: { shipmentId, status: AssignmentStatus.ACTIVE },
      });

      if (existingAssignment) {
        throw new ConflictException(
          `Shipment already has an active assignment. Cancel it first.`,
        );
      }

      // Create assignment and update shipment in same transaction
      const assignment = await tx.assignment.create({
        data: {
          shipmentId,
          courierId,
          assignedByUserId: assignedByUserId || null,
          assignmentType: type,
          status: AssignmentStatus.ACTIVE,
        },
      });

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { assignedCourierId: courierId },
      });

      return assignment;
    });
  }

  async reassign(
    assignmentId: string,
    newCourierId: string,
    reason?: string,
    reassignedByUserId?: string,
  ): Promise<Assignment> {
    const currentAssignment =
      await this.assignmentsRepository.findById(assignmentId);
    if (!currentAssignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (currentAssignment.status !== AssignmentStatus.ACTIVE) {
      throw new ForbiddenException(
        `Cannot reassign ${currentAssignment.status.toLowerCase()} assignment`,
      );
    }

    const newCourier = await this.prisma.courier.findFirst({
      where: { id: newCourierId, isActive: true },
      include: { user: true },
    });

    if (!newCourier) {
      throw new NotFoundException('New courier not found');
    }

    this.validateCourierAvailability(newCourier);

    const activeCount =
      await this.assignmentsRepository.countActiveByCourierId(newCourierId);
    const effectiveCapacity = Math.floor(newCourier.maxDailyCapacity * 0.9);
    if (activeCount >= effectiveCapacity) {
      throw new ForbiddenException(
        `New courier is at capacity (${activeCount}/${effectiveCapacity} tasks)`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Cancel current assignment
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason || 'Reassigned to another courier',
        },
      });

      // Create new assignment
      const newAssignment = await tx.assignment.create({
        data: {
          shipmentId: currentAssignment.shipmentId,
          courierId: newCourierId,
          assignedByUserId: reassignedByUserId || null,
          assignmentType: AssignmentType.MANUAL,
          status: AssignmentStatus.ACTIVE,
        },
      });

      // Update shipment courier
      await tx.shipment.update({
        where: { id: currentAssignment.shipmentId },
        data: { assignedCourierId: newCourierId },
      });

      // Emit events
      this.eventEmitter.emit('assignment.cancelled', {
        assignmentId: currentAssignment.id,
        reason: 'Reassigned',
      });

      this.eventEmitter.emit('assignment.created', {
        assignmentId: newAssignment.id,
        shipmentId: newAssignment.shipmentId,
        courierId: newAssignment.courierId,
        type: newAssignment.assignmentType,
      });

      return newAssignment;
    });
  }

  async cancel(assignmentId: string, reason?: string): Promise<Assignment> {
    const assignment = await this.assignmentsRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new ForbiddenException(
        `Cannot cancel ${assignment.status.toLowerCase()} assignment`,
      );
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason || null,
        },
      });

      // Remove courier from shipment
      await tx.shipment.update({
        where: { id: assignment.shipmentId },
        data: { assignedCourierId: null },
      });

      return updated;
    });

    this.eventEmitter.emit('assignment.cancelled', {
      assignmentId: cancelled.id,
      reason: reason || 'Cancelled by admin',
    });

    return cancelled;
  }

  async findAll(
    filters: AssignmentFilters,
    page = 1,
    limit = 20,
  ): Promise<AssignmentResult> {
    const where = this.buildWhere(filters);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.assignmentsRepository.findWithFilters(where, skip, limit),
      this.assignmentsRepository.countWithFilters(where),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Assignment> {
    const assignment = await this.assignmentsRepository.findById(id);
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    return assignment;
  }

  async completeAssignment(assignmentId: string): Promise<Assignment> {
    const assignment = await this.assignmentsRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new ForbiddenException(
        `Cannot complete ${assignment.status.toLowerCase()} assignment`,
      );
    }

    const completed = await this.assignmentsRepository.complete(assignmentId);

    this.eventEmitter.emit('assignment.completed', {
      assignmentId: completed.id,
      shipmentId: completed.shipmentId,
      courierId: completed.courierId,
    });

    return completed;
  }

  private validateCourierAvailability(
    courier: Courier & { user?: { phone: string; name: string } },
  ): void {
    if (!courier.isActive) {
      throw new ForbiddenException('Courier is not active');
    }
    if (!courier.isAvailable) {
      throw new ForbiddenException('Courier is currently unavailable');
    }
  }

  private buildWhere(filters: AssignmentFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filters.courierId) where.courierId = filters.courierId;
    if (filters.shipmentId) where.shipmentId = filters.shipmentId;
    if (filters.status) where.status = filters.status;
    if (filters.assignmentType) where.assignmentType = filters.assignmentType;

    if (filters.from || filters.to) {
      where.assignedAt = {};
      if (filters.from)
        (where.assignedAt as Record<string, Date>).gte = filters.from;
      if (filters.to)
        (where.assignedAt as Record<string, Date>).lte = filters.to;
    }

    return where;
  }
}
