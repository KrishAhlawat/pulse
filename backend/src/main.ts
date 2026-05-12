import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggerService } from './logger/logger.service';
import { MetricsService } from './metrics/metrics.service';
import { LoggingInterceptor } from './logger/logger.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LOG_CONTEXTS } from './logger/logger.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Resolve global services
  const logger = app.get(LoggerService);
  const metrics = app.get(MetricsService);

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global observability: logging interceptor + exception filter
  app.useGlobalInterceptors(new LoggingInterceptor(logger, metrics));
  app.useGlobalFilters(new GlobalExceptionFilter(logger, metrics));

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.info(`Backend server running on http://localhost:${port}`, LOG_CONTEXTS.APP);
  logger.info('WebSocket server ready', LOG_CONTEXTS.APP);
  logger.info('GET /health — system health', LOG_CONTEXTS.APP);
  logger.info('GET /metrics — Prometheus metrics', LOG_CONTEXTS.APP);
}

bootstrap();
