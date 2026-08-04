import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketService } from '../websocket.service';
import type { WsWalletBalanceUpdatedEvent } from '../dtos/ws-event.dto';

@Injectable()
export class WalletEventsListener {
  private readonly logger = new Logger(WalletEventsListener.name);

  constructor(
    private readonly wsGateway: WebSocketGateway,
    private readonly wsService: WebSocketService,
  ) {}

  @OnEvent('wallet.balance_updated')
  async handleWalletBalanceUpdated(
    payload: WsWalletBalanceUpdatedEvent,
  ): Promise<void> {
    const event = 'wallet:balance_updated';
    const data = {
      walletId: payload.walletId,
      merchantId: payload.merchantId,
      balance: payload.balance,
      transactionType: payload.transactionType,
      amount: payload.amount,
      runningBalance: payload.runningBalance,
    };

    await this.broadcastAndBuffer(
      `tenant:${payload.tenantId}:merchant:${payload.merchantId}`,
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
