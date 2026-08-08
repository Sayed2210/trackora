import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { resolveEffectiveTenantId } from './effective-tenant';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

const user = (role: UserRole, tenantId?: string) => ({
  userId: 'user-1',
  role,
  permissions: [],
  tenantId,
});

describe('resolveEffectiveTenantId', () => {
  it.each([
    UserRole.MERCHANT,
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_MANAGER,
  ])('uses the authenticated tenant for %s', (role) => {
    expect(resolveEffectiveTenantId(user(role, tenantA))).toBe(tenantA);
  });

  it('rejects a direct platform user without impersonation', () => {
    expect(() =>
      resolveEffectiveTenantId(user(UserRole.PLATFORM_SUPPORT)),
    ).toThrow(ForbiddenException);
  });

  it('uses validated impersonation context and changes scope immediately when switched', () => {
    const impersonated = (tenantId: string) => ({
      ...user(UserRole.MERCHANT, tenantId),
      impersonationContext: {
        sessionId: `session-${tenantId}`,
        actorUserId: 'platform-user',
        targetUserId: 'user-1',
        tenantId,
      },
    });

    expect(resolveEffectiveTenantId(impersonated(tenantA))).toBe(tenantA);
    expect(resolveEffectiveTenantId(impersonated(tenantB))).toBe(tenantB);
  });

  it('rejects ended impersonation represented by restored platform context', () => {
    expect(() =>
      resolveEffectiveTenantId(user(UserRole.PLATFORM_SUPPORT)),
    ).toThrow('Explicit tenant impersonation is required');
  });

  it('rejects a mismatched impersonation tenant claim', () => {
    expect(() =>
      resolveEffectiveTenantId({
        ...user(UserRole.MERCHANT, tenantA),
        impersonationContext: {
          sessionId: 'session-1',
          actorUserId: 'platform-user',
          targetUserId: 'user-1',
          tenantId: tenantB,
        },
      }),
    ).toThrow('Invalid impersonation tenant context');
  });
});
