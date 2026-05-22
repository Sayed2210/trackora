import { Module } from '@nestjs/common';
import { PlatformAnalyticsController } from './controllers/platform-analytics.controller';
import { PlatformAnalyticsRepository } from './repositories/platform-analytics.repository';
import { PlatformAnalyticsService } from './services/platform-analytics.service';

@Module({
  controllers: [PlatformAnalyticsController],
  providers: [PlatformAnalyticsService, PlatformAnalyticsRepository],
})
export class PlatformAnalyticsModule {}
