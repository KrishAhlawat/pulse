import { Module } from '@nestjs/common';
import { NotificationQueue } from './notification.queue';
import { NotificationWorker } from './notification.worker';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [NotificationQueue, NotificationWorker],
  exports: [NotificationQueue],
})
export class QueueModule {}
