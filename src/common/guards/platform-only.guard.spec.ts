import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PlatformOnlyGuard } from './platform-only.guard';

const createContext = (user?: { role: UserRole }): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as ExecutionContext;

describe('PlatformOnlyGuard', () => {
  const guard = new PlatformOnlyGuard();

  it('allows platform roles', () => {
    expect(
      guard.canActivate(createContext({ role: UserRole.PLATFORM_ADMIN })),
    ).toBe(true);
  });

  it('rejects unauthenticated requests with 401', () => {
    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects tenant users with 403', () => {
    expect(() =>
      guard.canActivate(createContext({ role: UserRole.MERCHANT })),
    ).toThrow(ForbiddenException);
  });
});
