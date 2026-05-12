import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';
import { METRIC_NAMES } from './metrics.constants';

/**
 * Central Prometheus metrics registry.
 *
 * Provides pre-defined counters, gauges, and histograms for all
 * observable subsystems. Collects default Node.js process metrics
 * (CPU, memory, event loop lag) automatically.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private registry: client.Registry;

  // ── HTTP ──────────────────────────────────────
  public httpRequestsTotal: client.Counter;
  public httpRequestDuration: client.Histogram;

  // ── WebSocket ─────────────────────────────────
  public wsConnectionsActive: client.Gauge;
  public wsMessagesTotal: client.Counter;
  public wsErrorsTotal: client.Counter;

  // ── Application ───────────────────────────────
  public messagesSentTotal: client.Counter;

  // ── Queue ─────────────────────────────────────
  public queueJobsTotal: client.Counter;
  public queueProcessingDuration: client.Histogram;

  // ── Redis ─────────────────────────────────────
  public redisOperationsTotal: client.Counter;

  // ── Rate Limiting ─────────────────────────────
  public rateLimitViolationsTotal: client.Counter;

  onModuleInit() {
    this.registry = new client.Registry();

    // Collect default process-level metrics (CPU, memory, event loop)
    client.collectDefaultMetrics({ register: this.registry });

    // ── HTTP ──────────────────────────────────────
    this.httpRequestsTotal = new client.Counter({
      name: METRIC_NAMES.HTTP_REQUESTS_TOTAL,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new client.Histogram({
      name: METRIC_NAMES.HTTP_REQUEST_DURATION,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // ── WebSocket ─────────────────────────────────
    this.wsConnectionsActive = new client.Gauge({
      name: METRIC_NAMES.WS_CONNECTIONS_ACTIVE,
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });

    this.wsMessagesTotal = new client.Counter({
      name: METRIC_NAMES.WS_MESSAGES_TOTAL,
      help: 'Total WebSocket messages processed',
      labelNames: ['event'],
      registers: [this.registry],
    });

    this.wsErrorsTotal = new client.Counter({
      name: METRIC_NAMES.WS_ERRORS_TOTAL,
      help: 'Total WebSocket errors',
      registers: [this.registry],
    });

    // ── Application ───────────────────────────────
    this.messagesSentTotal = new client.Counter({
      name: METRIC_NAMES.MESSAGES_SENT_TOTAL,
      help: 'Total chat messages sent',
      registers: [this.registry],
    });

    // ── Queue ─────────────────────────────────────
    this.queueJobsTotal = new client.Counter({
      name: METRIC_NAMES.QUEUE_JOBS_TOTAL,
      help: 'Total queue jobs processed',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.queueProcessingDuration = new client.Histogram({
      name: METRIC_NAMES.QUEUE_PROCESSING_DURATION,
      help: 'Queue job processing duration in seconds',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      registers: [this.registry],
    });

    // ── Redis ─────────────────────────────────────
    this.redisOperationsTotal = new client.Counter({
      name: METRIC_NAMES.REDIS_OPERATIONS_TOTAL,
      help: 'Total Redis operations',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    // ── Rate Limiting ─────────────────────────────
    this.rateLimitViolationsTotal = new client.Counter({
      name: METRIC_NAMES.RATE_LIMIT_VIOLATIONS_TOTAL,
      help: 'Total rate limit violations',
      registers: [this.registry],
    });
  }

  /**
   * Return all metrics in Prometheus text exposition format.
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Return the content type for Prometheus scraping.
   */
  getContentType(): string {
    return this.registry.contentType;
  }
}
