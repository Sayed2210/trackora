import { PrismaService } from '@core/prisma/prisma.service';

export interface PrismaDelegate<T> {
  findMany: (args?: {
    where?: any;
    skip?: number;
    take?: number;
    orderBy?: any;
  }) => Promise<T[]>;
  findFirst: (args?: { where?: any }) => Promise<T | null>;
  findUnique: (args: { where: any }) => Promise<T | null>;
  create: (args: { data: any }) => Promise<T>;
  update: (args: { where: { id: string }; data: any }) => Promise<T>;
  updateMany: (args: { where: any; data: any }) => Promise<any>;
  delete: (args: { where: { id: string } }) => Promise<T>;
  count: (args?: { where?: any }) => Promise<number>;
}

export abstract class AbstractRepository<T> {
  constructor(protected readonly prisma: PrismaService) {}

  protected abstract get delegate(): PrismaDelegate<T>;

  protected get baseWhere(): Record<string, unknown> {
    return {};
  }

  async findAll(): Promise<T[]> {
    return this.delegate.findMany({ where: this.baseWhere });
  }

  async findById(id: string): Promise<T | null> {
    return this.delegate.findFirst({ where: { ...this.baseWhere, id } });
  }

  async findOne(where: Record<string, unknown>): Promise<T | null> {
    return this.delegate.findFirst({ where: { ...this.baseWhere, ...where } });
  }

  async create(data: Record<string, unknown>): Promise<T> {
    return this.delegate.create({ data });
  }

  async update(id: string, data: Record<string, unknown>): Promise<T> {
    return this.delegate.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.delegate.delete({ where: { id } });
  }

  abstract softDelete(id: string): Promise<void>;

  async exists(where: Record<string, unknown>): Promise<boolean> {
    const count = await this.delegate.count({
      where: { ...this.baseWhere, ...where },
    });
    return count > 0;
  }
}
