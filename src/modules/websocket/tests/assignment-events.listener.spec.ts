import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentEventsListener } from '../listeners/assignment-events.listener';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketService } from '../websocket.service';
import { PrismaService } from '@core/prisma/prisma.service';

describe('AssignmentEventsListener', () => {
  let listener: AssignmentEventsListener;
  let wsGateway: WebSocketGateway;
  let wsService: WebSocketService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  const mockShipment = {
    id: 'ship-1',
    trackingNumber: 'TRK-001',
    customerName: 'Ahmed',
    addressText: 'Cairo',
    codAmount: 500,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentEventsListener,
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
        {
          provide: PrismaService,
          useValue: {
            shipment: {
              findUnique: jest.fn().mockResolvedValue(mockShipment),
            },
          },
        },
      ],
    }).compile();

    listener = module.get<AssignmentEventsListener>(AssignmentEventsListener);
    wsGateway = module.get<WebSocketGateway>(WebSocketGateway);
    wsService = module.get<WebSocketService>(WebSocketService);
  });

  it('should broadcast assignment:created to courier room', async () => {
    await listener.handleAssignmentCreated({
      assignmentId: 'assign-1',
      shipmentId: 'ship-1',
      courierId: 'courier-1',
      type: 'MANUAL',
    });

    expect(wsGateway.server.to).toHaveBeenCalledWith('courier:courier-1');
    expect(wsService.bufferEvent).toHaveBeenCalledWith(
      'courier:courier-1',
      'assignment:created',
      expect.objectContaining({ assignmentId: 'assign-1' }),
    );
  });

  it('should broadcast assignment:cancelled to courier room', async () => {
    await listener.handleAssignmentCancelled({
      assignmentId: 'assign-1',
      shipmentId: 'ship-1',
      courierId: 'courier-1',
      reason: 'Reassigned',
    });

    expect(wsGateway.server.to).toHaveBeenCalledWith('courier:courier-1');
    expect(wsService.bufferEvent).toHaveBeenCalledWith(
      'courier:courier-1',
      'assignment:cancelled',
      expect.objectContaining({ assignmentId: 'assign-1' }),
    );
  });
});
