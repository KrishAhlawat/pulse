import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    WebsocketModule,
  ],
})
export class AppModule {}
