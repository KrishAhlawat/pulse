import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

/**
 * NestJS Guard for rate limiting REST endpoints.
 *
 * MUST be applied AFTER AuthGuard so that `request.user` is populated.
 * Usage: @UseGuards(AuthGuard, RateLimitGuard)
 *
 * On violation, the RateLimitService throws HttpException(429)
 * which NestJS automatically serializes as the HTTP response.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // userId comes from AuthGuard (request.user is set by auth validation)
    const userId = request.user?.sub || request.user?.id;

    if (!userId) {
      // If no userId, let the request through — AuthGuard will catch it
      return true;
    }

    // This throws HttpException(429) if rate limit is exceeded
    await this.rateLimitService.checkMessageRateLimit(userId);

    return true;
  }
}
