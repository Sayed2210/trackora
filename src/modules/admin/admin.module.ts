import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { ReportsService } from './services/reports.service';
import { AuditLogService } from './services/audit-log.service';
import { AdminShipmentBulkUploadController } from './controllers/admin-shipment-bulk-upload.controller';
import { ShipmentsModule } from '@modules/shipments/shipments.module';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';

@Module({
  imports: [ShipmentsModule, PlatformAuditLogsModule],
  controllers: [
    AdminController,
    AuditLogsController,
    AdminShipmentBulkUploadController,
  ],
  providers: [AdminDashboardService, ReportsService, AuditLogService],
  exports: [AdminDashboardService, ReportsService, AuditLogService],
})
export class AdminModule {}
