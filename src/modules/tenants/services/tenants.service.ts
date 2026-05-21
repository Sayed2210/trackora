import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Tenant } from '../entities/tenant.entity';
import { TenantsRepository } from '../repositories/tenants.repository';
import {
  ChangePlatformTenantStatusDto,
  CreatePlatformTenantDto,
  ListPlatformTenantsDto,
  UpdatePlatformTenantDto,
} from '../dtos';

@Injectable()
export class TenantsService {
  constructor(private readonly tenantsRepository: TenantsRepository) {}

  async create(dto: CreatePlatformTenantDto): Promise<Tenant> {
    await this.assertSlugAvailable(dto.slug);
    this.assertValidTrialRange(dto.trialStartsAt, dto.trialEndsAt);

    return this.tenantsRepository.create({
      name: dto.name,
      slug: dto.slug,
      trialStartsAt: dto.trialStartsAt,
      trialEndsAt: dto.trialEndsAt,
      metadata: dto.metadata,
    });
  }

  async findAll(
    query: ListPlatformTenantsDto,
  ): Promise<{ data: Tenant[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.tenantsRepository.findMany(where, skip, limit),
      this.tenantsRepository.count(where),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findById(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async update(id: string, dto: UpdatePlatformTenantDto): Promise<Tenant> {
    const tenant = await this.findById(id);

    if (dto.slug !== undefined) {
      await this.assertSlugAvailable(dto.slug, id);
    }

    this.assertValidTrialRange(
      dto.trialStartsAt ?? tenant.trialStartsAt ?? undefined,
      dto.trialEndsAt ?? tenant.trialEndsAt ?? undefined,
    );

    return this.tenantsRepository.update(id, { ...dto });
  }

  async changeStatus(
    id: string,
    dto: ChangePlatformTenantStatusDto,
  ): Promise<Tenant> {
    await this.findById(id);
    return this.tenantsRepository.update(id, { status: dto.status });
  }

  private async assertSlugAvailable(
    slug: string,
    currentTenantId?: string,
  ): Promise<void> {
    const existing = await this.tenantsRepository.findBySlug(slug);
    if (existing && existing.id !== currentTenantId) {
      throw new ConflictException('Tenant slug already exists');
    }
  }

  private assertValidTrialRange(startsAt?: Date, endsAt?: Date): void {
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('Trial end date must be after start date');
    }
  }
}
