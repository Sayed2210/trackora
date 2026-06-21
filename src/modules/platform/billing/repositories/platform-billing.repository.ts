import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { InvoiceSortField, SortDirection } from '../dtos';

export type ManualInvoiceWithDetails = Prisma.ManualInvoiceGetPayload<{
  include: {
    tenant: { select: { id: true; name: true; slug: true; status: true } };
    subscription: {
      select: {
        id: true;
        status: true;
        paymentStatus: true;
        currentPeriodEnd: true;
        plan: { select: { id: true; name: true; slug: true; currency: true } };
      };
    };
  };
}>;

@Injectable()
export class PlatformBillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOverviewAggregates() {
    const [
      total,
      paid,
      unpaid,
      pastDue,
      paidAmount,
      unpaidAmount,
      pastDueAmount,
      pastDueSubscriptions,
      recentInvoices,
    ] = await Promise.all([
      this.prisma.manualInvoice.count(),
      this.prisma.manualInvoice.count({
        where: { status: PaymentStatus.PAID },
      }),
      this.prisma.manualInvoice.count({
        where: { status: { not: PaymentStatus.PAID } },
      }),
      this.prisma.manualInvoice.count({
        where: { status: PaymentStatus.PAST_DUE },
      }),
      this.prisma.manualInvoice.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.manualInvoice.aggregate({
        where: { status: { not: PaymentStatus.PAID } },
        _sum: { amount: true },
      }),
      this.prisma.manualInvoice.aggregate({
        where: { status: PaymentStatus.PAST_DUE },
        _sum: { amount: true },
      }),
      this.prisma.subscription.findMany({
        where: { status: SubscriptionStatus.PAST_DUE },
        take: 10,
        orderBy: { currentPeriodEnd: 'asc' },
        include: {
          tenant: {
            select: { id: true, name: true, slug: true, status: true },
          },
          plan: {
            select: { id: true, name: true, slug: true, currency: true },
          },
        },
      }),
      this.findMany({}, { createdAt: 'desc' }, 0, 5),
    ]);
    return {
      total,
      paid,
      unpaid,
      pastDue,
      paidAmount,
      unpaidAmount,
      pastDueAmount,
      pastDueSubscriptions,
      recentInvoices,
    };
  }

  async findMany(
    where: Prisma.ManualInvoiceWhereInput,
    orderBy: Prisma.ManualInvoiceOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<ManualInvoiceWithDetails[]> {
    return this.prisma.manualInvoice.findMany({
      where,
      orderBy,
      skip,
      take,
      include: this.includeDetails,
    });
  }

  async count(where: Prisma.ManualInvoiceWhereInput): Promise<number> {
    return this.prisma.manualInvoice.count({ where });
  }

  async findById(id: string): Promise<ManualInvoiceWithDetails | null> {
    return this.prisma.manualInvoice.findUnique({
      where: { id },
      include: this.includeDetails,
    });
  }

  async findTenantById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: {
        currentPlan: {
          select: {
            id: true,
            name: true,
            slug: true,
            monthlyPrice: true,
            currency: true,
            isActive: true,
          },
        },
      },
    });
  }

  async findCurrentSubscription(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            monthlyPrice: true,
            currency: true,
            isActive: true,
          },
        },
      },
    });
  }

  async createInvoice(data: Prisma.ManualInvoiceUncheckedCreateInput) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: data.tenantId },
      });
      if (!tenant) return null;
      const subscription = await tx.subscription.findFirst({
        where: { tenantId: data.tenantId },
        orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
      });
      const invoice = await tx.manualInvoice.create({
        data: {
          ...data,
          subscriptionId: data.subscriptionId ?? subscription?.id,
        },
      });
      return tx.manualInvoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: this.includeDetails,
      });
    });
  }

  async updateInvoice(id: string, data: Prisma.ManualInvoiceUpdateInput) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.manualInvoice.findUnique({ where: { id } });
      if (!existing) return null;
      await tx.manualInvoice.update({ where: { id }, data });
      return tx.manualInvoice.findUniqueOrThrow({
        where: { id },
        include: this.includeDetails,
      });
    });
  }

  async getTenantInvoiceTotals(tenantId: string) {
    const [summary, unpaidAmount, pastDueAmount, recentInvoices] =
      await Promise.all([
        this.prisma.manualInvoice.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        this.prisma.manualInvoice.aggregate({
          where: { tenantId, status: { not: PaymentStatus.PAID } },
          _sum: { amount: true },
        }),
        this.prisma.manualInvoice.aggregate({
          where: { tenantId, status: PaymentStatus.PAST_DUE },
          _sum: { amount: true },
        }),
        this.findMany({ tenantId }, { createdAt: 'desc' }, 0, 10),
      ]);
    return { summary, unpaidAmount, pastDueAmount, recentInvoices };
  }

  toOrderBy(
    sortBy: InvoiceSortField = InvoiceSortField.CREATED_AT,
    direction: SortDirection = SortDirection.DESC,
  ): Prisma.ManualInvoiceOrderByWithRelationInput {
    if (sortBy === InvoiceSortField.DUE_DATE) return { dueAt: direction };
    if (sortBy === InvoiceSortField.AMOUNT) return { amount: direction };
    if (sortBy === InvoiceSortField.STATUS) return { status: direction };
    return { createdAt: direction };
  }

  private get includeDetails() {
    return {
      tenant: { select: { id: true, name: true, slug: true, status: true } },
      subscription: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          currentPeriodEnd: true,
          plan: {
            select: { id: true, name: true, slug: true, currency: true },
          },
        },
      },
    } satisfies Prisma.ManualInvoiceInclude;
  }
}
