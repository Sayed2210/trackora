import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { isPlatformRole } from '@common/constants/permissions.constant';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';

/**
 * The only supported resolver for tenant-owned API operations.
 *
 * Platform identities intentionally have no implicit operational scope. They
 * must use an active, JWT-validated impersonation context before this resolver
 * will return a tenant.
 */
export function resolveEffectiveTenantId(
  user: AuthenticatedRequestUser | undefined,
): string {
  if (!user) {
    throw new UnauthorizedException('Authentication is required');
  }

  if (user.impersonationContext) {
    const impersonatedTenantId = user.impersonationContext.tenantId;
    if (!impersonatedTenantId || user.tenantId !== impersonatedTenantId) {
      throw new ForbiddenException('Invalid impersonation tenant context');
    }
    return impersonatedTenantId;
  }

  if (isPlatformRole(user.role)) {
    throw new ForbiddenException(
      'Explicit tenant impersonation is required for tenant data',
    );
  }

  if (!user.tenantId) {
    throw new ForbiddenException('Tenant context is required');
  }

  return user.tenantId;
}

export const EffectiveTenantId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedRequestUser }>();
    return resolveEffectiveTenantId(request.user);
  },
);
