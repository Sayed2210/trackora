import { Module } from '@nestjs/common';
import { MerchantsRepository } from './repositories/merchants.repository';
import { MerchantsService } from './services/merchants.service';
import { MerchantsController } from './controllers/merchants.controller';
import { WalletsService } from '@modules/wallets/services/wallets.service';
import { WalletsRepository } from '@modules/wallets/repositories/wallets.repository';

@Module({
  providers: [
    MerchantsRepository,
    MerchantsService,
    WalletsService,
    WalletsRepository,
  ],
  controllers: [MerchantsController],
  exports: [MerchantsService],
})
export class MerchantsModule {}
