import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import {
  CancelSubscriptionDto,
  ChangeSubscriptionPlanDto,
  ListSubscriptionsQueryDto,
  RenewSubscriptionDto,
  UpdateSubscriptionDto,
} from '../dtos';
import {
  PlatformSubscriptionsRepository,
  PlatformSubscriptionWithDetails,
  UsageSnapshot,
} from '../repositories/platform-subscriptions.repository';

const ALLOWED_STATUS_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SubscriptionStatus.TRIALING]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
  [SubscriptionStatus.ACTIVE]: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.PAUSED, SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
  [SubscriptionStatus.PAST_DUE]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED, SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
  [SubscriptionStatus.PAUSED]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.CANCELLED]: [],
  [SubscriptionStatus.EXPIRED]: [],
};

@Injectable()
export class PlatformSubscriptionsService {
  constructor(private readonly subscriptionsRepository: PlatformSubscriptionsRepository) {}

  async findAll(query: ListSubscriptionsQueryDto) {
    this.assertDateRange(query.renewalFrom, query.renewalTo, 'Renewal end date must be after start date');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.SubscriptionWhereInput = {};

    if (query.status !== undefined) where.status = query.status;
    if (query.paymentStatus !== undefined) where.paymentStatus = query.paymentStatus;
    if (query.planId !== undefined) where.planId = query.planId;
    if (query.tenantId !== undefined) where.tenantId = query.tenantId;
    if (query.renewalFrom || query.renewalTo) {
      where.currentPeriodEnd = {
        gte: query.renewalFrom,
        lte: query.renewalTo,
      };
    }
    if (query.search) {
      where.tenant = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [subscriptions, total] = await Promise.all([
      this.subscriptionsRepository.findMany(
        where,
        this.subscriptionsRepository.toOrderBy(query.sortBy, query.sortDirection),
        skip,
        limit,
      ),
      this.subscriptionsRepository.count(where),
    ]);

    return {
      data: subscriptions.map((subscription) => this.toResponse(subscription)),
      total,
      page,
      limit,
    };
  }

  async findById(id: string) {
    const subscription = await this.getSubscriptionOrThrow(id);
    return this.toResponse(
      subscription,
      await this.subscriptionsRepository.getUsage(subscription),
    );
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const subscription = await this.getSubscriptionOrThrow(id);
    const nextStatus = dto.status ?? subscription.status;
    this.assertStatusTransition(subscription.status, nextStatus);
    this.assertDateRange(
      dto.trialStartsAt ?? subscription.trialStartsAt ?? undefined,
      dto.trialEndsAt ?? subscription.trialEndsAt ?? undefined,
      'Trial end date must be after start date',
    );
    this.assertDateRange(
      dto.currentPeriodStart ?? subscription.currentPeriodStart ?? undefined,
      dto.currentPeriodEnd ?? subscription.currentPeriodEnd ?? undefined,
      'Current period end date must be after start date',
    );

    // TODO(audit): write subscription mutation with reason and before/after values once audit writer exists.
    const updated = await this.subscriptionsRepository.update(id, {
      status: dto.status,
      paymentStatus: dto.paymentStatus,
      trialStartsAt: dto.trialStartsAt,
      trialEndsAt: dto.trialEndsAt,
      currentPeriodStart: dto.currentPeriodStart,
      currentPeriodEnd: dto.currentPeriodEnd,
      renewedAt: dto.renewedAt,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      cancelledAt: dto.status === SubscriptionStatus.CANCELLED ? new Date() : undefined,
      pausedAt: dto.status === SubscriptionStatus.PAUSED ? new Date() : undefined,
    });
    return this.toResponse(updated);
  }

  async changePlan(id: string, dto: ChangeSubscriptionPlanDto) {
    await this.getSubscriptionOrThrow(id);
    const plan = await this.subscriptionsRepository.findPlanById(dto.planId);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    if (!plan.isActive || plan.archivedAt) {
      throw new ConflictException('Target plan is not active');
    }

    // MVP behavior: plan changes immediately. TODO(usage): resetUsageNow is accepted for future usage ledger support.
    // TODO(audit): record reason/effectiveDate once audit writer exists.
    const updated = await this.subscriptionsRepository.changePlan(
      id,
      dto.planId,
      dto.effectiveDate,
    );
    return this.toResponse(updated);
  }

  async cancel(id: string, dto: CancelSubscriptionDto) {
    const subscription = await this.getSubscriptionOrThrow(id);
    this.assertStatusTransition(subscription.status, SubscriptionStatus.CANCELLED);
    const cancelNow = !dto.cancelAtPeriodEnd;

    // Schema has no scheduled cancellation field; cancelAtPeriodEnd stores intent in metadata until billing phase.
    const updated = await this.subscriptionsRepository.update(id, {
      status: cancelNow ? SubscriptionStatus.CANCELLED : subscription.status,
      cancelledAt: cancelNow ? new Date() : undefined,
      metadata: {
        ...(this.asObject(subscription.metadata)),
        cancellation: {
          reason: dto.reason,
          cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false,
          requestedAt: new Date().toISOString(),
        },
      },
    });
    return this.toResponse(updated);
  }

  async renew(id: string, dto: RenewSubscriptionDto) {
    const subscription = await this.getSubscriptionOrThrow(id);
    this.assertDateRange(
      dto.currentPeriodStart ?? subscription.currentPeriodStart ?? undefined,
      dto.currentPeriodEnd,
      'Current period end date must be after start date',
    );

    // TODO(audit): record renewal reason once audit writer exists.
    const updated = await this.subscriptionsRepository.update(id, {
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: dto.paymentStatus ?? PaymentStatus.PAID,
      currentPeriodStart: dto.currentPeriodStart ?? subscription.currentPeriodStart ?? new Date(),
      currentPeriodEnd: dto.currentPeriodEnd,
      renewedAt: dto.renewalDate ?? new Date(),
    });
    return this.toResponse(updated);
  }

  private async getSubscriptionOrThrow(id: string) {
    const subscription = await this.subscriptionsRepository.findById(id);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  private assertStatusTransition(
    currentStatus: SubscriptionStatus,
    nextStatus: SubscriptionStatus,
  ): void {
    if (currentStatus === nextStatus) {
      return;
    }
    if (!ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
      throw new ConflictException(
        `Invalid subscription status transition from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  private assertDateRange(start: Date | undefined, end: Date | undefined, message: string): void {
    if (start && end && end <= start) {
      throw new BadRequestException(message);
    }
  }

  private asObject(value: Prisma.JsonValue | null): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  private toResponse(
    subscription: PlatformSubscriptionWithDetails,
    usage?: UsageSnapshot,
  ) {
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      tenant: subscription.tenant,
      plan: {
        ...subscription.plan,
        monthlyPrice: subscription.plan.monthlyPrice.toString(),
      },
      status: subscription.status,
      paymentStatus: subscription.paymentStatus,
      trialStartsAt: subscription.trialStartsAt,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      renewedAt: subscription.renewedAt,
      cancelledAt: subscription.cancelledAt,
      pausedAt: subscription.pausedAt,
      metadata: subscription.metadata,
      usage,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}
