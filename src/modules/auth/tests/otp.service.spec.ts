import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OtpService } from '../services/otp.service';
import { RedisService } from '@infrastructure/cache/redis.service';

describe('OtpService', () => {
  let service: OtpService;
  let redis: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: RedisService,
          useValue: {
            setJson: jest.fn().mockResolvedValue(undefined),
            getJson: jest.fn().mockResolvedValue(null),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    redis = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateCode', () => {
    it('should generate a 4-digit string', () => {
      const code = service.generateCode();
      expect(code).toMatch(/^\d{4}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(1000);
      expect(Number(code)).toBeLessThanOrEqual(9999);
    });

    it('should generate different codes on multiple calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        codes.add(service.generateCode());
      }
      expect(codes.size).toBeGreaterThan(15);
    });
  });

  describe('sendOtp', () => {
    it('should generate and store OTP in Redis', async () => {
      const phone = '01012345678';
      const code = await service.sendOtp(phone);

      expect(code).toMatch(/^\d{4}$/);
      expect(redis.setJson).toHaveBeenCalledWith(
        `otp:${phone}`,
        expect.objectContaining({
          code,
          attempts: 0,
          verified: false,
        }),
        300,
      );
      expect(redis.del).toHaveBeenCalledWith(`otp_attempts:${phone}`);
    });
  });

  describe('verifyOtp', () => {
    it('should return true for valid OTP', async () => {
      const phone = '01012345678';
      const code = '1234';

      (redis.getJson as jest.Mock).mockResolvedValueOnce({
        code,
        attempts: 0,
        verified: false,
      });

      const result = await service.verifyOtp(phone, code);
      expect(result).toBe(true);
      expect(redis.setJson).toHaveBeenLastCalledWith(
        `otp:${phone}`,
        expect.objectContaining({
          code,
          attempts: 1,
          verified: true,
        }),
        300,
      );
    });

    it('should throw if OTP expired or not found', async () => {
      (redis.getJson as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.verifyOtp('01012345678', '1234'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw "OTP expired or not found" message', async () => {
      (redis.getJson as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.verifyOtp('01012345678', '1234'),
      ).rejects.toThrow('OTP expired or not found');
    });

    it('should throw if OTP already used', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        code: '1234',
        attempts: 1,
        verified: true,
      });

      await expect(
        service.verifyOtp('01012345678', '1234'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyOtp('01012345678', '1234'),
      ).rejects.toThrow('OTP already used');
    });

    it('should throw on max attempts exceeded', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue({
        code: '1234',
        attempts: 3,
        verified: false,
      });

      await expect(
        service.verifyOtp('01012345678', '9999'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyOtp('01012345678', '9999'),
      ).rejects.toThrow('Maximum attempts exceeded');
      expect(redis.del).toHaveBeenCalledWith('otp:01012345678');
    });

    it('should throw with remaining attempts for wrong code', async () => {
      // Return a fresh object on each call to avoid mutation side effects
      (redis.getJson as jest.Mock)
        .mockResolvedValueOnce({ code: '1234', attempts: 0, verified: false })
        .mockResolvedValueOnce({ code: '1234', attempts: 0, verified: false });

      await expect(
        service.verifyOtp('01012345678', '9999'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyOtp('01012345678', '9999'),
      ).rejects.toThrow('2 attempts remaining');

      expect(redis.setJson).toHaveBeenCalledWith(
        'otp:01012345678',
        expect.objectContaining({ attempts: 1 }),
        300,
      );
    });

    it('should throw with 1 attempt remaining on second failure', async () => {
      (redis.getJson as jest.Mock).mockResolvedValueOnce({
        code: '1234',
        attempts: 1,
        verified: false,
      });

      await expect(
        service.verifyOtp('01012345678', '9999'),
      ).rejects.toThrow('1 attempts remaining');
    });

    it('should block after 3 failed attempts', async () => {
      // Attempt 1: wrong code (attempts=0 -> 1)
      (redis.getJson as jest.Mock).mockResolvedValueOnce({
        code: '1234',
        attempts: 0,
        verified: false,
      });
      await expect(
        service.verifyOtp('01012345678', '0000'),
      ).rejects.toThrow('2 attempts remaining');

      // Attempt 2: wrong code (attempts=1 -> 2)
      (redis.getJson as jest.Mock).mockResolvedValueOnce({
        code: '1234',
        attempts: 1,
        verified: false,
      });
      await expect(
        service.verifyOtp('01012345678', '0000'),
      ).rejects.toThrow('1 attempts remaining');

      // Attempt 3: wrong code (attempts=2 -> 3, then 0 remaining)
      (redis.getJson as jest.Mock).mockResolvedValueOnce({
        code: '1234',
        attempts: 2,
        verified: false,
      });
      await expect(
        service.verifyOtp('01012345678', '0000'),
      ).rejects.toThrow('0 attempts remaining');
    });
  });

  describe('resendOtp', () => {
    it('should delete old OTP and send new one', async () => {
      const phone = '01012345678';
      const code = await service.resendOtp(phone);

      expect(redis.del).toHaveBeenCalledWith(`otp:${phone}`);
      expect(redis.del).toHaveBeenCalledWith(`otp_attempts:${phone}`);
      expect(code).toMatch(/^\d{4}$/);
      expect(redis.setJson).toHaveBeenCalledWith(
        `otp:${phone}`,
        expect.objectContaining({
          code,
          attempts: 0,
          verified: false,
        }),
        300,
      );
    });
  });
});
