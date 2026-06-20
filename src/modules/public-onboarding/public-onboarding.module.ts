import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { PublicOnboardingController } from './controllers/public-onboarding.controller';
import { PublicOnboardingService } from './services/public-onboarding.service';

@Module({
  imports: [AuthModule, PlatformAuditLogsModule],
  controllers: [PublicOnboardingController],
  providers: [PublicOnboardingService],
  exports: [PublicOnboardingService],
})
export class PublicOnboardingModule {}
