import { Injectable } from '@nestjs/common';
import { DemoRequest, Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  DemoRequestSortField,
  DemoRequestSortDirection,
  ListDemoRequestsQueryDto,
} from '../dtos';

@Injectable()
export class DemoRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    where: Prisma.DemoRequestWhereInput,
    orderBy: Prisma.DemoRequestOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return this.prisma.demoRequest.findMany({ where, orderBy, skip, take });
  }

  async count(where: Prisma.DemoRequestWhereInput): Promise<number> {
    return this.prisma.demoRequest.count({ where });
  }

  async findById(id: string) {
    return this.prisma.demoRequest.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.DemoRequestUncheckedUpdateInput) {
    return this.prisma.demoRequest.update({ where: { id }, data });
  }

  buildListWhere(
    query: ListDemoRequestsQueryDto,
  ): Prisma.DemoRequestWhereInput {
    const where: Prisma.DemoRequestWhereInput = {
      status: query.status,
      businessType: query.businessType
        ? { equals: query.businessType, mode: 'insensitive' }
        : undefined,
    };

    if (query.from || query.to) {
      where.createdAt = { gte: query.from, lte: query.to };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  toOrderBy(
    sortBy: DemoRequestSortField = DemoRequestSortField.CREATED_AT,
    direction: DemoRequestSortDirection = DemoRequestSortDirection.DESC,
  ): Prisma.DemoRequestOrderByWithRelationInput {
    return { [sortBy]: direction };
  }
}

export type DemoRequestRecord = DemoRequest;
