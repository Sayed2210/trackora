import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuditLogSortField, SortDirection } from '../dtos';

@Injectable()
export class PlatformAuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    where: Prisma.AuditLogWhereInput,
    orderBy: Prisma.AuditLogOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return this.prisma.auditLog.findMany({ where, orderBy, skip, take });
  }

  async count(where: Prisma.AuditLogWhereInput) {
    return this.prisma.auditLog.count({ where });
  }

  toOrderBy(
    sortBy: AuditLogSortField = AuditLogSortField.CREATED_AT,
    direction: SortDirection = SortDirection.DESC,
  ): Prisma.AuditLogOrderByWithRelationInput {
    if (sortBy === AuditLogSortField.ACTION) return { action: direction };
    if (sortBy === AuditLogSortField.RESOURCE_TYPE) return { resourceType: direction };
    return { createdAt: direction };
  }
}
