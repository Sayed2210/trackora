import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Tenant } from '../entities/tenant.entity';
import { TenantsRepository } from '../repositories/tenants.repository';
import {
  AuditActorContext,
  PlatformAuditLogService,
} from '@modules/platform/audit-logs/services/platform-audit-log.service';
import {
  ChangePlatformTenantStatusDto,
  CreatePlatformTenantDto,
  ListPlatformTenantsDto,
  UpdatePlatformTenantDto,
} from '../dtos';

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantsRepository: TenantsRepository,
    private readonly auditLogService: PlatformAuditLogService,
  ) {}

  async create(dto: CreatePlatformTenantDto, audit?: AuditActorContext): Promise<Tenant> {
    await this.assertSlugAvailable(dto.slug);
    this.assertValidTrialRange(dto.trialStartsAt, dto.trialEndsAt);

    const tenant = await this.tenantsRepository.create({
      name: dto.name,
      slug: dto.slug,
      trialStartsAt: dto.trialStartsAt,
      trialEndsAt: dto.trialEndsAt,
      metadata: dto.metadata,
    });
    await this.auditLogService?.writeAuditLog({
      ...audit,
      tenantId: tenant.id,
      action: 'tenant.created',
      resourceType: 'Tenant',
      resourceId: tenant.id,
      newValue: tenant,
    });
    return tenant;
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

  async update(id: string, dto: UpdatePlatformTenantDto, audit?: AuditActorContext): Promise<Tenant> {
    const tenant = await this.findById(id);

    if (dto.slug !== undefined) {
      await this.assertSlugAvailable(dto.slug, id);
    }

    this.assertValidTrialRange(
      dto.trialStartsAt ?? tenant.trialStartsAt ?? undefined,
      dto.trialEndsAt ?? tenant.trialEndsAt ?? undefined,
    );

    const updated = await this.tenantsRepository.update(id, { ...dto });
    await this.auditLogService?.writeAuditLog({
      ...audit,
      tenantId: id,
      action: 'tenant.updated',
      resourceType: 'Tenant',
      resourceId: id,
      oldValue: tenant,
      newValue: updated,
    });
    return updated;
  }

  async changeStatus(
    id: string,
    dto: ChangePlatformTenantStatusDto,
    audit?: AuditActorContext,
  ): Promise<Tenant> {
    const tenant = await this.findById(id);
    const updated = await this.tenantsRepository.update(id, { status: dto.status });
    await this.auditLogService?.writeAuditLog({
      ...audit,
      tenantId: id,
      action: 'tenant.status_changed',
      resourceType: 'Tenant',
      resourceId: id,
      oldValue: { status: tenant.status },
      newValue: { status: updated.status },
    });
    return updated;
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
