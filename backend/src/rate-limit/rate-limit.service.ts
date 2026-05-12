import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import { MetricsService } from '../metrics/metrics.service';
import { LOG_CONTEXTS } from '../logger/logger.constants';
import {
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW,
  TYPING_RATE_LIMIT,
  TYPING_RATE_WINDOW,
  MUTE_DURATION,
  VIOLATION_THRESHOLD,
  VIOLATION_WINDOW,
  REDIS_KEYS,
} from './constants';

// ============================================
// Rate Limit Result Type
// ============================================

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current count in this window */
  current: number;
  /** Maximum allowed in this window */
  limit: number;
  /** Remaining requests in this window */
  remaining: number;
}

// ============================================
// Rate Limit Service
// ============================================

@Injectable()
export class RateLimitService {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  // ============================================
  // Core Rate Limiting (Generic)
  // ============================================

  /**
   * Generic rate limit check using Redis INCR + EXPIRE.
   *
   * Algorithm:
   * 1. INCR the key (atomically creates with value 1 if new)
   * 2. If result is 1 (first request in window), set EXPIRE
   * 3. Compare count against limit
   *
   * This is the standard fixed-window rate limiting pattern.
   * No Lua scripts needed — INCR is already atomic.
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const current = await this.redisService.incr(key);

    // First request in this window — set the TTL
    if (current === 1) {
      await this.redisService.expire(key, windowSeconds);
    }

    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);

    return { allowed, current, limit, remaining };
  }

  // ============================================
  // Mute System
  // ============================================

  /**
   * Check if a user is currently muted.
   * A muted user has a Redis key `mute:user:{userId}` with a TTL.
   */
  async isUserMuted(userId: string): Promise<boolean> {
    const key = `${REDIS_KEYS.USER_MUTE}:${userId}`;
    return this.redisService.exists(key);
  }

  /**
   * Temporarily mute a user for MUTE_DURATION seconds.
   * The mute auto-expires — no cleanup needed.
   */
  async muteUser(userId: string): Promise<void> {
    const key = `${REDIS_KEYS.USER_MUTE}:${userId}`;
    await this.redisService.setWithTTL(key, '1', MUTE_DURATION);
    this.logger.warn(`User muted for ${MUTE_DURATION}s`, LOG_CONTEXTS.RATE_LIMIT, { userId, duration: MUTE_DURATION });
  }

  /**
   * Track rate limit violations and auto-mute if threshold exceeded.
   *
   * Uses a rolling counter with VIOLATION_WINDOW TTL.
   * After VIOLATION_THRESHOLD violations within the window, the user is muted.
   */
  private async trackViolation(userId: string): Promise<void> {
    const key = `${REDIS_KEYS.VIOLATIONS}:${userId}`;
    const violations = await this.redisService.incr(key);

    // Set TTL on first violation in window
    if (violations === 1) {
      await this.redisService.expire(key, VIOLATION_WINDOW);
    }

    // Track metric
    this.metrics.rateLimitViolationsTotal.inc();

    if (violations >= VIOLATION_THRESHOLD) {
      await this.muteUser(userId);
      // Reset violation counter after muting
      await this.redisService.del(key);
    }
  }

  // ============================================
  // High-Level: Message Rate Limiting
  // ============================================

  /**
   * Check whether a user can send a message.
   *
   * Order of checks:
   * 1. Is user muted? → reject immediately
   * 2. Is user over the message rate limit? → reject + track violation
   *
   * Throws HttpException(429) on violation so it works seamlessly
   * with both REST controllers and service-layer callers.
   */
  async checkMessageRateLimit(userId: string): Promise<void> {
    // Check mute first (cheapest check)
    const isMuted = await this.isUserMuted(userId);
    if (isMuted) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'You are temporarily muted for excessive messaging',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check message rate limit
    const key = `${REDIS_KEYS.MESSAGE_RATE}:${userId}`;
    const result = await this.checkRateLimit(key, MESSAGE_RATE_LIMIT, MESSAGE_RATE_WINDOW);

    if (!result.allowed) {
      // Track violation for mute escalation
      await this.trackViolation(userId);

      this.logger.warn('Rate limit exceeded', LOG_CONTEXTS.RATE_LIMIT, {
        userId,
        current: result.current,
        limit: result.limit,
      });

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. Maximum ${MESSAGE_RATE_LIMIT} messages per ${MESSAGE_RATE_WINDOW} seconds`,
          error: 'Too Many Requests',
          retryAfter: MESSAGE_RATE_WINDOW,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // ============================================
  // High-Level: Typing Event Throttling
  // ============================================

  /**
   * Check whether a typing event should be processed.
   *
   * Unlike message rate limiting, typing throttle:
   * - Does NOT mute the user
   * - Does NOT throw exceptions
   * - Silently rejects excess events (returns false)
   *
   * This is appropriate because typing events are ephemeral
   * and the client shouldn't receive error events for them.
   */
  async checkTypingRateLimit(userId: string): Promise<boolean> {
    const key = `${REDIS_KEYS.TYPING_RATE}:${userId}`;
    const result = await this.checkRateLimit(key, TYPING_RATE_LIMIT, TYPING_RATE_WINDOW);
    return result.allowed;
  }
}
