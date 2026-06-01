import { Module } from '@nestjs/common';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { PlatformPlansController } from './controllers/platform-plans.controller';
import { PublicPlansController } from './controllers/public-plans.controller';
import { PlatformPlansRepository } from './repositories/platform-plans.repository';
import { PlatformPlansService } from './services/platform-plans.service';
import { PublicPlansService } from './services/public-plans.service';

@Module({
  imports: [PlatformAuditLogsModule],
  controllers: [PlatformPlansController, PublicPlansController],
  providers: [PlatformPlansRepository, PlatformPlansService, PublicPlansService],
  exports: [PlatformPlansService],
})
export class PlatformPlansModule {}
