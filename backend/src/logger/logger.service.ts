import { Injectable } from '@nestjs/common';
import pino from 'pino';

/**
 * Centralized structured logger built on Pino.
 *
 * - JSON output in production (machine-readable)
 * - Pretty-printed output in development (human-readable)
 * - Auto-timestamps on every line
 * - Supports contextual child loggers via the `context` parameter
 */
@Injectable()
export class LoggerService {
  private logger: pino.Logger;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    this.logger = pino({
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:HH:MM:ss.l',
                ignore: 'pid,hostname',
              },
            },
          }),
    });
  }

  info(message: string, context?: string, data?: Record<string, any>): void {
    this.logger.info({ context, ...data }, message);
  }

  warn(message: string, context?: string, data?: Record<string, any>): void {
    this.logger.warn({ context, ...data }, message);
  }

  error(message: string, context?: string, data?: Record<string, any>): void {
    this.logger.error({ context, ...data }, message);
  }

  debug(message: string, context?: string, data?: Record<string, any>): void {
    this.logger.debug({ context, ...data }, message);
  }
}
