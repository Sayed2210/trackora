import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '@common/decorators/permissions.decorator';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';
import { Permission } from '@common/constants/permissions.constant';

interface RequestWithUser {
  user?: AuthenticatedRequestUser;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const anyPermissions = this.reflector.getAllAndOverride<Permission[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions && !anyPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userPermissions = request.user?.permissions ?? [];
    const hasRequiredPermissions =
      requiredPermissions?.every((permission) =>
        userPermissions.includes(permission),
      ) ?? true;
    const hasAnyPermission =
      anyPermissions?.some((permission) => userPermissions.includes(permission)) ??
      true;

    return hasRequiredPermissions && hasAnyPermission;
  }
}
