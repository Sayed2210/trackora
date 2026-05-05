import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CouriersRepository } from '../repositories/couriers.repository';
import { Courier } from '../entities/courier.entity';

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
