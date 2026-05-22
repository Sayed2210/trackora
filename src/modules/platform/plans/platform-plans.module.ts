import { Module } from '@nestjs/common';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { PlatformPlansController } from './controllers/platform-plans.controller';
import { PlatformPlansRepository } from './repositories/platform-plans.repository';
import { PlatformPlansService } from './services/platform-plans.service';

@Module({
  imports: [PlatformAuditLogsModule],
  controllers: [PlatformPlansController],
  providers: [PlatformPlansRepository, PlatformPlansService],
  exports: [PlatformPlansService],
})
export class PlatformPlansModule {}
