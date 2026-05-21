import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { AuthRepository } from '../repositories/auth.repository';
import { UserRole } from '../entities/auth.entity';
import { RedisService } from '@infrastructure/cache/redis.service';
import { PERMISSIONS } from '@common/constants/permissions.constant';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  phone: '01000000001',
  passwordHash: '$2a$12$hashedpasswordhere',
  role: UserRole.MERCHANT,
  name: 'Test User',
  avatarUrl: null,
  isActive: true,
  emailVerified: null,
  phoneVerified: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let repository: AuthRepository;
  let jwtService: JwtService;
  let redis: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: {
            findByPhone: jest.fn(),
            findByPhoneWithAccounts: jest.fn(),
            findById: jest.fn(),
            findByIdWithAccounts: jest.fn(),
            create: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            verify: jest
              .fn()
              .mockReturnValue({ sub: mockUser.id, type: 'refresh' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => {
              const values: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return values[key] ?? fallback;
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    repository = module.get<AuthRepository>(AuthRepository);
    jwtService = module.get<JwtService>(JwtService);
    redis = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      jest.spyOn(repository, 'findByPhone').mockResolvedValueOnce(null);

      const result = await service.register(
        '01000000002',
        'password123',
        'New User',
        'MERCHANT',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(repository.create).toHaveBeenCalled();
    });

    it('should throw conflict if phone already registered', async () => {
      jest.spyOn(repository, 'findByPhone').mockResolvedValueOnce(mockUser);

      await expect(
        service.register(
          '01000000001',
          'password123',
          'New User',
          'MERCHANT',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject SUPER_ADMIN role registration', async () => {
      await expect(
        service.register(
          '01000000002',
          'password123',
          'Hacker',
          'SUPER_ADMIN',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject OPERATIONS_MANAGER role registration', async () => {
      await expect(
        service.register(
          '01000000002',
          'password123',
          'Hacker',
          'OPERATIONS_MANAGER',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should return tokens and user for valid credentials', async () => {
      jest.spyOn(repository, 'findByPhoneWithAccounts').mockResolvedValueOnce({
        ...mockUser,
        merchant: { id: 'merchant-1' },
        courier: null,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await service.login('01000000001', 'password123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toMatchObject({
        id: mockUser.id,
        role: UserRole.MERCHANT,
        merchantId: 'merchant-1',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(repository, 'findByPhoneWithAccounts').mockResolvedValueOnce(null);

      await expect(service.login('01000000001', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      jest.spyOn(repository, 'findByPhoneWithAccounts').mockResolvedValueOnce({
        ...mockUser,
        merchant: null,
        courier: null,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login('01000000001', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should refresh valid token', async () => {
      jest.spyOn(redis, 'get').mockResolvedValueOnce('refresh-token');
      jest.spyOn(jwtService, 'verify').mockReturnValueOnce({
        sub: mockUser.id,
        type: 'refresh',
      } as any);
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockUser as any);

      const result = await service.refreshTokens('refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementationOnce(() => {
        throw new Error('invalid');
      });

      await expect(service.refreshTokens('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token revoked', async () => {
      jest.spyOn(redis, 'get').mockResolvedValueOnce(null);

      await expect(service.refreshTokens('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMe', () => {
    it('returns platform context and permissions for platform users', async () => {
      jest.spyOn(repository, 'findByIdWithAccounts').mockResolvedValueOnce({
        ...mockUser,
        role: UserRole.PLATFORM_FINANCE,
        tenantId: null,
        merchant: null,
        courier: null,
      } as any);

      const result = await service.getMe(mockUser.id);

      expect(result).toMatchObject({
        id: mockUser.id,
        role: UserRole.PLATFORM_FINANCE,
        isPlatformUser: true,
        permissions: [
          PERMISSIONS.VIEW_BILLING,
          PERMISSIONS.VIEW_PLATFORM_ANALYTICS,
          PERMISSIONS.VIEW_AUDIT_LOGS,
        ],
        platformContext: {
          userId: mockUser.id,
          role: UserRole.PLATFORM_FINANCE,
        },
      });
    });

    it('returns tenantId and no platform context for tenant users', async () => {
      jest.spyOn(repository, 'findByIdWithAccounts').mockResolvedValueOnce({
        ...mockUser,
        tenantId: 'tenant-1',
        merchant: { id: 'merchant-1' },
        courier: null,
      } as any);

      const result = await service.getMe(mockUser.id);

      expect(result).toMatchObject({
        id: mockUser.id,
        role: UserRole.MERCHANT,
        tenantId: 'tenant-1',
        isPlatformUser: false,
        permissions: [],
        merchantId: 'merchant-1',
      });
      expect(result.platformContext).toBeUndefined();
    });
  });
});
