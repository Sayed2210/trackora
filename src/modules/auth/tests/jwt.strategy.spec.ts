import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImpersonationStatus, UserRole } from '@prisma/client';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import { PrismaService } from '@core/prisma/prisma.service';
import { JwtStrategy } from '../strategies/jwt.strategy';

const sessionId = '123e4567-e89b-42d3-a456-426614174010';
const tenantId = '123e4567-e89b-42d3-a456-426614174011';
const targetUserId = '123e4567-e89b-42d3-a456-426614174012';
const actorUserId = '123e4567-e89b-42d3-a456-426614174013';

describe('JwtStrategy platform and impersonation context', () => {
  let strategy: JwtStrategy;
  let prisma: {
    impersonationSession: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      impersonationSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    strategy = new JwtStrategy(
      {
        get: jest.fn().mockReturnValue('test-secret'),
      } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('returns platform permissions for platform tokens', async () => {
    const result = await strategy.validate({
      sub: actorUserId,
      role: UserRole.PLATFORM_OWNER,
    });

    expect(result).toMatchObject({
      userId: actorUserId,
      role: UserRole.PLATFORM_OWNER,
      permissions: expect.arrayContaining([PERMISSIONS.MANAGE_TENANTS]),
    });
    expect(result.tenantId).toBeUndefined();
  });

  it('uses target tenant-user role and permissions for active impersonation tokens', async () => {
    prisma.impersonationSession.findUnique.mockResolvedValueOnce({
      id: sessionId,
      status: ImpersonationStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await strategy.validate({
      sub: targetUserId,
      role: UserRole.MERCHANT,
      impersonationContext: { sessionId, actorUserId, targetUserId, tenantId },
    });

    expect(result).toMatchObject({
      userId: targetUserId,
      role: UserRole.MERCHANT,
      permissions: [],
      tenantId,
      impersonationContext: { sessionId, actorUserId, targetUserId, tenantId },
    });
  });

  it('rejects inactive impersonation sessions with 401', async () => {
    prisma.impersonationSession.findUnique.mockResolvedValueOnce({
      id: sessionId,
      status: ImpersonationStatus.ENDED,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      strategy.validate({
        sub: targetUserId,
        role: UserRole.MERCHANT,
        impersonationContext: {
          sessionId,
          actorUserId,
          targetUserId,
          tenantId,
        },
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('marks expired impersonation sessions and rejects them with 403', async () => {
    prisma.impersonationSession.findUnique.mockResolvedValueOnce({
      id: sessionId,
      status: ImpersonationStatus.ACTIVE,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      strategy.validate({
        sub: targetUserId,
        role: UserRole.MERCHANT,
        impersonationContext: {
          sessionId,
          actorUserId,
          targetUserId,
          tenantId,
        },
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.impersonationSession.update).toHaveBeenCalledWith({
      where: { id: sessionId },
      data: { status: ImpersonationStatus.EXPIRED, endedAt: expect.any(Date) },
    });
  });
});
