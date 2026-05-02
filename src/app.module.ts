import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from '@modules/users/users.module';
import { MerchantsModule } from '@modules/merchants/merchants.module';
import { CouriersModule } from '@modules/couriers/couriers.module';
import { AuthModule } from '@modules/auth/auth.module';
import { ShipmentsModule } from '@modules/shipments/shipments.module';

@Module({
  imports: [
    CoreModule,
    UsersModule,
    MerchantsModule,
    CouriersModule,
    AuthModule,
    ShipmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
