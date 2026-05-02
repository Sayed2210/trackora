import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [ConfigModule, DatabaseModule, EventsModule],
})
export class CoreModule {}
