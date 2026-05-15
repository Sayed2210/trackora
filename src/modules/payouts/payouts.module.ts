import { Module } from '@nestjs/common';
import { PayoutsController } from './controllers/payouts.controller';
import { PayoutsRepository } from './repositories/payouts.repository';
import { PayoutsService } from './services/payouts.service';

@Module({
  controllers: [PayoutsController],
  providers: [PayoutsRepository, PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
