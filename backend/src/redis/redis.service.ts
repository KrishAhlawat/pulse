import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  async onModuleInit() {
    // Support both URL-based (cloud) and host/port (local) Redis configurations
    const redisUrl = process.env.REDIS_URL;
    
    this.client = redisUrl
      ? createClient({ url: redisUrl })
      : createClient({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
        });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    
    await this.client.connect();
    console.log('✅ Redis connected');
  }

  async onModuleDestroy() {
    await this.client.disconnect();
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
}
