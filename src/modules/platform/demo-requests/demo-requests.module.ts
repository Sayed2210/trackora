import { Module } from '@nestjs/common';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { DemoRequestsController } from './controllers/demo-requests.controller';
import { DemoRequestsRepository } from './repositories/demo-requests.repository';
import { DemoRequestsService } from './services/demo-requests.service';

@Module({
  imports: [PlatformAuditLogsModule],
  controllers: [DemoRequestsController],
  providers: [DemoRequestsRepository, DemoRequestsService],
  exports: [DemoRequestsService],
})
export class DemoRequestsModule {}
