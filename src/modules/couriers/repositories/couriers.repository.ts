import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { Courier } from '../entities/courier.entity';
import { AssignmentStatus } from '@prisma/client';

export interface CourierFilter {
  search?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  zoneCode?: string;
}

@Injectable()
export class CouriersRepository extends AbstractRepository<Courier> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.courier;
  }

  protected get baseWhere() {
    return { isActive: true };
  }

  softDelete(): Promise<void> {
    throw new Error('Use softDeleteForTenant for tenant-owned couriers');
  }

  async softDeleteForTenant(id: string, tenantId: string): Promise<void> {
    await this.delegate.update({
      where: { id, tenantId },
      data: { isActive: false },
    });
  }

  async findByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<Courier | null> {
    return this.delegate.findFirst({ where: { id, tenantId } });
  }

  async findByUserIdForTenant(
    userId: string,
    tenantId: string,
  ): Promise<Courier | null> {
    return this.delegate.findFirst({
      where: { ...this.baseWhere, userId, tenantId },
    });
  }

  async findAvailableCouriersForTenant(tenantId: string): Promise<Courier[]> {
    return this.delegate.findMany({
      where: { ...this.baseWhere, tenantId, isAvailable: true },
    });
  }

  async findByZoneCodeForTenant(
    zoneCode: string,
    tenantId: string,
  ): Promise<Courier[]> {
    return this.delegate.findMany({
      where: {
        ...this.baseWhere,
        tenantId,
        zoneCodes: { has: zoneCode },
      },
    });
  }

  async findWithFiltersForTenant(
    tenantId: string,
    filters: CourierFilter,
    skip: number,
    take: number,
  ) {
    const where = { ...this.buildWhere(filters), tenantId };
    const [data, total] = await Promise.all([
      this.delegate.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      }),
      this.delegate.count({ where }),
    ]);

    return { data, total };
  }

  async countActiveTasksByCourierIds(
    courierIds: string[],
    tenantId: string,
  ): Promise<Map<string, number>> {
    if (courierIds.length === 0) return new Map();

    const grouped = await this.prisma.assignment.groupBy({
      by: ['courierId'],
      where: {
        courierId: { in: courierIds },
        status: AssignmentStatus.ACTIVE,
        shipment: { tenantId },
      },
      _count: { _all: true },
    });

    return new Map(grouped.map((item) => [item.courierId, item._count._all]));
  }

  async updateForTenant(
    id: string,
    tenantId: string,
    data: Record<string, unknown>,
  ): Promise<Courier> {
    return this.delegate.update({ where: { id, tenantId }, data });
  }

  private buildWhere(filters: CourierFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.isAvailable !== undefined)
      where.isAvailable = filters.isAvailable;
    if (filters.zoneCode) where.zoneCodes = { has: filters.zoneCode };
    if (filters.search) {
      where.OR = [
        { employeeId: { contains: filters.search, mode: 'insensitive' } },
        { licensePlate: { contains: filters.search, mode: 'insensitive' } },
        { user: { name: { contains: filters.search, mode: 'insensitive' } } },
        { user: { phone: { contains: filters.search, mode: 'insensitive' } } },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }
}
