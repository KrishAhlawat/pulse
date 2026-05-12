import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

@Module({
  imports: [
    AuthModule,
    MessagesModule,
    ConversationsModule,
    PrismaModule,
    RedisModule,
    RateLimitModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class WebsocketModule {}
