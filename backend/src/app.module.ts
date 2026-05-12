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

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    SupabaseModule,
    QueueModule,
    RateLimitModule,
    AuthModule,
    WebsocketModule,
    ConversationsModule,
    MessagesModule,
    MediaModule,
  ],
})
export class AppModule {}
