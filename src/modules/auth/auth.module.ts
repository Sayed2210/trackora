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
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not defined');
        }
        return {
          secret,
          signOptions: {
            expiresIn: '15m',
          },
        };
      },
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
