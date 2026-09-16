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

// In-memory sliding window store to save KV daily write quota
const memoryRateLimitStore = new Map<string, { count: number; expiresAt: number }>();

function cleanupMemoryRateLimitStore() {
  const now = Math.floor(Date.now() / 1000);
  for (const [k, v] of memoryRateLimitStore.entries()) {
    if (v.expiresAt <= now) {
      memoryRateLimitStore.delete(k);
    }
  }
}

/**
 * Factory for memory + cache sliding window rate limiters
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

      // 1. Check in-memory store first (Zero KV reads/writes)
      cleanupMemoryRateLimitStore();
      const memRecord = memoryRateLimitStore.get(cacheKey);
      let currentCount = memRecord ? memRecord.count : 0;

      // 2. Fallback to cache layer if not in memory
      if (!memRecord) {
        const cachedCount = await cache.get<number>(cacheKey).catch(() => null);
        if (typeof cachedCount === 'number') {
          currentCount = cachedCount;
        }
      }

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
      const expiresAt = (windowBucket + 2) * windowSeconds;
      memoryRateLimitStore.set(cacheKey, { count: nextCount, expiresAt });

      // Synchronize with KV/Cache asynchronously without blocking or failing if KV 429 occurs
      cache.set(cacheKey, nextCount, windowSeconds * 2).catch(() => {});

      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - nextCount)));
      c.header('X-RateLimit-Reset', String((windowBucket + 1) * windowSeconds));

      return await next();
    } catch {
      return await next();
    }
  };
}
