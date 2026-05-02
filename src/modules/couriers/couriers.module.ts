import { Module } from '@nestjs/common';
import { CouriersRepository } from './repositories/couriers.repository';
import { CouriersService } from './services/couriers.service';
import { CouriersController } from './controllers/couriers.controller';

@Module({
  providers: [CouriersRepository, CouriersService],
  controllers: [CouriersController],
  exports: [CouriersService],
})
export class CouriersModule {}
