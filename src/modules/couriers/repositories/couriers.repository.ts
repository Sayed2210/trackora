import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { Courier } from '../entities/courier.entity';

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

  async softDelete(id: string): Promise<void> {
    await this.delegate.update({ where: { id }, data: { isActive: false } });
  }

  async findByUserId(userId: string): Promise<Courier | null> {
    return this.delegate.findFirst({ where: { ...this.baseWhere, userId } });
  }

  async findAvailableCouriers(): Promise<Courier[]> {
    return this.delegate.findMany({
      where: { ...this.baseWhere, isAvailable: true },
    });
  }

  async findByZoneCode(zoneCode: string): Promise<Courier[]> {
    return this.delegate.findMany({
      where: {
        ...this.baseWhere,
        zoneCodes: { has: zoneCode },
      },
    });
  }
}
