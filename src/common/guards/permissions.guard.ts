import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '@common/decorators/permissions.decorator';
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

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return requiredPermissions.every((permission) =>
      request.user?.permissions?.includes(permission),
    );
  }
}
