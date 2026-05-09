import { Test, TestingModule } from '@nestjs/testing';
import { WalletEventsListener } from '../listeners/wallet-events.listener';
import { WebSocketGateway } from '../websocket.gateway';
import { WebSocketService } from '../websocket.service';

describe('WalletEventsListener', () => {
  let listener: WalletEventsListener;
  let wsGateway: WebSocketGateway;
  let wsService: WebSocketService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletEventsListener,
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

    listener = module.get<WalletEventsListener>(WalletEventsListener);
    wsGateway = module.get<WebSocketGateway>(WebSocketGateway);
    wsService = module.get<WebSocketService>(WebSocketService);
  });

  it('should broadcast wallet:balance_updated to merchant room', async () => {
    const payload = {
      walletId: 'wallet-1',
      merchantId: 'merchant-1',
      balance: 950,
      transactionType: 'COD_CREDIT',
      amount: 1000,
      runningBalance: 950,
    };

    await listener.handleWalletBalanceUpdated(payload);

    expect(wsGateway.server.to).toHaveBeenCalledWith('merchant:merchant-1');
    expect(wsService.bufferEvent).toHaveBeenCalledWith(
      'merchant:merchant-1',
      'wallet:balance_updated',
      expect.objectContaining({ walletId: 'wallet-1' }),
    );
  });
});
