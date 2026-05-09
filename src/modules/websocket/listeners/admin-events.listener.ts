import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketService } from '../websocket.service';
import type { WsAdminStatsEvent } from '../dtos/ws-event.dto';

@Injectable()
export class AdminEventsListener {
  private readonly logger = new Logger(AdminEventsListener.name);

  constructor(
    private readonly wsGateway: WebSocketGateway,
    private readonly wsService: WebSocketService,
  ) {}

  @OnEvent('admin.stats_changed')
  async handleAdminStatsChanged(payload: WsAdminStatsEvent): Promise<void> {
    const event = 'admin:stats_updated';
    const data = {
      activeShipments: payload.activeShipments,
      deliveredToday: payload.deliveredToday,
      failedToday: payload.failedToday,
      couriersAvailable: payload.couriersAvailable,
      codCollectedToday: payload.codCollectedToday,
    };

    await this.broadcastAndBuffer('admin:dashboard', event, data);
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
