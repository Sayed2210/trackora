import { Module } from '@nestjs/common';
import { PlatformPlansController } from './controllers/platform-plans.controller';
import { PlatformPlansRepository } from './repositories/platform-plans.repository';
import { PlatformPlansService } from './services/platform-plans.service';

@Module({
  controllers: [PlatformPlansController],
  providers: [PlatformPlansRepository, PlatformPlansService],
  exports: [PlatformPlansService],
})
export class PlatformPlansModule {}
