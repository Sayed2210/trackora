import { Module } from '@nestjs/common';
import { WalletsRepository } from './repositories/wallets.repository';
import { WalletsService } from './services/wallets.service';
import { TransactionsService } from './services/transactions.service';
import { FeeCalculatorService } from './services/fee-calculator.service';
import { WalletsController } from './controllers/wallets.controller';
import { ShipmentDeliveredListener } from './listeners/shipment-delivered.listener';

@Module({
  providers: [
    WalletsRepository,
    WalletsService,
    TransactionsService,
    FeeCalculatorService,
    ShipmentDeliveredListener,
  ],
  controllers: [WalletsController],
  exports: [WalletsService, TransactionsService, FeeCalculatorService],
})
export class WalletsModule {}
