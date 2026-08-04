import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ImpersonationStatus,
  Prisma,
  TenantStatus,
  UserRole,
} from '@prisma/client';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { TokenPayload } from '@modules/auth/entities/auth.entity';
import { PlatformAuditLogService } from '@modules/platform/audit-logs/services/platform-audit-log.service';
import {
  EndImpersonationDto,
  SearchSupportTenantsQueryDto,
  StartImpersonationDto,
} from '../dtos';
import {
  PlatformSupportRepository,
  SupportTenantWithDetails,
} from '../repositories/platform-support.repository';

export interface SupportAuditContext {
  user: AuthenticatedRequestUser;
  ipAddress?: string;
  userAgent?: string;
}

const DEFAULT_DURATION_MINUTES = 30;
const MAX_DURATION_MINUTES = 60;

@Injectable()
export class PlatformSupportService {
  constructor(
    private readonly supportRepository: PlatformSupportRepository,
    private readonly auditLogService: PlatformAuditLogService,
    private readonly jwtService: JwtService,
  ) {}

  async searchTenants(query: SearchSupportTenantsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.supportRepository.buildTenantSearchWhere(
      query.search,
      query.status,
    );
    const [tenants, total] = await Promise.all([
      this.supportRepository.findTenants(where, skip, limit),
      this.supportRepository.countTenants(where),
    ]);
    return {
      data: tenants.map((tenant) => this.toTenantSearchResponse(tenant)),
      total,
      page,
      limit,
    };
  }

