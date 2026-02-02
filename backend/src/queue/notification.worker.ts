import { Worker, Job } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NotificationJobData } from './notification.queue';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<NotificationJobData>;

  constructor(private redisService: RedisService) {}

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
      console.log(`✅ Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    console.log('✅ BullMQ notification worker started');
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
    const { messageId, conversationId, senderId, recipientId } = job.data;

    console.log(`📬 Processing notification job: ${job.id}`, {
      messageId,
      conversationId,
      senderId,
      recipientId,
    });

    // Check if recipient is currently online
    const isOnline = await this.redisService.isUserOnline(recipientId);

    if (isOnline) {
      console.log(`⏭️  User ${recipientId} is online - skipping notification`);
      return; // User is online, no notification needed
    }

    // User is offline - send notification
    console.log(`🔔 Notify user ${recipientId} about new message ${messageId} in conversation ${conversationId}`);
    
    // Mock notification implementation
    // In production, this would integrate with:
    // - Firebase Cloud Messaging (FCM) for push notifications
    // - Email service (SendGrid, AWS SES, etc.)
    // - SMS service (Twilio, etc.)
    
    // For now, we just log it
    console.log(`✉️  [MOCK] Notification sent to user ${recipientId}`);
  }
}
