/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentEventsListener } from '../listeners/shipment-events.listener';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketService } from '../websocket.service';

describe('ShipmentEventsListener', () => {
  let listener: ShipmentEventsListener;
  let wsGateway: WebSocketGateway;
  let wsService: WebSocketService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentEventsListener,
        {
          provide: WebSocketGateway,
          useValue: {
            server: mockServer,
          },
        },
        {
          provide: WebSocketService,
          useValue: {
            bufferEvent: jest.fn().mockResolvedValue('evt-1'),
          },
        },
      ],
    }).compile();

    listener = module.get<ShipmentEventsListener>(ShipmentEventsListener);
    wsGateway = module.get<WebSocketGateway>(WebSocketGateway);
    wsService = module.get<WebSocketService>(WebSocketService);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handleStatusChanged', () => {
    it('should broadcast to merchant, courier, and tracking rooms', async () => {
      const payload = {
        shipmentId: 'ship-1',
        trackingNumber: 'TRK-001',
        merchantId: 'merchant-1',
        courierId: 'courier-1',
        previousStatus: 'PENDING' as any,
        newStatus: 'PICKED_UP' as any,
        codAmount: 500,
        type: 'COD' as any,
        updatedAt: new Date().toISOString(),
      };

      await listener.handleStatusChanged(payload);

      expect(wsGateway.server.to).toHaveBeenCalledWith('merchant:merchant-1');
      expect(wsGateway.server.to).toHaveBeenCalledWith('courier:courier-1');
      expect(wsGateway.server.to).toHaveBeenCalledWith('shipment:TRK-001');
      expect(wsService.bufferEvent).toHaveBeenCalledTimes(3);
    });

    it('should not broadcast to courier room when courierId is undefined', async () => {
      const payload = {
        shipmentId: 'ship-1',
        trackingNumber: 'TRK-001',
        merchantId: 'merchant-1',
        courierId: undefined,
        previousStatus: 'PENDING' as any,
        newStatus: 'CANCELLED' as any,
        codAmount: 0,
        type: 'PREPAID' as any,
        updatedAt: new Date().toISOString(),
      };

      await listener.handleStatusChanged(payload);

      expect(wsGateway.server.to).toHaveBeenCalledWith('merchant:merchant-1');
      expect(wsGateway.server.to).toHaveBeenCalledWith('shipment:TRK-001');
      expect(wsService.bufferEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleShipmentCreated', () => {
    it('should broadcast to merchant room', async () => {
      const payload = {
        shipmentId: 'ship-1',
        trackingNumber: 'TRK-001',
        merchantId: 'merchant-1',
        status: 'PENDING' as any,
        codAmount: 500,
        type: 'COD' as any,
      };

      await listener.handleShipmentCreated(payload);

      expect(wsGateway.server.to).toHaveBeenCalledWith('merchant:merchant-1');
      expect(wsService.bufferEvent).toHaveBeenCalledTimes(1);
    });
  });
});
