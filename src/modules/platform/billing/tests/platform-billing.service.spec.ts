import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
} from '@prisma/client';
import { BillingExportFormat } from '../dtos';
import { PlatformBillingRepository } from '../repositories/platform-billing.repository';
import { PlatformBillingService } from '../services/platform-billing.service';

const tenantId = '123e4567-e89b-42d3-a456-426614174001';
const invoiceId = '123e4567-e89b-42d3-a456-426614174000';
const now = new Date('2026-05-01T00:00:00.000Z');

const invoice = {
  id: invoiceId,
  tenantId,
  subscriptionId: null,
  invoiceNumber: null,
  amount: new Prisma.Decimal('1500.50'),
  currency: 'EGP',
  status: PaymentStatus.PENDING,
  periodStart: now,
  periodEnd: new Date('2026-05-31T00:00:00.000Z'),
  issuedAt: now,
  dueAt: new Date('2026-06-05T00:00:00.000Z'),
  paidAt: null,
  notes: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
  tenant: {
    id: tenantId,
    name: 'Acme',
    slug: 'acme',
    status: TenantStatus.ACTIVE,
  },
  subscription: null,
};

describe('PlatformBillingService', () => {
  let service: PlatformBillingService;
  let repository: jest.Mocked<PlatformBillingRepository>;

  beforeEach(() => {
    repository = {
      getOverviewAggregates: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      findTenantById: jest.fn(),
      findCurrentSubscription: jest.fn(),
      createInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      getTenantInvoiceTotals: jest.fn(),
      toOrderBy: jest.fn().mockReturnValue({ createdAt: 'desc' }),
    } as unknown as jest.Mocked<PlatformBillingRepository>;
    service = new PlatformBillingService(repository);
  });

  it('returns overview with Decimal-safe strings and recent invoices', async () => {
    repository.getOverviewAggregates.mockResolvedValueOnce({
      total: 3,
      paid: 1,
      unpaid: 2,
      pastDue: 1,
      paidAmount: { _sum: { amount: new Prisma.Decimal('1000') } },
      unpaidAmount: { _sum: { amount: new Prisma.Decimal('500.25') } },
      pastDueAmount: { _sum: { amount: new Prisma.Decimal('250.25') } },
      pastDueSubscriptions: [
        {
          id: 'sub-id',
          status: SubscriptionStatus.PAST_DUE,
          paymentStatus: PaymentStatus.PAST_DUE,
          currentPeriodEnd: now,
          tenant: invoice.tenant,
          plan: {
            id: 'plan-id',
            name: 'Growth',
            slug: 'growth',
            currency: 'EGP',
          },
        },
      ],
      recentInvoices: [invoice],
    } as any);

    await expect(service.getOverview()).resolves.toEqual(
      expect.objectContaining({
        totalManualInvoices: 3,
        totalPaidAmount: '1000',
        totalUnpaidAmount: '500.25',
        totalPastDueAmount: '250.25',
        currency: 'EGP',
        recentInvoices: [expect.objectContaining({ amount: '1500.5' })],
      }),
    );
  });

  it('lists invoices with pagination and filters', async () => {
    repository.findMany.mockResolvedValueOnce([invoice]);
    repository.count.mockResolvedValueOnce(1);

    const result = await service.findInvoices({
      tenantId,
      status: PaymentStatus.PENDING,
      page: 2,
      limit: 10,
    });

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, status: PaymentStatus.PENDING }),
      { createdAt: 'desc' },
      10,
      10,
    );
    expect(result).toEqual(
      expect.objectContaining({ total: 1, page: 2, limit: 10 }),
    );
  });

  it('rejects invalid amount on create', async () => {
    await expect(
      service.createInvoice({ tenantId, amount: '0', reason: 'billing' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 404 when creating invoice for missing tenant', async () => {
    repository.createInvoice.mockResolvedValueOnce(null);

    await expect(
      service.createInvoice({ tenantId, amount: '100', reason: 'billing' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 404 when updating missing invoice', async () => {
    repository.updateInvoice.mockResolvedValueOnce(null);

    await expect(
      service.updateInvoice(invoiceId, { amount: '100', reason: 'correction' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns tenant billing summary shape', async () => {
    repository.findTenantById.mockResolvedValueOnce({
      id: tenantId,
      name: 'Acme',
      slug: 'acme',
      status: TenantStatus.ACTIVE,
      currentPlan: null,
    } as any);
    repository.findCurrentSubscription.mockResolvedValueOnce({
      id: 'sub-id',
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PAID,
      currentPeriodStart: now,
      currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
      renewedAt: now,
      plan: {
        id: 'plan-id',
        name: 'Growth',
        slug: 'growth',
        monthlyPrice: new Prisma.Decimal('999'),
        currency: 'EGP',
        isActive: true,
      },
    } as any);
    repository.getTenantInvoiceTotals.mockResolvedValueOnce({
      summary: [
        {
          status: PaymentStatus.PENDING,
          _count: { _all: 1 },
          _sum: { amount: new Prisma.Decimal('1500.50') },
        },
      ],
      unpaidAmount: { _sum: { amount: new Prisma.Decimal('1500.50') } },
      pastDueAmount: { _sum: { amount: null } },
      recentInvoices: [invoice],
    });

    await expect(service.getTenantBilling(tenantId)).resolves.toEqual(
      expect.objectContaining({
        tenant: expect.objectContaining({ id: tenantId }),
        currentPlan: expect.objectContaining({ monthlyPrice: '999' }),
        unpaidAmount: '1500.5',
        pastDueAmount: '0',
      }),
    );
  });

  it('exports JSON or CSV shapes', async () => {
    repository.findMany.mockResolvedValue([invoice]);

    await expect(
      service.exportInvoices({ from: now, to: now }),
    ).resolves.toEqual([
      expect.objectContaining({ tenantName: 'Acme', amount: '1500.5' }),
    ]);
    await expect(
      service.exportInvoices({
        from: now,
        to: now,
        format: BillingExportFormat.CSV,
      }),
    ).resolves.toContain('tenantName');
  });
});
