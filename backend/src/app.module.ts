import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { SupabaseModule } from './supabase/supabase.module';
import { MediaModule } from './media/media.module';
import { QueueModule } from './queue/queue.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { LoggerModule } from './logger/logger.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Infrastructure (order matters: logger + metrics first)
    LoggerModule,
    MetricsModule,
    PrismaModule,
    RedisModule,
    SupabaseModule,
    QueueModule,
    RateLimitModule,
    // Feature modules
    AuthModule,
    WebsocketModule,
    ConversationsModule,
    MessagesModule,
    MediaModule,
    // Diagnostics
    HealthModule,
  ],
})
export class AppModule {}
