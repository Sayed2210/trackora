import { Module } from '@nestjs/common';
import { PlatformFeatureFlagsController } from './controllers/platform-feature-flags.controller';
import { PlatformFeatureFlagsRepository } from './repositories/platform-feature-flags.repository';
import { PlatformFeatureFlagsService } from './services/platform-feature-flags.service';

@Module({
  controllers: [PlatformFeatureFlagsController],
  providers: [PlatformFeatureFlagsService, PlatformFeatureFlagsRepository],
})
export class PlatformFeatureFlagsModule {}
