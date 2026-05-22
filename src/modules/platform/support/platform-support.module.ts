import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { PlatformSupportController } from './controllers/platform-support.controller';
import { PlatformSupportRepository } from './repositories/platform-support.repository';
import { PlatformSupportService } from './services/platform-support.service';

@Module({
  imports: [
    PlatformAuditLogsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET is not defined');
        return { secret, signOptions: { expiresIn: '15m' } };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [PlatformSupportController],
  providers: [PlatformSupportRepository, PlatformSupportService],
  exports: [PlatformSupportService],
})
export class PlatformSupportModule {}
