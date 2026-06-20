import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PublicOnboardingService } from '../services/public-onboarding.service';
import { PublicSubscribeDto } from '../dtos';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuthService } from '@modules/auth/services/auth.service';
import { PlatformAuditLogService } from '@modules/platform/audit-logs/services/platform-audit-log.service';
import { ConfigService } from '@nestjs/config';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function makeDto(
  overrides: Partial<PublicSubscribeDto> = {},
): PublicSubscribeDto {
  return {
    company: {
      name: 'Cairo Express',
      slug: 'cairo-express',
      businessType: 'E-commerce',
      websiteUrl: 'https://cairoexpress.com',
    },
    owner: {
      name: 'Ahmed Ali',
      phone: '01012345678',
      password: 'securePassword123',
      email: 'ahmed@cairoexpress.com',
    },
    planSlug: 'pro',
    ...overrides,
  };
}

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-pro-uuid',
    name: 'Pro',
    slug: 'pro',
    isActive: true,
    archivedAt: null,
    isPublic: true,
    monthlyPrice: new Prisma.Decimal('1999'),
    ...overrides,
  };
}

interface MockPrismaService {
  $transaction: jest.Mock;
  plan: { findUnique: jest.Mock };
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
}

describe('PublicOnboardingService', () => {
  let service: PublicOnboardingService;
  let prisma: MockPrismaService;
  let authService: { login: jest.Mock };
  let auditLogService: { writeAuditLog: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      plan: { findUnique: jest.fn() },
      tenant: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    authService = {
      login: jest.fn(),
    };

    auditLogService = {
      writeAuditLog: jest.fn().mockResolvedValue({}),
    };

    configService = {
      get: jest.fn().mockReturnValue('14'),
    };

    service = new PublicOnboardingService(
      prisma as unknown as PrismaService,
      authService as unknown as AuthService,
      auditLogService as unknown as PlatformAuditLogService,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    it('creates tenant, owner, and subscription in a transaction and returns tokens', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const tenant = {
        id: 'tenant-uuid',
        name: 'Cairo Express',
        slug: 'cairo-express',
        status: TenantStatus.TRIAL,
        trialStartsAt: new Date(),
        trialEndsAt: new Date(),
      };
      const user = { id: 'user-uuid' };
      const subscription = {
        id: 'sub-uuid',
        planId: 'plan-pro-uuid',
        status: SubscriptionStatus.TRIALING,
        paymentStatus: PaymentStatus.NOT_REQUIRED,
        trialStartsAt: new Date(),
        trialEndsAt: new Date(),
      };

      const tx = {
        tenant: {
          create: jest.fn().mockResolvedValue(tenant),
          update: jest.fn().mockResolvedValue(tenant),
        },
        user: { create: jest.fn().mockResolvedValue(user) },
        subscription: { create: jest.fn().mockResolvedValue(subscription) },
      };
      prisma.$transaction.mockImplementation(
        async (cb: (tx: any) => Promise<unknown>) => cb(tx),
      );

      authService.login.mockResolvedValue({
        user: {
          id: 'user-uuid',
          name: 'Ahmed Ali',
          phone: '01012345678',
          role: UserRole.SUPER_ADMIN,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });

      const result = await service.subscribe(makeDto());

      expect(result.tenant.id).toBe('tenant-uuid');
      expect(result.tenant.name).toBe('Cairo Express');
      expect(result.subscription.planId).toBe('plan-pro-uuid');
      expect(result.subscription.status).toBe(SubscriptionStatus.TRIALING);
      expect(result.plan.slug).toBe('pro');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');

      expect(tx.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Cairo Express',
            slug: 'cairo-express',
            status: TenantStatus.TRIAL,
            currentPlanId: 'plan-pro-uuid',
          }),
        }),
      );
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Ahmed Ali',
            phone: '01012345678',
            role: UserRole.SUPER_ADMIN,
            tenantId: tenant.id,
          }),
        }),
      );
      expect(tx.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: tenant.id,
            planId: 'plan-pro-uuid',
            status: SubscriptionStatus.TRIALING,
            paymentStatus: PaymentStatus.NOT_REQUIRED,
          }),
        }),
      );
      expect(auditLogService.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.self_registered',
          resourceType: 'Tenant',
          resourceId: tenant.id,
          reason: 'Public self-service signup',
        }),
        tx,
      );
      expect(authService.login).toHaveBeenCalledWith(
        '01012345678',
        'securePassword123',
      );
    });

    it('throws NotFoundException when plan slug does not exist', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);

      await expect(service.subscribe(makeDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when plan is not public', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan({ isPublic: false }));

      await expect(service.subscribe(makeDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when plan is archived', async () => {
      prisma.plan.findUnique.mockResolvedValue(
        makePlan({ archivedAt: new Date() }),
      );

      await expect(service.subscribe(makeDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when plan is inactive', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan({ isActive: false }));

      await expect(service.subscribe(makeDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when tenant slug already exists', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.tenant.findUnique.mockResolvedValue({ id: 'existing-tenant' });

      await expect(service.subscribe(makeDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when phone already registered', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.subscribe(makeDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when email already registered', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'existing-email-user',
      });

      await expect(service.subscribe(makeDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('handles P2002 unique violation on slug from the transaction', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.6.0', meta: { target: ['slug'] } },
      );
      prisma.$transaction.mockRejectedValue(uniqueError);

      await expect(service.subscribe(makeDto())).rejects.toThrow(
        'Company slug already taken',
      );
    });

    it('handles P2002 unique violation on phone from the transaction', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const uniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.6.0', meta: { target: ['phone'] } },
      );
      prisma.$transaction.mockRejectedValue(uniqueError);

      await expect(
        service.subscribe(
          makeDto({
            owner: {
              name: 'Ahmed',
              phone: '01012345678',
              password: 'secret123',
            },
          }),
        ),
      ).rejects.toThrow('Phone number already registered');
    });

    it('hashes the owner password with bcrypt', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const tx = {
        tenant: {
          create: jest.fn().mockResolvedValue({ id: 't1' }),
          update: jest.fn().mockResolvedValue({}),
        },
        user: { create: jest.fn().mockResolvedValue({ id: 'u1' }) },
        subscription: { create: jest.fn().mockResolvedValue({ id: 's1' }) },
      };
      prisma.$transaction.mockImplementation(
        async (cb: (tx: any) => Promise<unknown>) => cb(tx),
      );
      authService.login.mockResolvedValue({
        user: {},
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn: 900,
      });

      await service.subscribe(makeDto());

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('securePassword123', 12);
    });

    it('skips email conflict check when email is not provided', async () => {
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const tx = {
        tenant: {
          create: jest.fn().mockResolvedValue({ id: 't1' }),
          update: jest.fn().mockResolvedValue({}),
        },
        user: { create: jest.fn().mockResolvedValue({ id: 'u1' }) },
        subscription: { create: jest.fn().mockResolvedValue({ id: 's1' }) },
      };
      prisma.$transaction.mockImplementation(
        async (cb: (tx: any) => Promise<unknown>) => cb(tx),
      );
      authService.login.mockResolvedValue({
        user: {},
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn: 900,
      });

      const dto = makeDto({
        owner: { name: 'Ahmed', phone: '01012345678', password: 'secret123' },
      });
      const result = await service.subscribe(dto);

      expect(result.accessToken).toBe('a');
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('uses default trial days when config is not set', async () => {
      configService.get.mockReturnValue(undefined);
      prisma.plan.findUnique.mockResolvedValue(makePlan());
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const tx = {
        tenant: {
          create: jest.fn().mockResolvedValue({
            id: 't1',
            trialStartsAt: new Date(),
            trialEndsAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        user: { create: jest.fn().mockResolvedValue({ id: 'u1' }) },
        subscription: { create: jest.fn().mockResolvedValue({ id: 's1' }) },
      };
      prisma.$transaction.mockImplementation(
        async (cb: (tx: any) => Promise<unknown>) => cb(tx),
      );
      authService.login.mockResolvedValue({
        user: {},
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn: 900,
      });

      await service.subscribe(makeDto());

      const subscriptionData = tx.subscription.create.mock.calls[0][0].data;
      const trialStart = subscriptionData.trialStartsAt as Date;
      const trialEnd = subscriptionData.trialEndsAt as Date;
      const diffDays = Math.round(
        (trialEnd.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(14);
    });
  });
});
