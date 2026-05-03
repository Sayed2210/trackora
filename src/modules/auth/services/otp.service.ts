import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '@infrastructure/cache/redis.service';

interface OtpRecord {
  code: string;
  attempts: number;
  verified: boolean;
}

@Injectable()
export class OtpService {
  private readonly OTP_TTL = 300; // 5 minutes
  private readonly MAX_ATTEMPTS = 3;
  private readonly OTP_PREFIX = 'otp:';
  private readonly ATTEMPT_PREFIX = 'otp_attempts:';

  constructor(private readonly redis: RedisService) {}

  generateCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async sendOtp(phone: string): Promise<string> {
    const code = this.generateCode();
    const key = `${this.OTP_PREFIX}${phone}`;
    const attemptKey = `${this.ATTEMPT_PREFIX}${phone}`;

    await this.redis.setJson<OtpRecord>(
      key,
      { code, attempts: 0, verified: false },
      this.OTP_TTL,
    );
    await this.redis.del(attemptKey);

    // TODO: Integrate Twilio for actual SMS delivery
    // For now, log the code (dev only)
    console.log(`[OTP] Code for ${phone}: ${code}`);

    return code;
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const key = `${this.OTP_PREFIX}${phone}`;
    const record = await this.redis.getJson<OtpRecord>(key);

    if (!record) {
      throw new BadRequestException('OTP expired or not found');
    }

    if (record.verified) {
      throw new BadRequestException('OTP already used');
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      await this.redis.del(key);
      throw new BadRequestException(
        'Maximum attempts exceeded. Request a new OTP.',
      );
    }

    record.attempts += 1;
    await this.redis.setJson(key, record, this.OTP_TTL);

    if (record.code !== code) {
      const remaining = this.MAX_ATTEMPTS - record.attempts;
      throw new BadRequestException(
        `Invalid OTP. ${remaining} attempts remaining.`,
      );
    }

    record.verified = true;
    await this.redis.setJson(key, record, this.OTP_TTL);

    return true;
  }

  async resendOtp(phone: string): Promise<string> {
    await this.redis.del(`${this.OTP_PREFIX}${phone}`);
    await this.redis.del(`${this.ATTEMPT_PREFIX}${phone}`);
    return this.sendOtp(phone);
  }
}
