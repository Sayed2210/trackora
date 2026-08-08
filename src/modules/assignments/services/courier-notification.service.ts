import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/prisma/prisma.service';

interface AssignmentCreatedEvent {
  assignmentId: string;
  shipmentId: string;
  courierId: string;
  type: string;
  tenantId: string;
}

interface AssignmentCancelledEvent {
  assignmentId: string;
  shipmentId: string;
  courierId: string;
  reason: string;
  tenantId: string;
}

interface AssignmentCompletedEvent {
  assignmentId: string;
  shipmentId: string;
  courierId: string;
  tenantId: string;
}

@Injectable()
export class CourierNotificationService {
  private readonly logger = new Logger(CourierNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('assignment.created')
  async handleAssignmentCreated(event: AssignmentCreatedEvent): Promise<void> {
    this.logger.log(
      `Assignment created: ${event.assignmentId} for courier ${event.courierId}, shipment ${event.shipmentId}`,
    );

    try {
      const [courier, shipment] = await Promise.all([
        this.prisma.courier.findFirst({
          where: { id: event.courierId, tenantId: event.tenantId },
          include: { user: true },
        }),
        this.prisma.shipment.findFirst({
          where: { id: event.shipmentId, tenantId: event.tenantId },
        }),
      ]);

      if (!courier || !shipment) {
        this.logger.warn('Courier or shipment not found for notification');
        return;
      }

      // Create in-app notification
      await this.prisma.notification.create({
        data: {
          userId: courier.userId,
          tenantId: event.tenantId,
          shipmentId: shipment.id,
          type: 'SHIPMENT_ASSIGNED',
          title: 'طلب توصيل جديد',
          body: `لديك شحنة جديدة ${shipment.trackingNumber} إلى ${shipment.addressText}`,
          data: {
            assignmentId: event.assignmentId,
            trackingNumber: shipment.trackingNumber,
            customerName: shipment.customerName,
            addressText: shipment.addressText,
            codAmount: shipment.codAmount?.toString(),
          },
        },
      });

      // TODO: Integrate with Firebase Cloud Messaging for push
      // TODO: Integrate with Twilio for SMS fallback
      this.logger.log(`Notification queued for courier ${courier.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to send notification: ${message}`, err);
    }
  }

  @OnEvent('assignment.cancelled')
  async handleAssignmentCancelled(
    event: AssignmentCancelledEvent,
  ): Promise<void> {
    this.logger.log(
      `Assignment cancelled: ${event.assignmentId}, reason: ${event.reason}`,
    );

    try {
      const [courier, shipment] = await Promise.all([
        this.prisma.courier.findFirst({
          where: { id: event.courierId, tenantId: event.tenantId },
          include: { user: true },
        }),
        this.prisma.shipment.findFirst({
          where: { id: event.shipmentId, tenantId: event.tenantId },
        }),
      ]);

      if (!courier || !shipment) {
        this.logger.warn(
          'Courier or shipment not found for cancellation notification',
        );
        return;
      }

      await this.prisma.notification.create({
        data: {
          userId: courier.userId,
          tenantId: event.tenantId,
          shipmentId: shipment.id,
          type: 'SHIPMENT_STATUS_UPDATE',
          title: 'تم إلغاء الطلب',
          body: `تم إلغاء شحنة ${shipment.trackingNumber}. السبب: ${event.reason}`,
          data: {
            assignmentId: event.assignmentId,
            trackingNumber: shipment.trackingNumber,
          },
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Failed to send cancellation notification: ${message}`,
        err,
      );
    }
  }

  @OnEvent('assignment.completed')
  handleAssignmentCompleted(event: AssignmentCompletedEvent): void {
    this.logger.log(`Assignment completed: ${event.assignmentId}`);
  }
}
