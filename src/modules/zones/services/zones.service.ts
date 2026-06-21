import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ZonesRepository } from '../repositories/zones.repository';
import { Zone } from '../entities/zone.entity';
import { CreateZoneDto } from '../dtos/create-zone.dto';
import { UpdateZoneDto } from '../dtos/update-zone.dto';
import { ListZonesDto } from '../dtos/list-zones.dto';

@Injectable()
export class ZonesService {
  constructor(private readonly zonesRepository: ZonesRepository) {}

  async create(dto: CreateZoneDto): Promise<Zone> {
    const existing = await this.zonesRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException('Zone code already exists');
    }

    if (dto.parentId) {
      const parent = await this.zonesRepository.findById(dto.parentId);
      if (!parent) {
        throw new NotFoundException('Parent zone not found');
      }
    }

    return this.zonesRepository.create({ ...dto });
  }

  async findAll(
    query: ListZonesDto,
  ): Promise<{ data: Zone[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.level !== undefined) {
      where.level = query.level;
    }
    if (query.parentId !== undefined) {
      where.parentId = query.parentId;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.zonesRepository.findMany(where, { nameAr: 'asc' }, skip, limit),
      this.zonesRepository.count(where),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Zone> {
    const zone = await this.zonesRepository.findById(id);
    if (!zone) {
      throw new NotFoundException('Zone not found');
    }
    return zone;
  }

  async update(id: string, dto: UpdateZoneDto): Promise<Zone> {
    await this.findById(id);

    if (dto.code) {
      const existing = await this.zonesRepository.findByCode(dto.code);
      if (existing && existing.id !== id) {
        throw new ConflictException('Zone code already exists');
      }
    }

    if (dto.parentId) {
      const parent = await this.zonesRepository.findById(dto.parentId);
      if (!parent) {
        throw new NotFoundException('Parent zone not found');
      }
      // Prevent self-reference or circular reference (basic check)
      if (dto.parentId === id) {
        throw new ConflictException('Zone cannot be its own parent');
      }
    }

    return this.zonesRepository.update(id, { ...dto });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.zonesRepository.softDelete(id);
  }

  async findChildren(parentId: string): Promise<Zone[]> {
    await this.findById(parentId);
    return this.zonesRepository.findChildren(parentId);
  }
}
