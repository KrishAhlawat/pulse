import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { LoggerModule } from '../logger/logger.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    AuthModule,
    MessagesModule,
    ConversationsModule,
    PrismaModule,
    RedisModule,
    RateLimitModule,
    LoggerModule,
    MetricsModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class WebsocketModule {}
