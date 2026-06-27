import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@core/prisma/prisma.service';
import { PlatformAuditLogService } from '@modules/platform/audit-logs/services/platform-audit-log.service';
import { TenantOnboardingService } from '../services/tenant-onboarding.service';
import { OnboardPlatformTenantDto } from '../dtos';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const planId = '123e4567-e89b-42d3-a456-426614174002';

function makeDto(
  overrides: Partial<OnboardPlatformTenantDto> = {},
): OnboardPlatformTenantDto {
  return {
    tenant: {
      name: 'Cairo Express',
      slug: 'cairo-express',
      trialStartsAt: new Date('2026-06-27T00:00:00.000Z'),
      trialEndsAt: new Date('2026-07-27T00:00:00.000Z'),
      metadata: {},
    },
    subscription: {
      planId,
      status: SubscriptionStatus.TRIALING,
      paymentStatus: PaymentStatus.NOT_REQUIRED,
      currentPeriodStart: new Date('2026-06-27T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-07-27T00:00:00.000Z'),
      reason: 'Tenant onboarding after offline contract',
    },
    owner: {
      name: 'Ahmed Ali',
      phone: '01000000000',
      email: 'owner@company.com',
      temporaryPassword: 'Trackora@12345',
      role: UserRole.SUPER_ADMIN,
    },
    ...overrides,
  };
}

function makeActivePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: planId,
    name: 'Growth',
    slug: 'growth',
    isActive: true,
    archivedAt: null,
    ...overrides,
  };
}

interface TxMock {
  tenant: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  plan: {
    findUnique: jest.Mock;
  };
  subscription: {
    create: jest.Mock;
  };
}

function setupTransaction(): TxMock {
  const tx: TxMock = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'tenant-uuid',
        name: 'Cairo Express',
        slug: 'cairo-express',
        status: TenantStatus.TRIAL,
        trialStartsAt: new Date('2026-06-27T00:00:00.000Z'),
        trialEndsAt: new Date('2026-07-27T00:00:00.000Z'),
        currentPlanId: planId,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        name: 'Ahmed Ali',
        phone: '01000000000',
        email: 'owner@company.com',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      }),
    },
    plan: {
      findUnique: jest.fn().mockResolvedValue(makeActivePlan()),
    },
    subscription: {
      create: jest.fn().mockResolvedValue({
        id: 'subscription-uuid',
        tenantId: 'tenant-uuid',
        planId,
        status: SubscriptionStatus.TRIALING,
        paymentStatus: PaymentStatus.NOT_REQUIRED,
        currentPeriodStart: new Date('2026-06-27T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-07-27T00:00:00.000Z'),
      }),
    },
  };
  return tx;
}

