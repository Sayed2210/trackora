import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import {
  BillingExportFormat,
  BillingExportQueryDto,
  CreateManualInvoiceDto,
  ListInvoicesQueryDto,
  UpdateManualInvoiceDto,
} from '../dtos';
import {
  ManualInvoiceWithDetails,
  PlatformBillingRepository,
} from '../repositories/platform-billing.repository';
import {
  AuditActorContext,
  PlatformAuditLogService,
} from '@modules/platform/audit-logs/services/platform-audit-log.service';

@Injectable()
export class PlatformBillingService {
  constructor(
    private readonly billingRepository: PlatformBillingRepository,
    private readonly auditLogService: PlatformAuditLogService,
  ) {}

  async getOverview() {
    const overview = await this.billingRepository.getOverviewAggregates();
    return {
      totalManualInvoices: overview.total,
      paidInvoicesCount: overview.paid,
      unpaidInvoicesCount: overview.unpaid,
      pastDueInvoicesCount: overview.pastDue,
      totalPaidAmount: this.decimalToString(overview.paidAmount._sum.amount),
      totalUnpaidAmount: this.decimalToString(overview.unpaidAmount._sum.amount),
      totalPastDueAmount: this.decimalToString(overview.pastDueAmount._sum.amount),
      currency: 'EGP',
      tenantsWithPastDueSubscriptions: overview.pastDueSubscriptions.map((subscription) => ({
        tenant: subscription.tenant,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          paymentStatus: subscription.paymentStatus,
          renewalDate: subscription.currentPeriodEnd,
        },
        plan: subscription.plan,
      })),
      recentInvoices: overview.recentInvoices.map((invoice) => this.toInvoiceResponse(invoice)),
    };
  }

  async findInvoices(query: ListInvoicesQueryDto) {
    this.assertDateRange(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildInvoiceWhere(query);
    const [invoices, total] = await Promise.all([
      this.billingRepository.findMany(
        where,
        this.billingRepository.toOrderBy(query.sortBy, query.sortDirection),
        skip,
        limit,
      ),
      this.billingRepository.count(where),
    ]);
    return { data: invoices.map((invoice) => this.toInvoiceResponse(invoice)), total, page, limit };
  }

  async createInvoice(dto: CreateManualInvoiceDto, audit?: AuditActorContext) {
    this.assertDateRange(dto.billingPeriodStart, dto.billingPeriodEnd, 'Billing period end date must be after start date');
    const amount = this.toPositiveDecimal(dto.amount);

    const invoice = await this.billingRepository.createInvoice({
      tenantId: dto.tenantId,
      amount,
      currency: dto.currency ?? 'EGP',
      periodStart: dto.billingPeriodStart,
      periodEnd: dto.billingPeriodEnd,
      dueAt: dto.dueDate,
      notes: dto.notes,
      metadata: { reason: dto.reason },
    });
    if (!invoice) throw new NotFoundException('Tenant not found');
    await this.auditLogService?.writeAuditLog({
      ...audit,
      tenantId: invoice.tenant.id,
      action: 'manual_invoice.created',
      resourceType: 'ManualInvoice',
      resourceId: invoice.id,
      newValue: invoice,
      reason: dto.reason,
    });
    return this.toInvoiceResponse(invoice);
  }

  async updateInvoice(id: string, dto: UpdateManualInvoiceDto, audit?: AuditActorContext) {
    const amount = dto.amount === undefined ? undefined : this.toPositiveDecimal(dto.amount);
    const status = dto.paymentStatus ?? dto.status;
    const before = await this.billingRepository.findById(id);
    if (!before) throw new NotFoundException('Invoice not found');

    const invoice = await this.billingRepository.updateInvoice(id, {
      amount,
      status,
      dueAt: dto.dueDate,
      paidAt: dto.paidAt,
      notes: dto.notes,
      metadata: { reason: dto.reason },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.auditLogService?.writeAuditLog({
      ...audit,
      tenantId: invoice.tenant.id,
      action: 'manual_invoice.updated',
      resourceType: 'ManualInvoice',
      resourceId: id,
      oldValue: before,
      newValue: invoice,
      reason: dto.reason,
    });
    return this.toInvoiceResponse(invoice);
  }

  async getTenantBilling(tenantId: string) {
    const tenant = await this.billingRepository.findTenantById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    const [subscription, invoices] = await Promise.all([
      this.billingRepository.findCurrentSubscription(tenantId),
      this.billingRepository.getTenantInvoiceTotals(tenantId),
    ]);

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status },
      currentSubscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            paymentStatus: subscription.paymentStatus,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            renewedAt: subscription.renewedAt,
          }
        : null,
      currentPlan: this.toPlanResponse(subscription?.plan ?? tenant.currentPlan),
      invoiceSummary: invoices.summary.map((item) => ({
        status: item.status,
        count: item._count._all,
        amount: this.decimalToString(item._sum.amount),
      })),
      recentInvoices: invoices.recentInvoices.map((invoice) => this.toInvoiceResponse(invoice)),
      unpaidAmount: this.decimalToString(invoices.unpaidAmount._sum.amount),
      pastDueAmount: this.decimalToString(invoices.pastDueAmount._sum.amount),
      renewalDate: subscription?.currentPeriodEnd ?? null,
    };
  }

  async exportInvoices(query: BillingExportQueryDto) {
    this.assertDateRange(query.from, query.to);
    // TODO(exports): move to queued export when expected result size grows beyond in-memory API budget.
    const invoices = await this.billingRepository.findMany(
      {
        tenantId: query.tenantId,
        status: query.status,
        createdAt: { gte: query.from, lte: query.to },
      },
      { createdAt: 'desc' },
      0,
      1000,
    );
    const data = invoices.map((invoice) => ({
      tenantId: invoice.tenant.id,
      tenantName: invoice.tenant.name,
      tenantSlug: invoice.tenant.slug,
      planName: invoice.subscription?.plan?.name ?? null,
      billingPeriodStart: invoice.periodStart,
      billingPeriodEnd: invoice.periodEnd,
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      status: invoice.status,
      renewalDate: invoice.subscription?.currentPeriodEnd ?? null,
    }));
    if ((query.format ?? BillingExportFormat.JSON) === BillingExportFormat.CSV) {
      return this.toCsv(data);
    }
    return data;
  }

  private buildInvoiceWhere(query: ListInvoicesQueryDto): Prisma.ManualInvoiceWhereInput {
    const status = query.paymentStatus ?? query.status;
    const where: Prisma.ManualInvoiceWhereInput = {
      tenantId: query.tenantId,
      status,
    };
    if (query.from || query.to) {
      where.createdAt = { gte: query.from, lte: query.to };
    }
    if (query.search) {
      where.tenant = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }
    return where;
  }

  private toInvoiceResponse(invoice: ManualInvoiceWithDetails) {
    return {
      id: invoice.id,
      tenant: invoice.tenant,
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      status: invoice.status,
      paymentStatus: invoice.status,
      billingPeriodStart: invoice.periodStart,
      billingPeriodEnd: invoice.periodEnd,
      dueDate: invoice.dueAt,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
    };
  }

  private toPlanResponse(plan?: { id: string; name: string; slug: string; monthlyPrice?: Prisma.Decimal; currency: string; isActive?: boolean } | null) {
    if (!plan) return null;
    return {
      ...plan,
      monthlyPrice: plan.monthlyPrice?.toString(),
    };
  }

  private toPositiveDecimal(value: string) {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lte(0)) throw new BadRequestException('Amount must be positive');
    return decimal;
  }

  private assertDateRange(start?: Date, end?: Date, message = 'Date range start must be before end'): void {
    if (start && end && end < start) throw new BadRequestException(message);
  }

  private decimalToString(value: Prisma.Decimal | null | undefined) {
    return (value ?? new Prisma.Decimal(0)).toString();
  }

  private toCsv(rows: Array<Record<string, unknown>>) {
    const columns = ['tenantId', 'tenantName', 'tenantSlug', 'planName', 'billingPeriodStart', 'billingPeriodEnd', 'amount', 'currency', 'status', 'renewalDate'];
    const values = rows.map((row) => columns.map((column) => this.csvValue(row[column])).join(','));
    return [columns.join(','), ...values].join('\n');
  }

  private csvValue(value: unknown) {
    if (value === null || value === undefined) return '';
    const stringValue = value instanceof Date ? value.toISOString() : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
}
