import { Module, Global } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';

/**
 * Global rate limiting module.
 *
 * Marked @Global() so RateLimitService is available everywhere
 * without explicit imports in each consuming module.
 */
@Global()
@Module({
  providers: [RateLimitService, RateLimitGuard],
  exports: [RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}
