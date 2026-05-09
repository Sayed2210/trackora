import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketService } from '../websocket.service';
import { RedisService } from '@infrastructure/cache/redis.service';
import { ConfigService } from '@nestjs/config';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketService,
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    service = module.get<WebSocketService>(WebSocketService);
    redisService = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMissedEvents', () => {
    it('should return empty array when no events exist', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null);
      const events = await service.getMissedEvents('merchant:123', 'evt-1');
      expect(events).toEqual([]);
    });

    it('should return empty array when Redis data is invalid', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue('invalid-json');
      const events = await service.getMissedEvents('merchant:123', 'evt-1');
      expect(events).toEqual([]);
    });
  });
});
