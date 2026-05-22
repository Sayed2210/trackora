import { Module } from '@nestjs/common';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { PlatformSubscriptionsController } from './controllers/platform-subscriptions.controller';
import { PlatformSubscriptionsRepository } from './repositories/platform-subscriptions.repository';
import { PlatformSubscriptionsService } from './services/platform-subscriptions.service';

@Module({
  imports: [PlatformAuditLogsModule],
  controllers: [PlatformSubscriptionsController],
  providers: [PlatformSubscriptionsRepository, PlatformSubscriptionsService],
  exports: [PlatformSubscriptionsService],
})
export class PlatformSubscriptionsModule {}
