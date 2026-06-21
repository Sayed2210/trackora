import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DANGEROUS_ACTION_KEY } from '@common/decorators/dangerous-action.decorator';
import { DangerousActionGuard } from './dangerous-action.guard';

describe('DangerousActionGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as jest.Mocked<Reflector>;
  const guard = new DangerousActionGuard(reflector);

  const context = (user?: any) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as any;

  beforeEach(() => jest.clearAllMocks());

  it('allows non-dangerous actions', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined);

    expect(guard.canActivate(context({}))).toBe(true);
  });

  it('blocks dangerous actions during impersonation', () => {
    reflector.getAllAndOverride.mockReturnValueOnce({
      reason: 'billing invoice mutations',
    });

    expect(() =>
      guard.canActivate(
        context({ impersonationContext: { sessionId: 'session-id' } }),
      ),
    ).toThrow(ForbiddenException);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      DANGEROUS_ACTION_KEY,
      expect.any(Array),
    );
  });
});
