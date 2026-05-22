import { Module } from '@nestjs/common';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { PlatformBillingController } from './controllers/platform-billing.controller';
import { PlatformBillingRepository } from './repositories/platform-billing.repository';
import { PlatformBillingService } from './services/platform-billing.service';

@Module({
  imports: [PlatformAuditLogsModule],
  controllers: [PlatformBillingController],
  providers: [PlatformBillingRepository, PlatformBillingService],
  exports: [PlatformBillingService],
})
export class PlatformBillingModule {}
