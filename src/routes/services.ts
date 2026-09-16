import { Hono } from 'hono';
import { StorageAdapter, CacheAdapter, ServiceItem } from '../core/types';
import { requireAdmin } from '../middleware/auth';
import { CreateServiceSchema, UpdateServiceSchema } from '../core/schemas';

export function createServicesRoutes(storage: StorageAdapter, _cache: CacheAdapter) {
  const router = new Hono();

  router.get('/api/services', async (c) => {
    try {
      const services = await storage.getServices();
      return c.json(services);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.post('/api/services', requireAdmin, async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = CreateServiceSchema.safeParse(rawBody);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: '输入验证失败',
            issues: parsed.error.issues,
          },
          400
        );
      }

      const body = parsed.data;
      const newService: ServiceItem = {
        id: body.id || `srv-${Date.now()}`,
        name: body.name,
        category: body.category || 'API',
        status: body.status || 'operational',
        latency: body.latency ?? 25,
        uptime: body.uptime ?? 99.9,
        uptime30d: body.uptime30d ?? 99.9,
        lastCheck: new Date().toISOString(),
        url: body.url || '',
        description: body.description || '',
      };

      await storage.saveService(newService);
      return c.json(newService);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.put('/api/services/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = UpdateServiceSchema.safeParse(rawBody);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: '输入验证失败',
            issues: parsed.error.issues,
          },
          400
        );
      }

      const services = await storage.getServices();
      const existing = services.find((s: ServiceItem) => s.id === id);
      if (!existing) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const updated: ServiceItem = {
        ...existing,
        ...parsed.data,
        id,
        lastCheck: new Date().toISOString(),
      };

      await storage.saveService(updated);
      return c.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.delete('/api/services/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      if (storage.deleteService) {
        await storage.deleteService(id);
      }
      return c.json({ success: true, id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  // Services Live Check
  router.post('/api/services/:id/check', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const services = await storage.getServices();
      const service = services.find((s: ServiceItem) => s.id === id);
      if (!service) return c.json({ error: 'Service not found' }, 404);

      let measuredLatency = 20;
      let checkStatus: ServiceItem['status'] = 'operational';

      if (service.url && (service.url.startsWith('http://') || service.url.startsWith('https://'))) {
        try {
          const t0 = Date.now();
          const probeRes = await fetch(service.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          measuredLatency = Date.now() - t0;
          if (!probeRes.ok && probeRes.status >= 500) {
            checkStatus = 'degraded';
          }
        } catch {
          measuredLatency = 999;
          checkStatus = 'degraded';
        }
      }

      service.latency = measuredLatency;
      service.status = checkStatus;
      service.lastCheck = new Date().toISOString();
      await storage.saveService(service);

      return c.json({
        id: service.id,
        status: service.status,
        latency: service.latency,
        lastCheck: service.lastCheck,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  return router;
}
