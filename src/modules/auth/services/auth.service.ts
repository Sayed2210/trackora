import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { RedisService } from '@infrastructure/cache/redis.service';
import {
  AuthRepository,
  AuthUserWithAccounts,
} from '../repositories/auth.repository';
import {
  TokenPayload,
  RefreshTokenPayload,
  UserRole,
} from '../entities/auth.entity';

const REGISTERABLE_ROLES = ['MERCHANT', 'COURIER'] as const;

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
    role: string,
  ) {
    if (!REGISTERABLE_ROLES.includes(role as typeof REGISTERABLE_ROLES[number])) {
      throw new BadRequestException(
        `Registration is only allowed for roles: ${REGISTERABLE_ROLES.join(', ')}`,
      );
    }

    const existingUser = await this.authRepository.findByPhone(phone);

    if (existingUser) {
      throw new ConflictException('Phone number already registered');
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
    const user = await this.authRepository.findByPhoneWithAccounts(phone);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        ...this.toAuthUser(user),
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        {
          secret: jwtSecret,
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

  private toAuthUser(user: AuthUserWithAccounts) {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      roles: [user.role],
      permissions: [],
      merchantId: user.merchant?.id,
      courierId: user.courier?.id,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
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
