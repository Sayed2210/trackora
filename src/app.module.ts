import { Module } from '@nestjs/common';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
