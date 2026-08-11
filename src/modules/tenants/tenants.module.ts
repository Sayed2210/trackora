import { Module } from '@nestjs/common';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { TenantsController } from './controllers/tenants.controller';
import { TenantsRepository } from './repositories/tenants.repository';
import { TenantsService } from './services/tenants.service';
import { TenantOnboardingService } from './services/tenant-onboarding.service';
import { TenantConfigurationCloneService } from './services/tenant-configuration-clone.service';

@Module({
  imports: [PlatformAuditLogsModule],
  controllers: [TenantsController],
  providers: [
    TenantsRepository,
    TenantsService,
    TenantOnboardingService,
    TenantConfigurationCloneService,
  ],
  exports: [
    TenantsService,
    TenantOnboardingService,
    TenantConfigurationCloneService,
  ],
})
export class TenantsModule {}
