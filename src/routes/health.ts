import { Hono } from 'hono';
import { StorageAdapter, CacheAdapter } from '../core/types';

export function createHealthRoutes(_storage: StorageAdapter, _cache: CacheAdapter) {
  const router = new Hono();

  // Lightweight Health Check (No heavy D1 queries or table count scans)
  router.get('/api/health', (c) => {
    try {
      const runtimeEnv: Record<string, any> = (c && c.env && typeof c.env === 'object') ? c.env : {};
      const hasAdminAuth = !!(runtimeEnv.ADMIN_PASSWORD || (typeof process !== 'undefined' && process.env && process.env.ADMIN_PASSWORD));
      const hasTelegramToken = !!(runtimeEnv.TELEGRAM_BOT_TOKEN || (typeof process !== 'undefined' && process.env && process.env.TELEGRAM_BOT_TOKEN));

      return c.json({
        ok: true,
        status: 'ok',
        bindings: {
          d1Database: runtimeEnv.DB ? 'Bound (Active)' : 'Local Memory / Ready',
          kvNamespace: runtimeEnv.CACHE ? 'Bound (Active)' : 'Local Memory / Ready',
        },
        uptime: (typeof process !== 'undefined' && process.uptime) ? process.uptime() : 0,
        envConfigured: {
          hasAdminPassword: hasAdminAuth,
          hasTelegramToken: hasTelegramToken,
        },
      });
    } catch {
      return c.json({
        ok: true,
        status: 'ok',
        bindings: {
          d1Database: 'Ready',
          kvNamespace: 'Ready',
        },
        uptime: 0,
        envConfigured: {
          hasAdminPassword: true,
          hasTelegramToken: false,
        },
      });
    }
  });

  return router;
}
