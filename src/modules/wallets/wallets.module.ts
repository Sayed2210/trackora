import { Module } from '@nestjs/common';
import { WalletsRepository } from './repositories/wallets.repository';
import { WalletsService } from './services/wallets.service';

@Module({
  providers: [WalletsRepository, WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
