import { Hono } from 'hono';
import { StorageAdapter, CacheAdapter, MetricHistoryPoint } from '../core/types';
import { requireAdmin } from '../middleware/auth';

export function createMetricsRoutes(storage: StorageAdapter, _cache: CacheAdapter) {
  const router = new Hono();

  // Metrics History
  router.get('/api/metrics/history', async (c) => {
    try {
      const history: MetricHistoryPoint[] = await storage.getMetricsHistory();
      return c.json(history);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  // Metrics Export (JSON)
  router.get('/api/metrics/export', async (c) => {
    try {
      const history = await storage.getMetricsHistory();
      const nodes = await storage.getNodes();
      const services = await storage.getServices();
      const overview = await storage.getOverview();

      return c.json({
        exportedAt: new Date().toISOString(),
        overview,
        metricsHistory: history,
        nodesCount: nodes.length,
        servicesCount: services.length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  // Prune Metrics History
  router.post('/api/metrics/prune', requireAdmin, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const retentionDays = typeof body.retentionDays === 'number' ? body.retentionDays : 30;
      const pruned = await storage.pruneHistory(retentionDays);
      return c.json({ success: true, prunedCount: pruned, retentionDays });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  return router;
}
