import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { ShipmentEventsListener } from './listeners/shipment-events.listener';
import { AssignmentEventsListener } from './listeners/assignment-events.listener';
import { WalletEventsListener } from './listeners/wallet-events.listener';
import { AdminEventsListener } from './listeners/admin-events.listener';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    WebSocketGateway,
    WebSocketService,
    ShipmentEventsListener,
    AssignmentEventsListener,
    WalletEventsListener,
    AdminEventsListener,
  ],
  exports: [WebSocketGateway, WebSocketService],
})
export class WebSocketModule {}
