import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';

/**
 * Global logger module.
 * LoggerService is available everywhere without explicit imports.
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
