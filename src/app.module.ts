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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
