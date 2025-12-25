import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { RedisMessagePayload } from '../websocket/events';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private messageHandlers: Map<string, (payload: RedisMessagePayload) => void> = new Map();

  async onModuleInit() {
    // Support both URL-based (cloud) and host/port (local) Redis configurations
    const redisUrl = process.env.REDIS_URL;
    
    const createRedisClient = () => redisUrl
      ? createClient({ url: redisUrl })
      : createClient({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
        });

    // Main client for presence
    this.client = createRedisClient() as any;
    this.client.on('error', (err) => console.error('Redis Client Error', err));
    await this.client.connect();

    // Publisher client for Pub/Sub
    this.publisher = createRedisClient() as any;
    this.publisher.on('error', (err) => console.error('Redis Publisher Error', err));
    await this.publisher.connect();

    // Subscriber client for Pub/Sub
    this.subscriber = createRedisClient() as any;
    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));
    await this.subscriber.connect();

    // Subscribe to chat messages channel
    await this.subscriber.subscribe('chat:messages', (message) => {
      try {
        const payload: RedisMessagePayload = JSON.parse(message);
        const handler = this.messageHandlers.get('chat:messages');
        if (handler) {
          handler(payload);
        }
      } catch (error) {
        console.error('Error processing Redis message:', error);
      }
    });

    console.log('✅ Redis connected (with Pub/Sub)');
  }

  async onModuleDestroy() {
    await this.client.disconnect();
    await this.publisher.disconnect();
    await this.subscriber.disconnect();
  }

  async setUserOnline(userId: string): Promise<void> {
    await this.client.set(`user:${userId}:online`, 'true', {
      EX: 60, // TTL 60 seconds
    });
  }

  async setUserOffline(userId: string): Promise<void> {
    await this.client.del(`user:${userId}:online`);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const status = await this.client.get(`user:${userId}:online`);
    return status === 'true';
  }

  async extendPresence(userId: string): Promise<void> {
    await this.client.expire(`user:${userId}:online`, 60);
  }

  async getOnlineUsers(): Promise<string[]> {
    const keys = await this.client.keys('user:*:online');
    return keys.map(key => key.split(':')[1]);
  }

  // ============================================
  // Pub/Sub Methods for Real-Time Messaging
  // ============================================

  /**
   * Publish a message event to Redis for horizontal scaling
   * All backend instances subscribed to 'chat:messages' will receive this
   */
  async publishMessage(payload: RedisMessagePayload): Promise<void> {
    await this.publisher.publish('chat:messages', JSON.stringify(payload));
  }

  /**
   * Register a handler for incoming Redis messages
   * This is called by the WebSocket gateway to handle broadcasted messages
   */
  onMessage(channel: string, handler: (payload: RedisMessagePayload) => void): void {
    this.messageHandlers.set(channel, handler);
  }
}
