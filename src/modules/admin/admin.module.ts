import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { ReportsService } from './services/reports.service';
import { AuditLogService } from './services/audit-log.service';

@Module({
  controllers: [AdminController, AuditLogsController],
  providers: [AdminDashboardService, ReportsService, AuditLogService],
  exports: [AdminDashboardService, ReportsService, AuditLogService],
})
export class AdminModule {}
