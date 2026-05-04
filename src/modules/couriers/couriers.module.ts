import { Module } from '@nestjs/common';
import { ShipmentsModule } from '@modules/shipments/shipments.module';
import { AssignmentsModule } from '@modules/assignments/assignments.module';
import { CouriersRepository } from './repositories/couriers.repository';
import { CouriersService } from './services/couriers.service';
import { CourierAppService } from './services/courier-app.service';
import { CouriersController } from './controllers/couriers.controller';
import { CourierAppController } from './controllers/courier-app.controller';

@Module({
  imports: [ShipmentsModule, AssignmentsModule],
  providers: [CouriersRepository, CouriersService, CourierAppService],
  controllers: [CouriersController, CourierAppController],
  exports: [CouriersService, CourierAppService],
})
export class CouriersModule {}
