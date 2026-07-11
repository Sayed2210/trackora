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

  async softDelete(id: string): Promise<void> {
    await this.delegate.update({
      where: { id },
      data: { status: AssignmentStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  async findActiveByShipmentId(shipmentId: string): Promise<Assignment | null> {
    return this.delegate.findFirst({
      where: { shipmentId, status: AssignmentStatus.ACTIVE },
    });
  }

  async countActiveByCourierId(courierId: string): Promise<number> {
    return this.delegate.count({
      where: { courierId, status: AssignmentStatus.ACTIVE },
    });
  }

  async findWithFilters(
    where: AssignmentFilter,
    skip: number,
    take: number,
    orderBy: AssignmentOrderBy = { assignedAt: 'desc' },
  ): Promise<Assignment[]> {
    return this.delegate.findMany({
      where,
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

  async countWithFilters(where: AssignmentFilter): Promise<number> {
    return this.delegate.count({ where });
  }

  async cancel(id: string, reason?: string): Promise<Assignment> {
    return this.delegate.update({
      where: { id },
      data: {
        status: AssignmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason || null,
      },
    });
  }

  async complete(id: string): Promise<Assignment> {
    return this.delegate.update({
      where: { id },
      data: {
        status: AssignmentStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }
}
