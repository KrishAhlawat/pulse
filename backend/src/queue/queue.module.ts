import { Module } from '@nestjs/common';
import { NotificationQueue } from './notification.queue';
import { NotificationWorker } from './notification.worker';
import { RedisModule } from '../redis/redis.module';
import { LoggerModule } from '../logger/logger.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [RedisModule, LoggerModule, MetricsModule],
  providers: [NotificationQueue, NotificationWorker],
  exports: [NotificationQueue],
})
export class QueueModule {}