  async getTenantHealth(tenantId: string, canViewAuditLogs = false) {
    const tenant = await this.supportRepository.findTenantById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    const subscription = tenant.subscriptions[0] ?? null;
    const plan = subscription?.plan ?? tenant.currentPlan;
    const counts = await this.supportRepository.getTenantHealthCounts(
      tenantId,
      subscription?.currentPeriodStart ?? undefined,
      subscription?.currentPeriodEnd ?? undefined,
    );

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        createdAt: tenant.createdAt,
      },
      status: tenant.status,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            paymentStatus: subscription.paymentStatus,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
            monthlyPrice: plan.monthlyPrice?.toString(),
            currency: plan.currency,
          }
        : null,
      usageSummary: {
        shipments: this.toUsage(
          counts.shipments,
          plan?.monthlyShipmentLimit ?? null,
        ),
        admins: this.toUsage(counts.admins, plan?.adminUserLimit ?? null),
        merchants: this.toUsage(counts.merchants, plan?.merchantLimit ?? null),
        couriers: this.toUsage(counts.couriers, plan?.courierLimit ?? null),
      },
      featureFlagsSummary: {
        overrideCount: tenant.featureFlags.length,
        planFlagCount: tenant.currentPlan?.featureFlags.length ?? 0,
      },
      billingStatusSummary: {
        unpaidInvoicesCount: counts.unpaidInvoices._count._all,
        unpaidAmount: this.decimalToString(counts.unpaidInvoices._sum.amount),
        pastDueInvoicesCount: counts.pastDueInvoices._count._all,
        pastDueAmount: this.decimalToString(counts.pastDueInvoices._sum.amount),
      },
      recentPlatformAuditLogs: canViewAuditLogs
        ? counts.recentAuditLogs.map((log) => ({
            id: log.id,
            action: log.action,
            resourceType: log.resourceType ?? log.entityType,
            resourceId: log.resourceId ?? log.entityId,
            reason: log.reason,
            createdAt: log.createdAt,
          }))
        : [],
      healthIndicators: {
        active:
          tenant.status === TenantStatus.ACTIVE ||
          tenant.status === TenantStatus.TRIAL,
        suspended:
          tenant.status === TenantStatus.SUSPENDED ||
          tenant.status === TenantStatus.CANCELLED,
        pastDue:
          tenant.status === TenantStatus.PAST_DUE ||
          subscription?.status === 'PAST_DUE' ||
          counts.pastDueInvoices._count._all > 0,
        usageNearLimits: this.hasNearLimit(
          counts.shipments,
          plan?.monthlyShipmentLimit ?? null,
        ),
        unpaidInvoices: counts.unpaidInvoices._count._all > 0,
        featureOverrideCount: tenant.featureFlags.length,
        recentErrors: {
          available: false,
          message: 'Error tracking integration not configured yet',
        },
      },
    };
  }

  async startImpersonation(
    tenantId: string,
    dto: StartImpersonationDto,
    context: SupportAuditContext,
  ) {
    const tenant = await this.supportRepository.findTenantById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (
      tenant.status === TenantStatus.CANCELLED &&
      context.user.role !== UserRole.PLATFORM_OWNER
    ) {
      throw new ForbiddenException(
        'Only platform owner can impersonate cancelled tenants',
      );
    }
    const durationMinutes = dto.durationMinutes ?? DEFAULT_DURATION_MINUTES;
    if (
      durationMinutes > MAX_DURATION_MINUTES &&
      context.user.role !== UserRole.PLATFORM_OWNER
    ) {
      throw new BadRequestException(
        `durationMinutes cannot exceed ${MAX_DURATION_MINUTES}`,
      );
    }
    const targetUser = dto.targetUserId
      ? await this.supportRepository.findTenantUser(tenantId, dto.targetUserId)
      : await this.supportRepository.findDefaultTenantUser(tenantId);
    if (!targetUser)
      throw new NotFoundException('Target tenant user not found');

    // A newly issued impersonation token is a scope switch. Revoke every older
    // active session for this actor before issuing the new tenant context.
    await this.supportRepository.endActiveSessionsForActor(context.user.userId);

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    const session = await this.supportRepository.createImpersonationSession({
      actorUserId: context.user.userId,
      tenantId,
      targetUserId: targetUser.id,
      reason: dto.reason,
      status: ImpersonationStatus.ACTIVE,
      expiresAt,
    });
    await this.auditLogService.writeAuditLog({
      user: context.user,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      tenantId,
      action: 'impersonation.started',
      resourceType: 'ImpersonationSession',
      resourceId: session.id,
      newValue: this.toSessionResponse(session),
      reason: dto.reason,
    });

    const accessToken = this.jwtService.sign<TokenPayload>({
      sub: targetUser.id,
      role: targetUser.role,
      type: 'access',
      impersonationContext: {
        sessionId: session.id,
        actorUserId: context.user.userId,
        targetUserId: targetUser.id,
        tenantId,
      },
    });
    return {
      accessToken,
      expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      impersonation: this.toSessionResponse(session),
    };
  }

  async endImpersonation(
    dto: EndImpersonationDto,
    context: SupportAuditContext,
  ) {
    const session = dto.sessionId
      ? await this.supportRepository.findSessionById(dto.sessionId)
      : await this.supportRepository.findActiveSessionForActor(
          context.user.userId,
        );
    if (!session)
      throw new NotFoundException('Impersonation session not found');
    if (
      session.actorUserId !== context.user.userId &&
      context.user.role !== UserRole.PLATFORM_OWNER
    ) {
      throw new ForbiddenException(
        'Cannot end another platform user impersonation session',
      );
    }
    if (session.status !== ImpersonationStatus.ACTIVE) {
      return {
        ended: true,
        impersonation: this.toSessionResponse(session),
        alreadyEnded: true,
      };
    }
    const ended = await this.supportRepository.endSession(
      session.id,
      ImpersonationStatus.ENDED,
    );
    await this.auditLogService.writeAuditLog({
      user: context.user,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      tenantId: ended.tenantId,
      action: 'impersonation.ended',
      resourceType: 'ImpersonationSession',
      resourceId: ended.id,
      oldValue: this.toSessionResponse(session),
      newValue: this.toSessionResponse(ended),
      reason: dto.reason,
    });
    return {
      ended: true,
      impersonation: this.toSessionResponse(ended),
      alreadyEnded: false,
    };
  }

  async assertActiveImpersonationSession(sessionId: string) {
    const session = await this.supportRepository.findSessionById(sessionId);
    if (!session || session.status !== ImpersonationStatus.ACTIVE)
      throw new UnauthorizedException('Impersonation session is not active');
    if (session.expiresAt <= new Date()) {
      await this.supportRepository.endSession(
        session.id,
        ImpersonationStatus.EXPIRED,
      );
      throw new ForbiddenException('Impersonation session expired');
    }
    return session;
  }

  private toTenantSearchResponse(tenant: SupportTenantWithDetails) {
    const subscription = tenant.subscriptions[0] ?? null;
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      plan: tenant.currentPlan,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            paymentStatus: subscription.paymentStatus,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
      createdAt: tenant.createdAt,
    };
  }

  private toSessionResponse(session: {
    id: string;
    actorUserId: string;
    tenantId: string;
    targetUserId: string | null;
    reason: string;
    status: ImpersonationStatus;
    expiresAt: Date;
    endedAt: Date | null;
    createdAt: Date;
    tenant?: unknown;
    targetUser?: unknown;
  }) {
    return {
      id: session.id,
      actorUserId: session.actorUserId,
      tenantId: session.tenantId,
      targetUserId: session.targetUserId,
      status: session.status,
      expiresAt: session.expiresAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt,
      tenant: session.tenant,
      targetUser: session.targetUser,
    };
  }

  private toUsage(used: number, limit: number | null) {
    return {
      used,
      limit,
      remaining: limit === null ? null : Math.max(limit - used, 0),
      nearLimit: this.hasNearLimit(used, limit),
    };
  }

  private hasNearLimit(used: number, limit: number | null) {
    return limit !== null && limit > 0 && used / limit >= 0.8;
  }

  private decimalToString(value: Prisma.Decimal | null | undefined) {
    return (value ?? new Prisma.Decimal(0)).toString();
  }
}
