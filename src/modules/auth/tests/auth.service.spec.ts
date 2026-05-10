import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { AuthRepository } from '../repositories/auth.repository';
import { UserRole } from '../entities/auth.entity';
import { RedisService } from '@infrastructure/cache/redis.service';
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
            findById: jest.fn(),
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

    it('should throw if phone already registered', async () => {
      jest.spyOn(repository, 'findByPhone').mockResolvedValueOnce(mockUser);

      await expect(
        service.register(
          '01000000001',
          'password123',
          'New User',
          'MERCHANT',
        ),
      ).rejects.toThrow(UnauthorizedException);
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
      jest.spyOn(repository, 'findByPhone').mockResolvedValueOnce(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await service.login('01000000001', 'password123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw for invalid phone', async () => {
      jest.spyOn(repository, 'findByPhone').mockResolvedValueOnce(null);

      await expect(service.login('01000000001', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw for invalid password', async () => {
      jest.spyOn(repository, 'findByPhone').mockResolvedValueOnce(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.login('01000000001', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens for valid refresh token', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValueOnce(mockUser);
      jest.spyOn(jwtService, 'verify').mockReturnValueOnce({
        sub: mockUser.id,
        type: 'refresh',
      });
      jest.spyOn(redis, 'get').mockResolvedValueOnce('valid-refresh-token');

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw for invalid refresh token type', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValueOnce({
        sub: mockUser.id,
        type: 'access',
      });

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw for inactive user', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValueOnce({
        sub: mockUser.id,
        type: 'refresh',
      });
      jest
        .spyOn(repository, 'findById')
        .mockResolvedValueOnce({ ...mockUser, isActive: false });

      await expect(service.refreshTokens('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
