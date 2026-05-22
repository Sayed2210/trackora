import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, SubscriptionStatus, TenantStatus } from '@prisma/client';
import { PlatformSubscriptionsRepository } from '../repositories/platform-subscriptions.repository';
import { PlatformSubscriptionsService } from '../services/platform-subscriptions.service';

const subscriptionId = '123e4567-e89b-42d3-a456-426614174000';
const tenantId = '123e4567-e89b-42d3-a456-426614174001';
const planId = '123e4567-e89b-42d3-a456-426614174002';

const mockSubscription = {
  id: subscriptionId,
  tenantId,
  planId,
  status: SubscriptionStatus.ACTIVE,
  paymentStatus: PaymentStatus.PAID,
  trialStartsAt: null,
  trialEndsAt: null,
  currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
  renewedAt: new Date('2026-05-01T00:00:00.000Z'),
  cancelledAt: null,
  pausedAt: null,
  metadata: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  tenant: {
    id: tenantId,
    name: 'Cairo Express',
    slug: 'cairo-express',
    status: TenantStatus.ACTIVE,
  },
  plan: {
    id: planId,
    name: 'Growth',
    slug: 'growth',
    monthlyPrice: new Prisma.Decimal('4999.00'),
    currency: 'EGP',
    monthlyShipmentLimit: 10000,
    adminUserLimit: 10,
    merchantLimit: 100,
    courierLimit: 50,
    isActive: true,
    archivedAt: null,
  },
};

describe('PlatformSubscriptionsService', () => {
  let service: PlatformSubscriptionsService;
  let repository: jest.Mocked<PlatformSubscriptionsRepository>;

  beforeEach(() => {
    repository = {
      findMany: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      findPlanById: jest.fn(),
      update: jest.fn(),
      changePlan: jest.fn(),
      getUsage: jest.fn(),
      toOrderBy: jest.fn().mockReturnValue({ createdAt: 'desc' }),
    } as unknown as jest.Mocked<PlatformSubscriptionsRepository>;

    service = new PlatformSubscriptionsService(repository);
  });

  it('lists subscriptions with filters and pagination', async () => {
    repository.findMany.mockResolvedValueOnce([mockSubscription] as any);
    repository.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      search: 'cairo',
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PAID,
      planId,
      page: 2,
      limit: 10,
    });

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
        planId,
        tenant: expect.any(Object),
      }),
      { createdAt: 'desc' },
      10,
      10,
    );
    expect(result).toMatchObject({ total: 1, page: 2, limit: 10 });
    expect(result.data[0].plan.monthlyPrice).toBe('4999');
  });

  it('returns subscription details with usage', async () => {
    const usage = {
      shipments: { used: 5, limit: 10000, remaining: 9995, exceeded: false },
      admins: { used: 2, limit: 10, remaining: 8, exceeded: false },
      merchants: { used: 1, limit: 100, remaining: 99, exceeded: false },
      couriers: { used: 4, limit: 50, remaining: 46, exceeded: false },
    };
    repository.findById.mockResolvedValueOnce(mockSubscription as any);
    repository.getUsage.mockResolvedValueOnce(usage);

    const result = await service.findById(subscriptionId);

    expect(repository.getUsage).toHaveBeenCalledWith(mockSubscription);
    expect(result).toMatchObject({ id: subscriptionId, usage });
  });

  it('throws 404 for missing subscription', async () => {
    repository.findById.mockResolvedValueOnce(null);

    await expect(service.findById(subscriptionId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects invalid status transition', async () => {
    repository.findById.mockResolvedValueOnce({
      ...mockSubscription,
      status: SubscriptionStatus.CANCELLED,
    } as any);

    await expect(
      service.update(subscriptionId, {
        reason: 'reactivate cancelled account',
        status: SubscriptionStatus.ACTIVE,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects invalid period date range', async () => {
    repository.findById.mockResolvedValueOnce(mockSubscription as any);

    await expect(
      service.update(subscriptionId, {
        reason: 'fix dates',
        currentPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('changes plan when target plan is active', async () => {
    repository.findById.mockResolvedValueOnce(mockSubscription as any);
    repository.findPlanById.mockResolvedValueOnce({
      id: planId,
      isActive: true,
      archivedAt: null,
    } as any);
    repository.changePlan.mockResolvedValueOnce(mockSubscription as any);

    const result = await service.changePlan(subscriptionId, {
      planId,
      reason: 'upgrade tenant',
    });

    expect(repository.changePlan).toHaveBeenCalledWith(
      subscriptionId,
      planId,
      undefined,
    );
    expect(result.id).toBe(subscriptionId);
  });

  it('throws 404 when target plan is missing', async () => {
    repository.findById.mockResolvedValueOnce(mockSubscription as any);
    repository.findPlanById.mockResolvedValueOnce(null);

    await expect(
      service.changePlan(subscriptionId, { planId, reason: 'upgrade tenant' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects archived target plan', async () => {
    repository.findById.mockResolvedValueOnce(mockSubscription as any);
    repository.findPlanById.mockResolvedValueOnce({
      id: planId,
      isActive: false,
      archivedAt: new Date(),
    } as any);

    await expect(
      service.changePlan(subscriptionId, { planId, reason: 'upgrade tenant' }),
    ).rejects.toThrow(ConflictException);
  });

  it('cancels subscription without deleting history', async () => {
    repository.findById.mockResolvedValueOnce(mockSubscription as any);
    repository.update.mockResolvedValueOnce({
      ...mockSubscription,
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date('2026-05-10T00:00:00.000Z'),
    } as any);

    const result = await service.cancel(subscriptionId, { reason: 'tenant churn' });

    expect(repository.update).toHaveBeenCalledWith(
      subscriptionId,
      expect.objectContaining({ status: SubscriptionStatus.CANCELLED }),
    );
    expect(result.status).toBe(SubscriptionStatus.CANCELLED);
  });

  it('renews subscription and defaults payment status to PAID', async () => {
    repository.findById.mockResolvedValueOnce(mockSubscription as any);
    repository.update.mockResolvedValueOnce({
      ...mockSubscription,
      currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
    } as any);

    await service.renew(subscriptionId, {
      reason: 'paid renewal',
      currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(repository.update).toHaveBeenCalledWith(
      subscriptionId,
      expect.objectContaining({
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
      }),
    );
  });
});
