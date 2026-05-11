import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CouriersRepository } from '../repositories/couriers.repository';
import { Courier } from '../entities/courier.entity';

export interface CourierListQuery {
  search?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  zoneCode?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class CouriersService {
  constructor(private readonly couriersRepository: CouriersRepository) {}

  async create(data: Partial<Courier>, userId: string): Promise<Courier> {
    const existing = await this.couriersRepository.findByUserId(userId);
    if (existing) {
      throw new ConflictException('Courier already exists for this user');
    }

    return this.couriersRepository.create({
      ...data,
      userId,
      cashHeld: 0,
      currentPerformanceScore: 50,
    });
  }

  async findById(id: string): Promise<Courier> {
    const courier = await this.couriersRepository.findById(id);
    if (!courier) {
      throw new NotFoundException('Courier not found');
    }
    return courier;
  }

  async findByUserId(userId: string): Promise<Courier | null> {
    return this.couriersRepository.findByUserId(userId);
  }

  async findAll(query: CourierListQuery = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const { data, total } = await this.couriersRepository.findWithFilters(
      {
        search: query.search,
        isActive: query.isActive,
        isAvailable: query.isAvailable,
        zoneCode: query.zoneCode,
      },
      skip,
      limit,
    );

    const activeTaskCounts =
      await this.couriersRepository.countActiveTasksByCourierIds(
        data.map((courier) => courier.id),
      );

    return {
      data: data.map((courier) => ({
        id: courier.id,
        userId: courier.userId,
        name: courier.user?.name,
        phone: courier.user?.phone,
        email: courier.user?.email,
        employeeId: courier.employeeId,
        vehicleType: courier.vehicleType,
        licensePlate: courier.licensePlate,
        zoneCodes: courier.zoneCodes,
        isActive: courier.isActive,
        isAvailable: courier.isAvailable,
        currentTasks: activeTaskCounts.get(courier.id) ?? 0,
        maxDailyCapacity: courier.maxDailyCapacity,
        capacity: courier.maxDailyCapacity,
        rating: courier.currentPerformanceScore,
        cashHeld: courier.cashHeld,
        createdAt: courier.createdAt,
        updatedAt: courier.updatedAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async updateZones(id: string, zoneCodes: string[]): Promise<Courier> {
    await this.findById(id);
    return this.couriersRepository.update(id, { zoneCodes });
  }

  async updateAvailability(id: string, isAvailable: boolean): Promise<Courier> {
    await this.findById(id);
    return this.couriersRepository.update(id, { isAvailable });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.couriersRepository.softDelete(id);
  }
}
