import { Module } from '@nestjs/common';
import { PlatformSubscriptionsController } from './controllers/platform-subscriptions.controller';
import { PlatformSubscriptionsRepository } from './repositories/platform-subscriptions.repository';
import { PlatformSubscriptionsService } from './services/platform-subscriptions.service';

@Module({
  controllers: [PlatformSubscriptionsController],
  providers: [PlatformSubscriptionsRepository, PlatformSubscriptionsService],
  exports: [PlatformSubscriptionsService],
})
export class PlatformSubscriptionsModule {}
