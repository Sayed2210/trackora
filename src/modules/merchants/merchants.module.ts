import { Module } from '@nestjs/common';
import { MerchantsRepository } from './repositories/merchants.repository';
import { MerchantsService } from './services/merchants.service';
import { MerchantsController } from './controllers/merchants.controller';
import { WalletsModule } from '@modules/wallets/wallets.module';

@Module({
  imports: [WalletsModule],
  providers: [MerchantsRepository, MerchantsService],
  controllers: [MerchantsController],
  exports: [MerchantsService],
})
export class MerchantsModule {}
