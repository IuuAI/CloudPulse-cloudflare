import { Hono } from 'hono';
import { StorageAdapter, CacheAdapter, OverviewStats } from '../core/types';

export function createOverviewRoutes(storage: StorageAdapter, cache: CacheAdapter) {
  const router = new Hono();

  router.get('/api/overview', async (c) => {
    try {
      const cached = await cache.get<OverviewStats>('latest_overview').catch(() => null);
      if (cached) return c.json(cached);
      const ov = await storage.getOverview().catch(() => null);
      if (ov) return c.json(ov);
      return c.json({
        uptime: 100.0,
        totalNodes: 0,
        healthyNodes: 0,
        activeIncidents: 0,
        avgLatency: 0,
        lastChecked: new Date().toISOString(),
      });
    } catch {
      return c.json({
        uptime: 100.0,
        totalNodes: 0,
        healthyNodes: 0,
        activeIncidents: 0,
        avgLatency: 0,
        lastChecked: new Date().toISOString(),
      });
    }
  });

  return router;
}
