import { Module } from '@nestjs/common';
import { MerchantsRepository } from './repositories/merchants.repository';
import { MerchantsService } from './services/merchants.service';
import { MerchantsController } from './controllers/merchants.controller';

@Module({
  providers: [MerchantsRepository, MerchantsService],
  controllers: [MerchantsController],
  exports: [MerchantsService],
})
export class MerchantsModule {}
