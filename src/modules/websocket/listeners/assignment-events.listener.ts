import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/prisma/prisma.service';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketService } from '../websocket.service';

@Injectable()
export class AssignmentEventsListener {
  private readonly logger = new Logger(AssignmentEventsListener.name);

  constructor(
    private readonly wsGateway: WebSocketGateway,
    private readonly wsService: WebSocketService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('assignment.created')
  async handleAssignmentCreated(payload: {
    assignmentId: string;
    shipmentId: string;
    courierId: string;
    type: string;
    tenantId: string;
  }): Promise<void> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: payload.shipmentId, tenantId: payload.tenantId },
    });

    if (!shipment) return;

    const event = 'assignment:created';
    const data = {
      assignmentId: payload.assignmentId,
      shipmentId: payload.shipmentId,
      trackingNumber: shipment.trackingNumber,
      customerName: shipment.customerName,
      addressText: shipment.addressText,
      codAmount: shipment.codAmount?.toString(),
      assignmentType: payload.type,
    };

    await this.broadcastAndBuffer(
      `tenant:${payload.tenantId}:courier:${payload.courierId}`,
      event,
      data,
    );
  }

  @OnEvent('assignment.cancelled')
  async handleAssignmentCancelled(payload: {
    assignmentId: string;
    shipmentId: string;
    courierId: string;
    reason: string;
    tenantId: string;
  }): Promise<void> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: payload.shipmentId, tenantId: payload.tenantId },
    });

    const event = 'assignment:cancelled';
    const data = {
      assignmentId: payload.assignmentId,
      trackingNumber: shipment?.trackingNumber,
      reason: payload.reason,
    };

    await this.broadcastAndBuffer(
      `tenant:${payload.tenantId}:courier:${payload.courierId}`,
      event,
      data,
    );
  }

  private async broadcastAndBuffer(
    roomId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    this.wsGateway.server.to(roomId).emit(event, data);
    await this.wsService.bufferEvent(roomId, event, data);
  }
}
