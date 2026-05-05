import { Module } from '@nestjs/common';
import { AssignmentsRepository } from './repositories/assignments.repository';
import { AssignmentsService } from './services/assignments.service';
import { CourierNotificationService } from './services/courier-notification.service';
import { AssignmentsController } from './controllers/assignments.controller';

@Module({
  providers: [
    AssignmentsRepository,
    AssignmentsService,
    CourierNotificationService,
  ],
  controllers: [AssignmentsController],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
