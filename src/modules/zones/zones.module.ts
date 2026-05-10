import { Module } from '@nestjs/common';
import { ZonesRepository } from './repositories/zones.repository';
import { ZonesService } from './services/zones.service';
import { ZonesController } from './controllers/zones.controller';

@Module({
  providers: [ZonesRepository, ZonesService],
  controllers: [ZonesController],
  exports: [ZonesService],
})
export class ZonesModule {}
