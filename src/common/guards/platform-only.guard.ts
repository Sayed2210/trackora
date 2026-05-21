import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isPlatformRole } from '@common/constants/permissions.constant';
import { AuthenticatedRequestUser } from '@common/interfaces/request-context.interface';

@Injectable()
export class PlatformOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedRequestUser }>();

    if (!request.user) {
      throw new UnauthorizedException();
    }

    if (!isPlatformRole(request.user.role)) {
      throw new ForbiddenException('Platform access required');
    }

    return true;
  }
}
