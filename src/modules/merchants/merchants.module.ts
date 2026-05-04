import { Module } from '@nestjs/common';
import { MerchantsRepository } from './repositories/merchants.repository';
import { MerchantsService } from './services/merchants.service';
import { MerchantsController } from './controllers/merchants.controller';
import { MerchantDashboardController } from './controllers/merchant-dashboard.controller';
import { MerchantDashboardService } from './services/merchant-dashboard.service';
import { WalletsModule } from '@modules/wallets/wallets.module';

@Module({
  imports: [WalletsModule],
  providers: [MerchantsRepository, MerchantsService, MerchantDashboardService],
  controllers: [MerchantsController, MerchantDashboardController],
  exports: [MerchantsService],
})
export class MerchantsModule {}
