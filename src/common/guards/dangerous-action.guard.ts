import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DANGEROUS_ACTION_KEY } from '@common/decorators/dangerous-action.decorator';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';

interface RequestWithUser {
  user?: AuthenticatedRequestUser;
}

@Injectable()
export class DangerousActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const dangerousAction = this.reflector.getAllAndOverride<{ reason: string }>(
      DANGEROUS_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!dangerousAction) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.impersonationContext) {
      throw new ForbiddenException(
        `Dangerous action blocked during impersonation: ${dangerousAction.reason}`,
      );
    }
    return true;
  }
}
