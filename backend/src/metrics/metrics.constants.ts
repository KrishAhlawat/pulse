// ============================================
// Prometheus Metric Name Constants
// Phase 9: Observability & Monitoring
// ============================================

export const METRIC_NAMES = {
  // HTTP
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION: 'http_request_duration_seconds',

  // WebSocket
  WS_CONNECTIONS_ACTIVE: 'ws_connections_active',
  WS_MESSAGES_TOTAL: 'ws_messages_total',
  WS_ERRORS_TOTAL: 'ws_errors_total',

  // Application
  MESSAGES_SENT_TOTAL: 'messages_sent_total',

  // Queue
  QUEUE_JOBS_TOTAL: 'queue_jobs_total',
  QUEUE_PROCESSING_DURATION: 'queue_processing_duration_seconds',

  // Redis
  REDIS_OPERATIONS_TOTAL: 'redis_operations_total',

  // Rate Limiting
  RATE_LIMIT_VIOLATIONS_TOTAL: 'rate_limit_violations_total',
} as const;
