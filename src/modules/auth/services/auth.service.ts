import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { RedisService } from '@infrastructure/cache/redis.service';
import { AuthRepository } from '../repositories/auth.repository';
import {
  UserRole,
  TokenPayload,
  RefreshTokenPayload,
} from '../entities/auth.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async register(
    phone: string,
    password: string,
    name: string,
    role: UserRole,
  ) {
    const existingUser = await this.authRepository.findByPhone(phone);

    if (existingUser) {
      throw new UnauthorizedException('Phone number already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.authRepository.create({
      phone,
      passwordHash: hashedPassword,
      name,
      role,
      phoneVerified: new Date(),
    });

    return this.generateTokens(user.id, user.role);
  }

  async login(phone: string, password: string) {
    const user = await this.authRepository.findByPhone(phone);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.role);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        {
          secret:
            this.configService.get<string>('JWT_SECRET') || 'fallback-secret',
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const stored = await this.redis.get(`refresh_token:${payload.sub}`);
      if (!stored || stored !== refreshToken) {
        throw new UnauthorizedException('Refresh token revoked');
      }

      const user = await this.authRepository.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return this.generateTokens(user.id, user.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(`refresh_token:${userId}`);
  }

  private async generateTokens(userId: string, role: UserRole) {
    const accessToken = this.jwtService.sign<TokenPayload>({
      sub: userId,
      role,
      type: 'access',
    });

    const refreshToken = this.jwtService.sign<RefreshTokenPayload>(
      {
        sub: userId,
        type: 'refresh',
      },
      {
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as `${number}d`,
      },
    );

    const refreshTtl = parseInt(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      10,
    );
    await this.redis.set(
      `refresh_token:${userId}`,
      refreshToken,
      refreshTtl * 86400,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }
}
