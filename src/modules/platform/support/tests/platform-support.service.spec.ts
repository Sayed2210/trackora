import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ImpersonationStatus,
  PaymentStatus,
  Prisma,
  TenantStatus,
  UserRole,
} from '@prisma/client';
import { PlatformSupportRepository } from '../repositories/platform-support.repository';
import { PlatformSupportService } from '../services/platform-support.service';

const actorUserId = '123e4567-e89b-42d3-a456-426614174000';
const tenantId = '123e4567-e89b-42d3-a456-426614174001';
const targetUserId = '123e4567-e89b-42d3-a456-426614174002';
const sessionId = '123e4567-e89b-42d3-a456-426614174003';
const actor = {
  userId: actorUserId,
  role: UserRole.PLATFORM_SUPPORT,
  permissions: [],
};

describe('PlatformSupportService', () => {
  let service: PlatformSupportService;
  let repository: jest.Mocked<PlatformSupportRepository>;
  let auditLogService: { writeAuditLog: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(() => {
    repository = {
      buildTenantSearchWhere: jest.fn().mockReturnValue({}),
      findTenants: jest.fn(),
      countTenants: jest.fn(),
      findTenantById: jest.fn(),
      findTenantUser: jest.fn(),
      findDefaultTenantUser: jest.fn(),
      createImpersonationSession: jest.fn(),
      findSessionById: jest.fn(),
      findActiveSessionForActor: jest.fn(),
      endSession: jest.fn(),
      getTenantHealthCounts: jest.fn(),
    } as unknown as jest.Mocked<PlatformSupportRepository>;
    auditLogService = { writeAuditLog: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('impersonation-token') };
    service = new PlatformSupportService(
      repository,
      auditLogService as any,
      jwtService as any,
    );
  });

  it('searches tenants with pagination and safe response', async () => {
    repository.findTenants.mockResolvedValueOnce([
      {
        id: tenantId,
        name: 'Acme',
        slug: 'acme',
        status: TenantStatus.ACTIVE,
        currentPlan: {
          id: 'plan-id',
          name: 'Growth',
          slug: 'growth',
          currency: 'EGP',
        },
        subscriptions: [
          {
            id: 'sub-id',
            status: 'ACTIVE',
            paymentStatus: 'PAID',
            currentPeriodEnd: null,
          },
        ],
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      } as any,
    ]);
    repository.countTenants.mockResolvedValueOnce(1);

    const result = await service.searchTenants({
      search: 'acme',
      page: 2,
      limit: 10,
    });

    expect(repository.findTenants).toHaveBeenCalledWith({}, 10, 10);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: tenantId,
        name: 'Acme',
        plan: expect.any(Object),
      }),
    );
  });

  it('returns tenant health summary', async () => {
    repository.findTenantById.mockResolvedValueOnce({
      id: tenantId,
      name: 'Acme',
      slug: 'acme',
      status: TenantStatus.ACTIVE,
      createdAt: new Date(),
      currentPlan: null,
      featureFlags: [{ id: 'flag-id' }],
      subscriptions: [
        {
          id: 'sub-id',
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          plan: {
            id: 'plan-id',
            name: 'Growth',
            slug: 'growth',
            monthlyPrice: new Prisma.Decimal('999'),
            currency: 'EGP',
            monthlyShipmentLimit: 100,
            adminUserLimit: 5,
            merchantLimit: 10,
            courierLimit: 20,
          },
        },
      ],
    } as any);
    repository.getTenantHealthCounts.mockResolvedValueOnce({
      shipments: 80,
      admins: 2,
      merchants: 3,
      couriers: 4,
      unpaidInvoices: {
        _count: { _all: 1 },
        _sum: { amount: new Prisma.Decimal('100') },
      },
      pastDueInvoices: { _count: { _all: 0 }, _sum: { amount: null } },
      recentAuditLogs: [],
    });

    const result = await service.getTenantHealth(tenantId, true);

    expect(result.tenant.id).toBe(tenantId);
    expect(result.usageSummary.shipments.nearLimit).toBe(true);
    expect(result.billingStatusSummary.unpaidAmount).toBe('100');
  });

  it('starts impersonation, creates session, signs tenant token, and writes audit log', async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const targetUser = {
      id: targetUserId,
      tenantId,
      role: UserRole.MERCHANT,
      name: 'Merchant',
      phone: '01000000000',
      email: null,
      isActive: true,
    };
    const session = {
      id: sessionId,
      actorUserId,
      tenantId,
      targetUserId,
      reason: 'support',
      status: ImpersonationStatus.ACTIVE,
      expiresAt,
      endedAt: null,
      createdAt: new Date(),
      tenant: { id: tenantId },
      targetUser,
    };
    repository.findTenantById.mockResolvedValueOnce({
      id: tenantId,
      status: TenantStatus.ACTIVE,
    } as any);
    repository.findTenantUser.mockResolvedValueOnce(targetUser);
    repository.createImpersonationSession.mockResolvedValueOnce(session as any);

    const result = await service.startImpersonation(
      tenantId,
      { reason: 'support', targetUserId },
      { user: actor },
    );

    expect(repository.createImpersonationSession).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,
        tenantId,
        targetUserId,
        status: ImpersonationStatus.ACTIVE,
      }),
    );
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: targetUserId,
        role: UserRole.MERCHANT,
        impersonationContext: expect.objectContaining({ sessionId }),
      }),
    );
    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'impersonation.started',
        tenantId,
        reason: 'support',
      }),
    );
    expect(result.accessToken).toBe('impersonation-token');
  });

  it('rejects non-owner impersonation of cancelled tenants', async () => {
    repository.findTenantById.mockResolvedValueOnce({
      id: tenantId,
      status: TenantStatus.CANCELLED,
    } as any);

    await expect(
      service.startImpersonation(
        tenantId,
        { reason: 'support' },
        { user: actor },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ends active impersonation sessions and writes audit log', async () => {
    const session = {
      id: sessionId,
      actorUserId,
      tenantId,
      targetUserId,
      reason: 'support',
      status: ImpersonationStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 1000),
      endedAt: null,
      createdAt: new Date(),
    };
    repository.findSessionById.mockResolvedValueOnce(session as any);
    repository.endSession.mockResolvedValueOnce({
      ...session,
      status: ImpersonationStatus.ENDED,
      endedAt: new Date(),
    } as any);

    const result = await service.endImpersonation(
      { sessionId, reason: 'done' },
      { user: actor },
    );

    expect(result.ended).toBe(true);
    expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'impersonation.ended',
        reason: 'done',
      }),
    );
  });

  it('rejects expired impersonation sessions with 403 and marks them expired', async () => {
    repository.findSessionById.mockResolvedValueOnce({
      id: sessionId,
      status: ImpersonationStatus.ACTIVE,
      expiresAt: new Date(Date.now() - 1000),
    } as any);
    repository.endSession.mockResolvedValueOnce({} as any);

    await expect(
      service.assertActiveImpersonationSession(sessionId),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.endSession).toHaveBeenCalledWith(
      sessionId,
      ImpersonationStatus.EXPIRED,
    );
  });

  it('returns 404 for missing target tenant user', async () => {
    repository.findTenantById.mockResolvedValueOnce({
      id: tenantId,
      status: TenantStatus.ACTIVE,
    } as any);
    repository.findDefaultTenantUser.mockResolvedValueOnce(null);

    await expect(
      service.startImpersonation(
        tenantId,
        { reason: 'support' },
        { user: actor },
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
