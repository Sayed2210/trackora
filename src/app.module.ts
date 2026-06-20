import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CoreModule } from './core/core.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from '@infrastructure/cache/cache.module';
import { RateLimitModule } from '@infrastructure/rate-limit/rate-limit.module';
import { UsersModule } from '@modules/users/users.module';
import { MerchantsModule } from '@modules/merchants/merchants.module';
import { CouriersModule } from '@modules/couriers/couriers.module';
import { AuthModule } from '@modules/auth/auth.module';
import { ShipmentsModule } from '@modules/shipments/shipments.module';
import { WalletsModule } from '@modules/wallets/wallets.module';
import { AssignmentsModule } from '@modules/assignments/assignments.module';
import { AdminModule } from '@modules/admin/admin.module';
import { ZonesModule } from '@modules/zones/zones.module';
import { WebSocketModule } from '@modules/websocket/websocket.module';
import { PayoutsModule } from '@modules/payouts/payouts.module';
import { TenantsModule } from '@modules/tenants/tenants.module';
import { PlatformPlansModule } from '@modules/platform/plans/platform-plans.module';
import { PlatformSubscriptionsModule } from '@modules/platform/subscriptions/platform-subscriptions.module';
import { PlatformFeatureFlagsModule } from '@modules/platform/feature-flags/platform-feature-flags.module';
import { PlatformAnalyticsModule } from '@modules/platform/analytics/platform-analytics.module';
import { PlatformBillingModule } from '@modules/platform/billing/platform-billing.module';
import { PlatformAuditLogsModule } from '@modules/platform/audit-logs/platform-audit-logs.module';
import { PlatformSupportModule } from '@modules/platform/support/platform-support.module';
import { PublicOnboardingModule } from '@modules/public-onboarding/public-onboarding.module';
import { DangerousActionGuard } from '@common/guards/dangerous-action.guard';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { PermissionsGuard } from '@common/guards/permissions.guard';

@Module({
  imports: [
    CoreModule,
    CacheModule,
    RateLimitModule,
    UsersModule,
    MerchantsModule,
    CouriersModule,
    AuthModule,
    ShipmentsModule,
    WalletsModule,
    AssignmentsModule,
    AdminModule,
    ZonesModule,
    WebSocketModule,
    PayoutsModule,
    TenantsModule,
    PlatformPlansModule,
    PlatformSubscriptionsModule,
    PlatformFeatureFlagsModule,
    PlatformAnalyticsModule,
    PlatformBillingModule,
    PlatformAuditLogsModule,
    PlatformSupportModule,
    PublicOnboardingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: DangerousActionGuard },
  ],
})
export class AppModule {}
