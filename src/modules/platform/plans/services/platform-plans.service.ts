import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeatureFlagKey, Prisma } from '@prisma/client';
import {
  CreatePlanDto,
  ListPlansQueryDto,
  PlanFeatureFlagDto,
  UpdatePlanDto,
} from '../dtos';
import {
  PlatformPlanFilter,
  PlatformPlansRepository,
  PlatformPlanWithDetails,
} from '../repositories/platform-plans.repository';

const PLAN_FEATURE_KEYS = Object.values(FeatureFlagKey);

@Injectable()
export class PlatformPlansService {
  constructor(private readonly plansRepository: PlatformPlansRepository) {}

  async findAll(query: ListPlansQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: PlatformPlanFilter = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.archived !== undefined) {
      where.archivedAt = query.archived ? { not: null } : null;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [plans, total] = await Promise.all([
      this.plansRepository.findMany(
        where,
        this.plansRepository.toOrderBy(query.sortBy, query.sortDirection),
        skip,
        limit,
      ),
      this.plansRepository.count(where),
    ]);

    return {
      data: plans.map((plan) => this.toResponse(plan)),
      total,
      page,
      limit,
    };
  }

  async create(dto: CreatePlanDto) {
    await this.assertUniquePlan(dto.name, dto.slug);
    // TODO(audit): write old/new values when the platform audit writer exists.
    const plan = await this.plansRepository.createWithFlags(
      {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        monthlyPrice: new Prisma.Decimal(dto.monthlyPrice),
        currency: dto.currency ?? 'EGP',
        monthlyShipmentLimit: dto.monthlyShipmentLimit,
        adminUserLimit: dto.adminUserLimit,
        merchantLimit: dto.merchantLimit,
        courierLimit: dto.courierLimit,
      },
      this.normalizeFeatureFlags(dto.featureEntitlements),
    );
    return this.toResponse(plan);
  }

  async findById(id: string) {
    return this.toResponse(await this.getPlanOrThrow(id));
  }

  async update(id: string, dto: UpdatePlanDto) {
    const plan = await this.getPlanOrThrow(id);
    await this.assertUniquePlan(dto.name, dto.slug, id);

    const data: Prisma.PlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.monthlyPrice !== undefined) {
      data.monthlyPrice = new Prisma.Decimal(dto.monthlyPrice);
    }
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.monthlyShipmentLimit !== undefined) {
      data.monthlyShipmentLimit = dto.monthlyShipmentLimit;
    }
    if (dto.adminUserLimit !== undefined) data.adminUserLimit = dto.adminUserLimit;
    if (dto.merchantLimit !== undefined) data.merchantLimit = dto.merchantLimit;
    if (dto.courierLimit !== undefined) data.courierLimit = dto.courierLimit;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // TODO(audit): include before/after plan snapshots once audit writer exists.
    const updated = await this.plansRepository.updateWithFlags(
      plan.id,
      data,
      dto.featureEntitlements === undefined
        ? undefined
        : this.normalizeFeatureFlags(dto.featureEntitlements),
    );
    return this.toResponse(updated);
  }

  async remove(id: string) {
    const plan = await this.getPlanOrThrow(id);
    const counts = await this.plansRepository.getReferenceCounts(id);

    if (counts.subscriptions > 0 || counts.currentTenants > 0) {
      return this.toResponse(await this.plansRepository.archive(plan.id));
    }

    await this.plansRepository.delete(plan.id);
    return { deleted: true };
  }

  private async getPlanOrThrow(id: string): Promise<PlatformPlanWithDetails> {
    const plan = await this.plansRepository.findById(id);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  private async assertUniquePlan(
    name?: string,
    slug?: string,
    currentPlanId?: string,
  ): Promise<void> {
    if (name !== undefined) {
      const existingByName = await this.plansRepository.findByName(name);
      if (existingByName && existingByName.id !== currentPlanId) {
        throw new ConflictException('Plan name already exists');
      }
    }
    if (slug !== undefined) {
      const existingBySlug = await this.plansRepository.findBySlug(slug);
      if (existingBySlug && existingBySlug.id !== currentPlanId) {
        throw new ConflictException('Plan slug already exists');
      }
    }
  }

  private normalizeFeatureFlags(flags?: PlanFeatureFlagDto[]) {
    const byKey = new Map<FeatureFlagKey, boolean>();
    for (const key of PLAN_FEATURE_KEYS) {
      byKey.set(key, false);
    }
    for (const flag of flags ?? []) {
      byKey.set(flag.key, flag.enabled);
    }
    return Array.from(byKey.entries()).map(([key, enabled]) => ({ key, enabled }));
  }

  private toResponse(plan: PlatformPlanWithDetails) {
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice.toString(),
      currency: plan.currency,
      monthlyShipmentLimit: plan.monthlyShipmentLimit,
      adminUserLimit: plan.adminUserLimit,
      merchantLimit: plan.merchantLimit,
      courierLimit: plan.courierLimit,
      isActive: plan.isActive,
      archivedAt: plan.archivedAt,
      featureEntitlements: plan.featureFlags.map((flag) => ({
        key: flag.featureKey,
        enabled: flag.enabled,
      })),
      subscriptionCount: plan._count.subscriptions,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
