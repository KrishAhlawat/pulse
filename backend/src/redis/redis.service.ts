import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { RedisMessagePayload } from '../websocket/events';
import { LoggerService } from '../logger/logger.service';
import { LOG_CONTEXTS } from '../logger/logger.constants';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private messageHandlers: Map<string, (payload: RedisMessagePayload) => void> = new Map();

  constructor(private readonly logger: LoggerService) {}

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
    this.client.on('error', (err) => this.logger.error('Redis Client Error', LOG_CONTEXTS.REDIS, { error: err.message }));
    await this.client.connect();

    // Publisher client for Pub/Sub
    this.publisher = createRedisClient() as any;
    this.publisher.on('error', (err) => this.logger.error('Redis Publisher Error', LOG_CONTEXTS.REDIS, { error: err.message }));
    await this.publisher.connect();

    // Subscriber client for Pub/Sub
    this.subscriber = createRedisClient() as any;
    this.subscriber.on('error', (err) => this.logger.error('Redis Subscriber Error', LOG_CONTEXTS.REDIS, { error: err.message }));
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
        this.logger.error('Error processing Redis message', LOG_CONTEXTS.REDIS, { error: error.message });
      }
    });

    this.logger.info('Redis connected (with Pub/Sub)', LOG_CONTEXTS.REDIS);
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

  // ============================================
  // Generic Redis Utility Methods
  // Phase 7: Used by RateLimitService
  // ============================================

  /**
   * Atomically increment a key's value by 1.
   * If the key does not exist, it is created with value 1.
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Set a TTL (time-to-live) on an existing key.
   */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  /**
   * Get the string value of a key. Returns null if the key does not exist.
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Set a key to a string value with a TTL in seconds.
   */
  async setWithTTL(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  /**
   * Check whether a key exists in Redis.
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Delete a key from Redis.
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Ping Redis to check connectivity. Used by health checks.
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
