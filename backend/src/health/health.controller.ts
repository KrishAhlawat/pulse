import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import { LOG_CONTEXTS } from '../logger/logger.constants';

/**
 * Health check endpoint for load balancers, Kubernetes probes, and ops monitoring.
 *
 * GET /health — returns system status with individual component checks.
 * No authentication required (standard for health probes).
 */
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    // Database check
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'up', latency: Date.now() - dbStart };
    } catch (error) {
      checks.database = { status: 'down', error: error.message };
      this.logger.error('Health check: Database is down', LOG_CONTEXTS.HEALTH, { error: error.message });
    }

    // Redis check
    try {
      const redisStart = Date.now();
      const pong = await this.redis.ping();
      checks.redis = { status: pong ? 'up' : 'down', latency: Date.now() - redisStart };
    } catch (error) {
      checks.redis = { status: 'down', error: error.message };
      this.logger.error('Health check: Redis is down', LOG_CONTEXTS.HEALTH, { error: error.message });
    }

    // Determine overall status
    const allUp = Object.values(checks).every((c) => c.status === 'up');
    const allDown = Object.values(checks).every((c) => c.status === 'down');
    const status = allUp ? 'healthy' : allDown ? 'unhealthy' : 'degraded';

    return {
      status,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
