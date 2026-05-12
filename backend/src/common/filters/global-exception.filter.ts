import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../../logger/logger.service';
import { MetricsService } from '../../metrics/metrics.service';
import { LOG_CONTEXTS } from '../../logger/logger.constants';

/**
 * Global exception filter that catches all unhandled exceptions.
 *
 * Responsibilities:
 * - Structured error logging with full context
 * - Prometheus error metric tracking
 * - Consistent error response shape
 * - Stack trace suppression in production responses
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // Only handle HTTP context; WebSocket errors are handled in the gateway
    if (host.getType() !== 'http') {
      return;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorName = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;
      errorName = exception.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name || 'Error';
    }

    // Log the error with full context
    this.logger.error(
      `${request.method} ${request.url} → ${status} ${errorName}`,
      LOG_CONTEXTS.HTTP,
      {
        statusCode: status,
        method: request.method,
        url: request.url,
        errorName,
        message,
        stack: exception instanceof Error ? exception.stack : undefined,
        userId: (request as any).user?.sub || (request as any).user?.id,
      },
    );

    // Increment error metric
    this.metrics.httpRequestsTotal.inc({
      method: request.method,
      route: request.url.split('?')[0],
      status: String(status),
    });

    // Send consistent error response (no stack traces in production)
    const isProduction = process.env.NODE_ENV === 'production';
    response.status(status).json({
      statusCode: status,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
      ...(isProduction ? {} : { path: request.url }),
    });
  }
}
