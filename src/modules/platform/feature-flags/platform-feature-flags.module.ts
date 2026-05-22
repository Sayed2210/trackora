import { Module } from '@nestjs/common';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { PlatformFeatureFlagsController } from './controllers/platform-feature-flags.controller';
import { PlatformFeatureFlagsRepository } from './repositories/platform-feature-flags.repository';
import { PlatformFeatureFlagsService } from './services/platform-feature-flags.service';

@Module({
  imports: [PlatformAuditLogsModule],
  controllers: [PlatformFeatureFlagsController],
  providers: [PlatformFeatureFlagsService, PlatformFeatureFlagsRepository],
})
export class PlatformFeatureFlagsModule {}
