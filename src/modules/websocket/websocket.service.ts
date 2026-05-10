import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@infrastructure/cache/redis.service';

interface BufferedEvent {
  id: string;
  event: string;
  data: unknown;
  timestamp: number;
}

interface EventBuffer {
  events: string[];
}

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);
  private readonly EVENT_BUFFER_TTL = 86400;
  private readonly MAX_EVENTS_PER_ROOM = 100;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async bufferEvent(
    roomId: string,
    event: string,
    data: unknown,
  ): Promise<string> {
    const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const key = `ws:events:${roomId}`;

    const entry: BufferedEvent = {
      id: eventId,
      event,
      data,
      timestamp: Date.now(),
    };
    const entryStr = JSON.stringify(entry);

    const exists = await this.redis.exists(key);
    if (!exists) {
      await this.redis.setJson<EventBuffer>(
        key,
        { events: [entryStr] },
        this.EVENT_BUFFER_TTL,
      );
    } else {
      const raw = await this.redis.get(key);
      if (raw) {
        try {
          const stored = JSON.parse(raw) as EventBuffer | string[];
          const events: string[] = Array.isArray(stored)
            ? stored
            : stored.events || [];
          events.push(entryStr);
          if (events.length > this.MAX_EVENTS_PER_ROOM) {
            events.splice(0, events.length - this.MAX_EVENTS_PER_ROOM);
          }
          await this.redis.set(
            key,
            JSON.stringify({ events }),
            this.EVENT_BUFFER_TTL,
          );
        } catch {
          await this.redis.set(
            key,
            JSON.stringify({ events: [entryStr] }),
            this.EVENT_BUFFER_TTL,
          );
        }
      }
    }

    return eventId;
  }

  async getMissedEvents(
    roomId: string,
    afterEventId: string,
  ): Promise<BufferedEvent[]> {
    const key = `ws:events:${roomId}`;
    const raw = await this.redis.get(key);
    if (!raw) return [];

    try {
      const stored = JSON.parse(raw) as EventBuffer | string[];
      const events: string[] = Array.isArray(stored)
        ? stored
        : stored.events || [];
      const parsed: BufferedEvent[] = events
        .map((e: string): BufferedEvent | null => {
          try {
            return JSON.parse(e) as BufferedEvent;
          } catch {
            return null;
          }
        })
        .filter((e: BufferedEvent | null): e is BufferedEvent => e !== null);

      const afterIndex = parsed.findIndex(
        (e: BufferedEvent) => e.id === afterEventId,
      );
      if (afterIndex === -1) return parsed;
      return parsed.slice(afterIndex + 1);
    } catch {
      return [];
    }
  }
}
