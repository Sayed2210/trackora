import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { OtpService } from './services/otp.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthRepository } from './repositories/auth.repository';
import { RedisService } from '@infrastructure/cache/redis.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback-secret',
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_EXPIRES_IN',
            '15m',
          ) as `${number}m`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    OtpService,
    JwtStrategy,
    AuthRepository,
    RedisService,
  ],
  controllers: [AuthController],
  exports: [AuthService, OtpService],
})
export class AuthModule {}
