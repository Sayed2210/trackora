import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthRepository } from '../src/modules/auth/repositories/auth.repository';
import { RedisService } from '../src/infrastructure/cache/redis.service';
import { UserRole } from '../src/modules/auth/entities/auth.entity';

jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockImplementation((plain: string) => {
    return Promise.resolve(plain === 'password123');
  }),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  phone: '01000000001',
  passwordHash: 'any-hash-will-do-because-bcrypt-is-mocked',
  role: UserRole.MERCHANT,
  name: 'Test User',
  avatarUrl: null,
  isActive: true,
  emailVerified: null,
  phoneVerified: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  merchant: null,
  courier: null,
};

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockAuthRepository = {
    findByPhone: jest.fn(),
    findById: jest.fn(),
    create: jest.fn().mockResolvedValue(mockUser),
  };

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        AuthModule,
      ],
    })
      .overrideProvider(AuthRepository)
      .useValue(mockAuthRepository)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      mockAuthRepository.findByPhone.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          phone: '01000000002',
          password: 'password123',
          name: 'New User',
          role: UserRole.MERCHANT,
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(mockAuthRepository.create).toHaveBeenCalled();
    });

    it('should reject duplicate phone registration', async () => {
      mockAuthRepository.findByPhone.mockResolvedValueOnce(mockUser);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          phone: '01000000001',
          password: 'password123',
          name: 'Test User',
          role: UserRole.MERCHANT,
        })
        .expect(401);

      expect(response.body.message).toContain('already registered');
    });

    it('should reject invalid DTO (missing fields)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          phone: '01000000002',
        })
        .expect(400);

      expect(response.body.message).toBeInstanceOf(Array);
    });

    it('should reject invalid DTO (short password)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          phone: '01000000002',
          password: '123',
          name: 'Test',
          role: UserRole.MERCHANT,
        })
        .expect(400);

      expect(response.body.message).toBeInstanceOf(Array);
    });

    it('should reject invalid DTO (invalid role)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          phone: '01000000002',
          password: 'password123',
          name: 'Test',
          role: 'INVALID_ROLE',
        })
        .expect(400);

      expect(response.body.message).toBeInstanceOf(Array);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials and return tokens', async () => {
      mockAuthRepository.findByPhone.mockResolvedValueOnce(mockUser);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '01000000001',
          password: 'password123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid phone', async () => {
      mockAuthRepository.findByPhone.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '01000000099',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      mockAuthRepository.findByPhone.mockResolvedValueOnce(mockUser);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '01000000001',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject missing fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);

      expect(response.body.message).toBeInstanceOf(Array);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      mockAuthRepository.findById.mockResolvedValueOnce(mockUser);

      // Generate a real refresh token using the module's configured secret
      const validRefreshToken = jwtService.sign(
        { sub: mockUser.id, type: 'refresh' },
        { expiresIn: '7d' },
      );

      mockRedisService.get.mockResolvedValueOnce(validRefreshToken);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: validRefreshToken,
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.message).toBeInstanceOf(Array);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout authenticated user', async () => {
      mockAuthRepository.findByPhone.mockResolvedValueOnce(mockUser);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          phone: '01000000001',
          password: 'password123',
        })
        .expect(201);

      const accessToken = loginRes.body.accessToken;

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.message).toContain('Logged out');
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `refresh_token:${mockUser.id}`,
      );
    });

    it('should reject unauthenticated logout', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });

  describe('POST /auth/otp/send', () => {
    it('should send OTP and return success', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/otp/send')
        .send({
          phone: '01012345678',
        })
        .expect(201);

      expect(response.body.message).toContain('OTP sent');
      expect(response.body.code).toMatch(/^\d{4}$/);
      expect(mockRedisService.setJson).toHaveBeenCalledWith(
        'otp:01012345678',
        expect.objectContaining({
          code: expect.any(String),
          attempts: 0,
          verified: false,
        }),
        300,
      );
    });

    it('should accept request even with missing phone (controller does not use DTO)', async () => {
      // The controller uses @Body('phone') which returns undefined when missing
      const response = await request(app.getHttpServer())
        .post('/auth/otp/send')
        .send({})
        .expect(201);

      expect(response.body.message).toContain('OTP sent');
      expect(response.body.code).toMatch(/^\d{4}$/);
    });
  });

  describe('POST /auth/otp/verify', () => {
    it('should verify valid OTP', async () => {
      mockRedisService.getJson.mockResolvedValueOnce({
        code: '1234',
        attempts: 0,
        verified: false,
      });

      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({
          phone: '01012345678',
          code: '1234',
        })
        .expect(201);

      expect(response.body.valid).toBe(true);
    });

    it('should reject invalid OTP', async () => {
      mockRedisService.getJson.mockResolvedValueOnce({
        code: '1234',
        attempts: 0,
        verified: false,
      });

      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({
          phone: '01012345678',
          code: '9999',
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid OTP');
    });

    it('should reject expired OTP', async () => {
      mockRedisService.getJson.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({
          phone: '01012345678',
          code: '1234',
        })
        .expect(400);

      expect(response.body.message).toContain('expired');
    });

    it('should return OTP error when fields are missing (controller does not use DTO)', async () => {
      // Controller uses @Body('phone') and @Body('code') directly,
      // so missing fields pass through to the service
      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({})
        .expect(400);

      expect(response.body.message).toContain('OTP expired or not found');
    });
  });
});
