import { Queue } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { LOG_CONTEXTS } from '../logger/logger.constants';

export interface NotificationJobData {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
}

@Injectable()
export class NotificationQueue implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<NotificationJobData>;

  constructor(private readonly logger: LoggerService) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    
    const redisConfig = redisUrl
      ? { url: redisUrl }
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        };

    this.queue = new Queue<NotificationJobData>('notifications-queue', {
      connection: redisConfig as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // Start with 1s delay
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    this.logger.info('BullMQ notification queue initialized', LOG_CONTEXTS.QUEUE);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }

  /**
   * Enqueue a notification job for a specific recipient
   * Uses messageId:recipientId as jobId for idempotency
   */
  async enqueueNotification(data: NotificationJobData): Promise<void> {
    const jobId = `${data.messageId}:${data.recipientId}`;
    
    await this.queue.add('notify-user', data, {
      jobId, // Ensures idempotency - duplicate jobs are ignored
    });
  }

  /**
   * Get the underlying queue instance for worker access
   */
  getQueue(): Queue<NotificationJobData> {
    return this.queue;
  }
}