describe('TenantOnboardingService', () => {
  let service: TenantOnboardingService;
  let prisma: {
    $transaction: jest.Mock;
  };
  let auditLogService: { writeAuditLog: jest.Mock };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
    };
    auditLogService = {
      writeAuditLog: jest.fn().mockResolvedValue({}),
    };
    service = new TenantOnboardingService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as PlatformAuditLogService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates tenant, owner, subscription, and updates tenant.currentPlanId atomically', async () => {
    const tx = setupTransaction();
    prisma.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );

    const txSpy = prisma.$transaction;
    const result = await service.onboard(makeDto());

    expect(txSpy).toHaveBeenCalledTimes(1);
    expect(tx.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          name: 'Cairo Express',
          slug: 'cairo-express',
          status: TenantStatus.TRIAL,
          currentPlanId: planId,
        }),
      }),
    );
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          tenantId: 'tenant-uuid',
          name: 'Ahmed Ali',
          phone: '01000000000',
          email: 'owner@company.com',
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        }),
      }),
    );
    expect(tx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          tenantId: 'tenant-uuid',
          planId,
          status: SubscriptionStatus.TRIALING,
          paymentStatus: PaymentStatus.NOT_REQUIRED,
        }),
      }),
    );
    expect(tx.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-uuid' },
        data: { currentPlanId: planId },
      }),
    );

    expect(result.tenant.id).toBe('tenant-uuid');
    expect(result.tenant.currentPlanId).toBe(planId);
    expect(result.subscription.planId).toBe(planId);
    expect(result.owner.id).toBe('user-uuid');
    expect(result.owner.role).toBe(UserRole.SUPER_ADMIN);
    expect(result.owner.isActive).toBe(true);
    expect(result.credentials.temporaryPassword).toBe('Trackora@12345');

    const auditCalls = auditLogService.writeAuditLog.mock.calls as Array<
      [{ action: string }, TxMock]
    >;
    const actions = auditCalls.map((c) => c[0].action);
    expect(actions).toContain('tenant.created');
    expect(actions).toContain('tenant.owner_created');
    expect(actions).toContain('subscription.created');
    auditCalls.forEach((call) => expect(call[1]).toBe(tx));
  });

  it('hashes the temporary password with bcrypt cost 12', async () => {
    setupTransactionImpl(prisma);
    await service.onboard(makeDto());

    expect(mockedBcrypt.hash).toHaveBeenCalledWith('Trackora@12345', 12);
  });

  it('generates a secure temporary password when none is provided', async () => {
    setupTransactionImpl(prisma);
    const dto = makeDto({
      owner: {
        name: 'Ahmed Ali',
        phone: '01000000000',
        email: 'owner@company.com',
      },
    });

    const result = await service.onboard(dto);

    expect(result.credentials.temporaryPassword).toBeTruthy();
    expect(result.credentials.temporaryPassword.length).toBeGreaterThanOrEqual(
      18,
    );
    expect(mockedBcrypt.hash).toHaveBeenCalledWith(
      result.credentials.temporaryPassword,
      12,
    );
  });

  it('throws ConflictException when tenant slug already exists', async () => {
    const tx = setupTransaction();
    tx.tenant.findUnique.mockResolvedValueOnce({ id: 'existing-tenant' });
    prisma.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );

    await expect(service.onboard(makeDto())).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when owner phone already registered', async () => {
    const tx = setupTransaction();
    tx.user.findUnique.mockResolvedValueOnce({ id: 'existing-user' });
    prisma.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );

    await expect(service.onboard(makeDto())).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when owner email already registered', async () => {
    const tx = setupTransaction();
    tx.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-email-user' });
    prisma.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );

    await expect(service.onboard(makeDto())).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when plan is missing', async () => {
    const tx = setupTransaction();
    tx.plan.findUnique.mockResolvedValueOnce(null);
    prisma.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );

    await expect(service.onboard(makeDto())).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when plan is inactive', async () => {
    const tx = setupTransaction();
    tx.plan.findUnique.mockResolvedValueOnce(
      makeActivePlan({ isActive: false }),
    );
    prisma.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );

    await expect(service.onboard(makeDto())).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when plan is archived', async () => {
    const tx = setupTransaction();
    tx.plan.findUnique.mockResolvedValueOnce(
      makeActivePlan({ archivedAt: new Date() }),
    );
    prisma.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );

    await expect(service.onboard(makeDto())).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when trial date range is inverted', async () => {
    setupTransactionImpl(prisma);

    await expect(
      service.onboard(
        makeDto({
          tenant: {
            name: 'Cairo Express',
            slug: 'cairo-express',
            trialStartsAt: new Date('2026-07-27T00:00:00.000Z'),
            trialEndsAt: new Date('2026-06-27T00:00:00.000Z'),
          },
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when current period date range is inverted', async () => {
    setupTransactionImpl(prisma);

    await expect(
      service.onboard(
        makeDto({
          subscription: {
            planId,
            reason: 'Tenant onboarding after offline contract',
            currentPeriodStart: new Date('2026-07-27T00:00:00.000Z'),
            currentPeriodEnd: new Date('2026-06-27T00:00:00.000Z'),
          },
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('never includes passwordHash in the response', async () => {
    const tx = setupTransaction();
    tx.user.create.mockResolvedValueOnce({
      id: 'user-uuid',
      tenantId: 'tenant-uuid',
      name: 'Ahmed Ali',
      phone: '01000000000',
      email: 'owner@company.com',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      passwordHash: 'should-not-leak',
    } as any);
    prisma.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<unknown>) => cb(tx),
    );

    const result = await service.onboard(makeDto());

    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('should-not-leak');
  });

  it('maps P2002 unique violation on slug to ConflictException', async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '6.6.0', meta: { target: ['slug'] } },
    );
    prisma.$transaction.mockRejectedValue(uniqueError);

    await expect(service.onboard(makeDto())).rejects.toThrow(ConflictException);
  });
});

function setupTransactionImpl(prismaObj: { $transaction: jest.Mock }): TxMock {
  const tx = setupTransaction();
  prismaObj.$transaction.mockImplementation(
    async (cb: (tx: any) => Promise<unknown>) => cb(tx),
  );
  return tx;
}
