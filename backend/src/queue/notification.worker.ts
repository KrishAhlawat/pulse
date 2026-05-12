import { Worker, Job } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NotificationJobData } from './notification.queue';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import { MetricsService } from '../metrics/metrics.service';
import { LOG_CONTEXTS } from '../logger/logger.constants';

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<NotificationJobData>;

  constructor(
    private redisService: RedisService,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    
    const redisConfig = redisUrl
      ? { url: redisUrl }
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        };

    this.worker = new Worker<NotificationJobData>(
      'notifications-queue',
      async (job: Job<NotificationJobData>) => {
        return this.processNotification(job);
      },
      {
        connection: redisConfig as any,
        concurrency: 10, // Process up to 10 jobs concurrently
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed`, LOG_CONTEXTS.QUEUE, { jobId: job.id });
      this.metrics.queueJobsTotal.inc({ status: 'completed' });
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed`, LOG_CONTEXTS.QUEUE, { jobId: job?.id, error: err.message });
      this.metrics.queueJobsTotal.inc({ status: 'failed' });
    });

    this.logger.info('BullMQ notification worker started', LOG_CONTEXTS.QUEUE);
  }

  async onModuleDestroy() {
    await this.worker.close();
  }

  /**
   * Process a notification job
   * Check if recipient is online - if so, skip notification
   * If offline, send notification (mock implementation)
   */
  private async processNotification(job: Job<NotificationJobData>): Promise<void> {
    const startTime = Date.now();
    const { messageId, conversationId, senderId, recipientId } = job.data;

    this.logger.debug('Processing notification job', LOG_CONTEXTS.QUEUE, {
      jobId: job.id,
      messageId,
      conversationId,
      senderId,
      recipientId,
    });

    // Check if recipient is currently online
    const isOnline = await this.redisService.isUserOnline(recipientId);

    if (isOnline) {
      this.logger.debug('User is online — skipping notification', LOG_CONTEXTS.QUEUE, { recipientId });
      return; // User is online, no notification needed
    }

    // User is offline - send notification
    this.logger.info('Sending notification to offline user', LOG_CONTEXTS.QUEUE, {
      recipientId,
      messageId,
      conversationId,
    });
    
    // Mock notification implementation
    // In production, this would integrate with:
    // - Firebase Cloud Messaging (FCM) for push notifications
    // - Email service (SendGrid, AWS SES, etc.)
    // - SMS service (Twilio, etc.)

    // Track processing duration
    const duration = (Date.now() - startTime) / 1000;
    this.metrics.queueProcessingDuration.observe(duration);
  }
}
