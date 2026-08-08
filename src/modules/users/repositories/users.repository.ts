import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AbstractRepository } from '@common/database/abstract.repository';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersRepository extends AbstractRepository<User> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.user;
  }

  protected get baseWhere() {
    return { isActive: true };
  }

  async softDelete(id: string): Promise<void> {
    await this.delegate.update({ where: { id }, data: { isActive: false } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.delegate.findFirst({ where: { ...this.baseWhere, phone } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.delegate.findFirst({ where: { ...this.baseWhere, email } });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.delegate.findMany({ where: this.baseWhere });
  }

  async findActiveUsersForTenant(tenantId: string): Promise<User[]> {
    return this.delegate.findMany({ where: { ...this.baseWhere, tenantId } });
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<User | null> {
    return this.delegate.findFirst({ where: { id, tenantId } });
  }

  async updateForTenant(
    id: string,
    tenantId: string,
    data: Record<string, unknown>,
  ): Promise<User> {
    return this.delegate.update({ where: { id, tenantId }, data });
  }

  async softDeleteForTenant(id: string, tenantId: string): Promise<void> {
    await this.delegate.update({
      where: { id, tenantId },
      data: { isActive: false },
    });
  }
}
