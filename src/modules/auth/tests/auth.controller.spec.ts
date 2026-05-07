import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { OtpService } from '../services/otp.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { UserRole } from '../entities/auth.entity';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
};

const mockOtpService = {
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
};

const mockGuard = { canActivate: jest.fn(() => true) };

const mockTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 900,
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: OtpService, useValue: mockOtpService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register with dto fields', async () => {
      mockAuthService.register.mockResolvedValue(mockTokens);

      const dto = {
        phone: '01000000001',
        password: 'password123',
        name: 'Test User',
        role: UserRole.MERCHANT,
      };

      const result = await controller.register(dto as any);

      expect(mockAuthService.register).toHaveBeenCalledWith(
        '01000000001',
        'password123',
        'Test User',
        UserRole.MERCHANT,
      );
      expect(result).toEqual(mockTokens);
    });
  });

  describe('login', () => {
    it('should call authService.login with credentials', async () => {
      const mockLoginResponse = {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test User',
          phone: '01000000001',
          email: 'test@example.com',
          role: UserRole.MERCHANT,
          avatarUrl: null,
          phoneVerified: expect.any(Date),
          emailVerified: null,
        },
        ...mockTokens,
      };
      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const dto = { phone: '01000000001', password: 'password123' };
      const result = await controller.login(dto as any);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        '01000000001',
        'password123',
      );
      expect(result).toEqual(mockLoginResponse);
    });
  });

  describe('refreshTokens', () => {
    it('should call authService.refreshTokens', async () => {
      mockAuthService.refreshTokens.mockResolvedValue(mockTokens);

      const dto = { refreshToken: 'refresh-token' };
      const result = await controller.refreshTokens(dto as any);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('refresh-token');
      expect(result).toEqual(mockTokens);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with userId from request', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const req = { user: { userId: 'user-1' } } as any;
      const result = await controller.logout(req);

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('sendOtp', () => {
    it('should call otpService.sendOtp and return code', async () => {
      mockOtpService.sendOtp.mockResolvedValue('1234');

      const result = await controller.sendOtp('01000000001');

      expect(mockOtpService.sendOtp).toHaveBeenCalledWith('01000000001');
      expect(result).toEqual({ message: 'OTP sent', code: '1234' });
    });
  });

  describe('verifyOtp', () => {
    it('should call otpService.verifyOtp and return validity', async () => {
      mockOtpService.verifyOtp.mockResolvedValue(true);

      const result = await controller.verifyOtp('01000000001', '1234');

      expect(mockOtpService.verifyOtp).toHaveBeenCalledWith(
        '01000000001',
        '1234',
      );
      expect(result).toEqual({ valid: true });
    });
  });
});
