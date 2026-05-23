import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ImpersonationStatus } from '@prisma/client';
import { JwtPayload } from '../entities/auth.entity';
import { getPermissionsForRole } from '@common/constants/permissions.constant';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private readonly prisma: PrismaService) {
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
        throw new UnauthorizedException('Impersonation session expired');
      }
    }

    return {
      userId: payload.sub,
      role: payload.role,
      permissions: getPermissionsForRole(payload.role),
      tenantId: payload.impersonationContext?.tenantId,
      impersonationContext: payload.impersonationContext,
    };
  }
}
