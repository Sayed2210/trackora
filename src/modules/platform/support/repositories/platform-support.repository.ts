import { Injectable } from '@nestjs/common';
import { ImpersonationStatus, PaymentStatus, Prisma, TenantStatus, UserRole } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';

export type SupportTenantWithDetails = Prisma.TenantGetPayload<{
  include: {
    currentPlan: { select: { id: true; name: true; slug: true; currency: true } };
    subscriptions: {
      select: { id: true; status: true; paymentStatus: true; currentPeriodEnd: true };
    };
  };
}>;

export type ImpersonationSessionWithDetails = Prisma.ImpersonationSessionGetPayload<{
  include: {
    tenant: { select: { id: true; name: true; slug: true; status: true } };
    targetUser: { select: { id: true; name: true; phone: true; email: true; role: true; tenantId: true; isActive: true } };
  };
}>;

@Injectable()
export class PlatformSupportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTenants(where: Prisma.TenantWhereInput, skip: number, take: number): Promise<SupportTenantWithDetails[]> {
    return this.prisma.tenant.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        currentPlan: { select: { id: true, name: true, slug: true, currency: true } },
        subscriptions: {
          take: 1,
          orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, status: true, paymentStatus: true, currentPeriodEnd: true },
        },
      },
    });
  }

  async countTenants(where: Prisma.TenantWhereInput) {
    return this.prisma.tenant.count({ where });
  }

  async findTenantById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: {
        currentPlan: { include: { featureFlags: true } },
        subscriptions: {
          take: 1,
          orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
          include: { plan: true },
        },
        featureFlags: true,
      },
    });
  }

  async findTenantUser(tenantId: string, userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: { id: true, name: true, phone: true, email: true, role: true, tenantId: true, isActive: true },
    });
  }

  async findDefaultTenantUser(tenantId: string) {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        isActive: true,
        role: { in: [UserRole.SUPER_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FINANCE_ADMIN, UserRole.MERCHANT] },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, phone: true, email: true, role: true, tenantId: true, isActive: true },
    });
  }

  async createImpersonationSession(data: Prisma.ImpersonationSessionUncheckedCreateInput): Promise<ImpersonationSessionWithDetails> {
    return this.prisma.impersonationSession.create({
      data,
      include: this.sessionInclude,
    });
  }

  async findSessionById(id: string): Promise<ImpersonationSessionWithDetails | null> {
    return this.prisma.impersonationSession.findUnique({ where: { id }, include: this.sessionInclude });
  }

  async findActiveSessionForActor(actorUserId: string) {
    return this.prisma.impersonationSession.findFirst({
      where: { actorUserId, status: ImpersonationStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
      include: this.sessionInclude,
    });
  }

  async endSession(id: string, status: ImpersonationStatus) {
    return this.prisma.impersonationSession.update({
      where: { id },
      data: { status, endedAt: new Date() },
      include: this.sessionInclude,
    });
  }

  async getTenantHealthCounts(tenantId: string, periodStart?: Date, periodEnd?: Date) {
    const shipmentWhere: Prisma.ShipmentWhereInput = { tenantId };
    if (periodStart || periodEnd) shipmentWhere.createdAt = { gte: periodStart, lte: periodEnd };
    const [shipments, admins, merchants, couriers, unpaidInvoices, pastDueInvoices, recentAuditLogs] = await Promise.all([
      this.prisma.shipment.count({ where: shipmentWhere }),
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
      this.prisma.merchant.count({ where: { tenantId } }),
      this.prisma.courier.count({ where: { tenantId } }),
      this.prisma.manualInvoice.aggregate({ where: { tenantId, status: { not: PaymentStatus.PAID } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.manualInvoice.aggregate({ where: { tenantId, status: PaymentStatus.PAST_DUE }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    return { shipments, admins, merchants, couriers, unpaidInvoices, pastDueInvoices, recentAuditLogs };
  }

  buildTenantSearchWhere(search?: string, status?: TenantStatus): Prisma.TenantWhereInput {
    const where: Prisma.TenantWhereInput = { status };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { users: { some: { email: { contains: search, mode: 'insensitive' } } } },
        { users: { some: { phone: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    return where;
  }

  private get sessionInclude() {
    return {
      tenant: { select: { id: true, name: true, slug: true, status: true } },
      targetUser: { select: { id: true, name: true, phone: true, email: true, role: true, tenantId: true, isActive: true } },
    } satisfies Prisma.ImpersonationSessionInclude;
  }
}
