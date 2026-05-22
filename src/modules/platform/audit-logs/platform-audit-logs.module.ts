import { Module } from '@nestjs/common';
import { PlatformAuditLogsController } from './controllers/platform-audit-logs.controller';
import { PlatformAuditLogsRepository } from './repositories/platform-audit-logs.repository';
import { PlatformAuditLogService } from './services/platform-audit-log.service';

@Module({
  controllers: [PlatformAuditLogsController],
  providers: [PlatformAuditLogsRepository, PlatformAuditLogService],
  exports: [PlatformAuditLogService],
})
export class PlatformAuditLogsModule {}
