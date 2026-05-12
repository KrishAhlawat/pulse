import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import { MetricsService } from '../metrics/metrics.service';
import { LOG_CONTEXTS } from './logger.constants';

/**
 * HTTP request/response lifecycle interceptor.
 *
 * For every HTTP request:
 * 1. Logs incoming method + URL
 * 2. Times the handler execution
 * 3. Logs outgoing status code + duration
 * 4. Records Prometheus metrics (request count + latency histogram)
 *
 * Sensitive headers (authorization, cookie) are NOT logged.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only apply to HTTP contexts
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const userId = request.user?.sub || request.user?.id || 'anonymous';
    const start = Date.now();

    this.logger.debug(`→ ${method} ${url}`, LOG_CONTEXTS.HTTP, { userId });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;

          this.logger.info(
            `← ${method} ${url} ${statusCode} ${duration}ms`,
            LOG_CONTEXTS.HTTP,
            { method, url, statusCode, duration, userId },
          );

          // Record metrics
          const route = this.normalizeRoute(url);
          this.metrics.httpRequestsTotal.inc({ method, route, status: String(statusCode) });
          this.metrics.httpRequestDuration.observe({ method, route }, duration / 1000);
        },
        error: (error) => {
          const duration = Date.now() - start;
          const statusCode = error.status || error.statusCode || 500;

          this.logger.error(
            `← ${method} ${url} ${statusCode} ${duration}ms`,
            LOG_CONTEXTS.HTTP,
            { method, url, statusCode, duration, userId, error: error.message },
          );

          const route = this.normalizeRoute(url);
          this.metrics.httpRequestsTotal.inc({ method, route, status: String(statusCode) });
          this.metrics.httpRequestDuration.observe({ method, route }, duration / 1000);
        },
      }),
    );
  }

  /**
   * Normalize URLs to prevent high-cardinality labels.
   * Replaces UUIDs and numeric IDs with `:id` placeholder.
   */
  private normalizeRoute(url: string): string {
    return url
      .split('?')[0] // Strip query string
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
      .replace(/\/\d+/g, '/:id'); // Numeric IDs
  }
}
