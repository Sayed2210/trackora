import { Module } from '@nestjs/common';
import { PlatformBillingController } from './controllers/platform-billing.controller';
import { PlatformBillingRepository } from './repositories/platform-billing.repository';
import { PlatformBillingService } from './services/platform-billing.service';

@Module({
  controllers: [PlatformBillingController],
  providers: [PlatformBillingRepository, PlatformBillingService],
  exports: [PlatformBillingService],
})
export class PlatformBillingModule {}
