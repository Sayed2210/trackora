import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketService } from '../websocket.service';
import type {
  WsShipmentStatusChangedEvent,
  WsShipmentCreatedEvent,
} from '../dtos/ws-event.dto';

@Injectable()
export class ShipmentEventsListener {
  private readonly logger = new Logger(ShipmentEventsListener.name);

  constructor(
    private readonly wsGateway: WebSocketGateway,
    private readonly wsService: WebSocketService,
  ) {}

  @OnEvent('shipment.status_changed')
  async handleStatusChanged(
    payload: WsShipmentStatusChangedEvent,
  ): Promise<void> {
    const event = 'shipment:status_updated';
    const data = {
      shipmentId: payload.shipmentId,
      trackingNumber: payload.trackingNumber,
      previousStatus: payload.previousStatus,
      newStatus: payload.newStatus,
      codAmount: payload.codAmount,
      type: payload.type,
      updatedAt: payload.updatedAt,
    };

    await this.broadcastAndBuffer(
      `merchant:${payload.merchantId}`,
      event,
      data,
    );

    if (payload.courierId) {
      await this.broadcastAndBuffer(
        `courier:${payload.courierId}`,
        event,
        data,
      );
    }

    await this.broadcastAndBuffer(
      `shipment:${payload.trackingNumber}`,
      event,
      data,
    );
  }

  @OnEvent('shipment.created')
  async handleShipmentCreated(payload: WsShipmentCreatedEvent): Promise<void> {
    const event = 'shipment:created';
    const data = {
      shipmentId: payload.shipmentId,
      trackingNumber: payload.trackingNumber,
      status: payload.status,
      codAmount: payload.codAmount,
      type: payload.type,
    };

    await this.broadcastAndBuffer(
      `merchant:${payload.merchantId}`,
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
