import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  AbstractRepository,
  PrismaDelegate,
} from '@common/database/abstract.repository';
import { Assignment, AssignmentStatus } from '../entities/assignment.entity';

export interface AssignmentFilter {
  courierId?: string;
  shipmentId?: string;
  status?: AssignmentStatus;
  assignmentType?: string;
  assignedAt?: { gte?: Date; lte?: Date };
}

export interface AssignmentOrderBy {
  assignedAt?: 'asc' | 'desc';
}

@Injectable()
export class AssignmentsRepository extends AbstractRepository<Assignment> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate(): PrismaDelegate<Assignment> {
    return this.prisma.assignment;
  }

  protected get baseWhere() {
    return {};
  }

  softDelete(): Promise<void> {
    throw new Error('Use tenant-scoped assignment mutation methods');
  }

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Assignment | null> {
    return this.delegate.findFirst({ where: { id, shipment: { tenantId } } });
  }

  async findActiveByShipmentIdForTenant(
    shipmentId: string,
    tenantId: string,
  ): Promise<Assignment | null> {
    return this.delegate.findFirst({
      where: {
        shipmentId,
        status: AssignmentStatus.ACTIVE,
        shipment: { tenantId },
      },
    });
  }

  async countActiveByCourierIdForTenant(
    courierId: string,
    tenantId: string,
  ): Promise<number> {
    return this.delegate.count({
      where: {
        courierId,
        status: AssignmentStatus.ACTIVE,
        shipment: { tenantId },
      },
    });
  }

  async findWithFiltersForTenant(
    tenantId: string,
    where: AssignmentFilter,
    skip: number,
    take: number,
    orderBy: AssignmentOrderBy = { assignedAt: 'desc' },
  ): Promise<Assignment[]> {
    return this.delegate.findMany({
      where: { ...where, shipment: { tenantId } },
      skip,
      take,
      orderBy,
      include: {
        shipment: true,
        courier: {
          include: {
            user: {
              select: {
                id: true,
                tenantId: true,
                email: true,
                phone: true,
                role: true,
                name: true,
                avatarUrl: true,
                isActive: true,
                emailVerified: true,
                phoneVerified: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
  }

  async countWithFiltersForTenant(
    tenantId: string,
    where: AssignmentFilter,
  ): Promise<number> {
    return this.delegate.count({ where: { ...where, shipment: { tenantId } } });
  }

  async cancelForTenant(
    id: string,
    tenantId: string,
    reason?: string,
  ): Promise<Assignment> {
    return this.prisma.assignment.update({
      where: { id, shipment: { tenantId } },
      data: {
        status: AssignmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason || null,
      },
    });
  }

  async completeForTenant(id: string, tenantId: string): Promise<Assignment> {
    return this.prisma.assignment.update({
      where: { id, shipment: { tenantId } },
      data: {
        status: AssignmentStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }
}
