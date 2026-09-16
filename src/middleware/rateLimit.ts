import { Context, Next } from 'hono';
import { CacheAdapter } from '../core/types';

interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
  keyExtractor?: (c: Context) => Promise<string | null> | string | null;
  errorMessage?: string;
}

/**
 * Extract client IP address safely from Cloudflare / proxy headers
 */
export function getClientIp(c: Context): string {
  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xRealIp = c.req.header('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = c.req.header('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0];
    if (firstIp) return firstIp.trim();
  }

  return '127.0.0.1';
}

/**
 * Factory for cache-backed sliding window rate limiters
 */
export function createRateLimiter(cache: CacheAdapter, config: RateLimitConfig) {
  const {
    windowSeconds,
    maxRequests,
    keyPrefix,
    keyExtractor = (c) => getClientIp(c),
    errorMessage = 'Too many requests, please slow down and try again later.',
  } = config;

  return async (c: Context, next: Next) => {
    try {
      const keyId = await keyExtractor(c);
      if (!keyId) {
        return await next();
      }

      const now = Math.floor(Date.now() / 1000);
      const windowBucket = Math.floor(now / windowSeconds);
      const cacheKey = `ratelimit:${keyPrefix}:${keyId}:${windowBucket}`;

      const currentCount = (await cache.get<number>(cacheKey)) || 0;

      if (currentCount >= maxRequests) {
        c.header('Retry-After', String(windowSeconds));
        c.header('X-RateLimit-Limit', String(maxRequests));
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', String((windowBucket + 1) * windowSeconds));

        return c.json(
          {
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: errorMessage,
            retryAfterSeconds: windowSeconds,
          },
          429
        );
      }

      const nextCount = currentCount + 1;
      await cache.set(cacheKey, nextCount, windowSeconds * 2);

      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - nextCount)));
      c.header('X-RateLimit-Reset', String((windowBucket + 1) * windowSeconds));

      return await next();
    } catch {
      // In case of cache errors, gracefully proceed to avoid dropping legitimate traffic
      return await next();
    }
  };
}
