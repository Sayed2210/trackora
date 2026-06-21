import {
  Prisma,
  PaymentStatus,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
  FeatureFlagKey,
} from '@prisma/client';
import { TenantsService } from '@modules/tenants/services/tenants.service';
import { PlatformBillingService } from '@modules/platform/billing/services/platform-billing.service';
import { PlatformFeatureFlagsService } from '@modules/platform/feature-flags/services/platform-feature-flags.service';
import { PlatformPlansService } from '@modules/platform/plans/services/platform-plans.service';
import { PlatformSubscriptionsService } from '@modules/platform/subscriptions/services/platform-subscriptions.service';

const id = '123e4567-e89b-42d3-a456-426614174000';
const tenantId = '123e4567-e89b-42d3-a456-426614174001';
const audit = {
  user: { userId: id, role: UserRole.PLATFORM_ADMIN, permissions: [] },
};

describe('platform audit log integrations', () => {
  it('writes audit log for tenant status changes', async () => {
    const auditLogService = { writeAuditLog: jest.fn() };
    const repo = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: tenantId, status: TenantStatus.ACTIVE }),
      update: jest
        .fn()
        .mockResolvedValue({ id: tenantId, status: TenantStatus.SUSPENDED }),
    };
    const service = new TenantsService(repo as any, auditLogService as any);

    await service.changeStatus(
      tenantId,
      { status: TenantStatus.SUSPENDED },
      audit,
    );

    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.status_changed',
        resourceType: 'Tenant',
        tenantId,
      }),
    );
  });

  it('writes audit log for plan updates', async () => {
    const auditLogService = { writeAuditLog: jest.fn() };
    const plan = {
      id,
      name: 'Growth',
      slug: 'growth',
      monthlyPrice: new Prisma.Decimal('999'),
      currency: 'EGP',
      featureFlags: [],
      _count: { subscriptions: 0 },
    };
    const repo = {
      findById: jest.fn().mockResolvedValue(plan),
      findByName: jest.fn().mockResolvedValue(null),
      findBySlug: jest.fn().mockResolvedValue(null),
      updateWithFlags: jest.fn().mockResolvedValue({ ...plan, name: 'Scale' }),
    };
    const service = new PlatformPlansService(
      repo as any,
      auditLogService as any,
    );

    await service.update(id, { name: 'Scale' }, audit);

    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'plan.updated',
        resourceType: 'Plan',
        resourceId: id,
      }),
    );
  });

  it('writes audit log for subscription mutations', async () => {
    const auditLogService = { writeAuditLog: jest.fn() };
    const subscription = {
      id,
      tenantId,
      planId: id,
      tenant: {
        id: tenantId,
        name: 'Acme',
        slug: 'acme',
        status: TenantStatus.ACTIVE,
      },
      plan: {
        id,
        name: 'Growth',
        slug: 'growth',
        monthlyPrice: new Prisma.Decimal('999'),
        currency: 'EGP',
      },
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PENDING,
    };
    const repo = {
      findById: jest.fn().mockResolvedValue(subscription),
      update: jest.fn().mockResolvedValue({
        ...subscription,
        paymentStatus: PaymentStatus.PAID,
      }),
    };
    const service = new PlatformSubscriptionsService(
      repo as any,
      auditLogService as any,
    );

    await service.update(
      id,
      { paymentStatus: PaymentStatus.PAID, reason: 'paid' },
      audit,
    );

    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subscription.updated',
        tenantId,
        reason: 'paid',
      }),
    );
  });

  it('writes audit log for feature flag mutations', async () => {
    const auditLogService = { writeAuditLog: jest.fn() };
    const tenant = {
      id: tenantId,
      status: TenantStatus.ACTIVE,
      currentPlan: null,
      featureFlags: [],
    };
    const repo = {
      findTenantWithFlags: jest.fn().mockResolvedValue(tenant),
      updateTenantOverride: jest.fn().mockResolvedValue({
        ...tenant,
        featureFlags: [
          { tenantId, featureKey: FeatureFlagKey.api_access, enabled: true },
        ],
      }),
      findGlobalFlags: jest.fn().mockResolvedValue([]),
    };
    const service = new PlatformFeatureFlagsService(
      repo as any,
      auditLogService as any,
    );

    await service.updateTenantFlag(
      tenantId,
      FeatureFlagKey.api_access,
      { enabled: true, reason: 'launch' },
      id,
      audit,
    );

    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feature_flag.tenant_override_changed',
        tenantId,
        reason: 'launch',
      }),
    );
  });

  it('writes audit log for billing invoice create and update', async () => {
    const auditLogService = { writeAuditLog: jest.fn() };
    const invoice = {
      id,
      tenant: {
        id: tenantId,
        name: 'Acme',
        slug: 'acme',
        status: TenantStatus.ACTIVE,
      },
      amount: new Prisma.Decimal('100'),
      currency: 'EGP',
      status: PaymentStatus.PENDING,
      periodStart: null,
      periodEnd: null,
      dueAt: null,
      paidAt: null,
      createdAt: new Date(),
    };
    const repo = {
      createInvoice: jest.fn().mockResolvedValue(invoice),
      findById: jest.fn().mockResolvedValue(invoice),
      updateInvoice: jest
        .fn()
        .mockResolvedValue({ ...invoice, status: PaymentStatus.PAID }),
    };
    const service = new PlatformBillingService(
      repo as any,
      auditLogService as any,
    );

    await service.createInvoice(
      { tenantId, amount: '100', reason: 'manual' },
      audit,
    );
    await service.updateInvoice(
      id,
      { status: PaymentStatus.PAID, reason: 'paid' },
      audit,
    );

    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'manual_invoice.created',
        reason: 'manual',
      }),
    );
    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'manual_invoice.updated',
        reason: 'paid',
      }),
    );
  });
});
