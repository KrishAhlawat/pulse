// ============================================
// Logger Context Constants
// Phase 9: Observability & Monitoring
// ============================================

/**
 * Named contexts for structured log entries.
 * Every log line includes a context so operators can filter by subsystem.
 */
export const LOG_CONTEXTS = {
  HTTP: 'HTTP',
  WEBSOCKET: 'WebSocket',
  REDIS: 'Redis',
  PRISMA: 'Prisma',
  QUEUE: 'Queue',
  AUTH: 'Auth',
  MESSAGES: 'Messages',
  MEDIA: 'Media',
  RATE_LIMIT: 'RateLimit',
  HEALTH: 'Health',
  METRICS: 'Metrics',
  CONVERSATIONS: 'Conversations',
  APP: 'App',
} as const;

/** Fields that must never appear in logs */
export const REDACTED_FIELDS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
] as const;
