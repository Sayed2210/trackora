import { Module } from '@nestjs/common';
import { ShipmentsRepository } from './repositories/shipments.repository';
import { ShipmentStatusLogsRepository } from './repositories/shipment-status-logs.repository';
import { ShipmentsService } from './services/shipments.service';
import { StateMachineService } from './services/state-machine.service';
import { TrackingNumberService } from './services/tracking-number.service';
import { FraudDetectionService } from './services/fraud-detection.service';
import { ShipmentsController } from './controllers/shipments.controller';

@Module({
  providers: [
    ShipmentsRepository,
    ShipmentStatusLogsRepository,
    ShipmentsService,
    StateMachineService,
    TrackingNumberService,
    FraudDetectionService,
  ],
  controllers: [ShipmentsController],
  exports: [ShipmentsService, TrackingNumberService],
})
export class ShipmentsModule {}
