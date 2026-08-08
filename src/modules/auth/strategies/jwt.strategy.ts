import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ImpersonationStatus } from '@prisma/client';
import { JwtPayload } from '../entities/auth.entity';
import { getPermissionsForRole } from '@common/constants/permissions.constant';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, tenantId: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (payload.impersonationContext) {
      const session = await this.prisma.impersonationSession.findUnique({
        where: { id: payload.impersonationContext.sessionId },
      });
      if (!session || session.status !== ImpersonationStatus.ACTIVE) {
        throw new UnauthorizedException('Impersonation session is not active');
      }
      if (session.expiresAt <= new Date()) {
        await this.prisma.impersonationSession.update({
          where: { id: session.id },
          data: { status: ImpersonationStatus.EXPIRED, endedAt: new Date() },
        });
        throw new ForbiddenException('Impersonation session expired');
      }
      if (
        session.actorUserId !== payload.impersonationContext.actorUserId ||
        session.targetUserId !== payload.sub ||
        session.targetUserId !== payload.impersonationContext.targetUserId ||
        session.tenantId !== payload.impersonationContext.tenantId ||
        user.tenantId !== session.tenantId
      ) {
        throw new UnauthorizedException('Invalid impersonation context');
      }
    }

    return {
      userId: user.id,
      role: user.role,
      permissions: getPermissionsForRole(user.role),
      tenantId:
        payload.impersonationContext?.tenantId ?? user.tenantId ?? undefined,
      impersonationContext: payload.impersonationContext,
    };
  }
}
