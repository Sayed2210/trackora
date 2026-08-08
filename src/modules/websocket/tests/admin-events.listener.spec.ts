import { Test, TestingModule } from '@nestjs/testing';
import { AdminEventsListener } from '../listeners/admin-events.listener';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketService } from '../websocket.service';

describe('AdminEventsListener', () => {
  let listener: AdminEventsListener;
  let wsGateway: WebSocketGateway;
  let wsService: WebSocketService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEventsListener,
        {
          provide: WebSocketGateway,
          useValue: { server: mockServer },
        },
        {
          provide: WebSocketService,
          useValue: {
            bufferEvent: jest.fn().mockResolvedValue('evt-1'),
          },
        },
      ],
    }).compile();

    listener = module.get<AdminEventsListener>(AdminEventsListener);
    wsGateway = module.get<WebSocketGateway>(WebSocketGateway);
    wsService = module.get<WebSocketService>(WebSocketService);
  });

  it('should broadcast admin:stats_updated to admin:dashboard room', async () => {
    const payload = {
      tenantId: 'tenant-1',
      activeShipments: 150,
      deliveredToday: 45,
      failedToday: 8,
      couriersAvailable: 22,
      codCollectedToday: 50000,
    };

    await listener.handleAdminStatsChanged(payload);

    expect(wsGateway.server.to).toHaveBeenCalledWith(
      'tenant:tenant-1:admin:dashboard',
    );
    expect(wsService.bufferEvent).toHaveBeenCalledWith(
      'tenant:tenant-1:admin:dashboard',
      'admin:stats_updated',
      expect.objectContaining({ activeShipments: 150 }),
    );
  });
});
