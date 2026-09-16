import { Hono } from 'hono';
import { StorageAdapter, CacheAdapter, IncidentItem } from '../core/types';
import { requireAdmin } from '../middleware/auth';
import { sendTelegramNotification, resolveTelegramBotToken } from '../adapters/notifications/TelegramNotifier';
import { CreateIncidentSchema, AddIncidentUpdateSchema, ResolveIncidentSchema } from '../core/schemas';

export function createIncidentsRoutes(storage: StorageAdapter, _cache: CacheAdapter) {
  const router = new Hono();

  router.get('/api/incidents', async (c) => {
    try {
      const incidents = await storage.getIncidents();
      return c.json(incidents);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.post('/api/incidents', requireAdmin, async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = CreateIncidentSchema.safeParse(rawBody);

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
      const newInc: IncidentItem = {
        id: `inc-${Date.now()}`,
        title: body.title,
        severity: body.severity || 'minor',
        status: 'investigating',
        affectedServices: body.affectedServices || [],
        startedAt: new Date().toISOString(),
        updates: [
          {
            id: `up-${Date.now()}`,
            timestamp: new Date().toISOString(),
            status: 'investigating',
            message: body.description || 'Incident reported.',
          },
        ],
      };
      await storage.saveIncident(newInc);

      // Broadcast Telegram alert if enabled
      const tgConfig = await storage.getTelegramConfig();
      const botToken = resolveTelegramBotToken(c);
      if (tgConfig && tgConfig.enabled && botToken && tgConfig.chatId && tgConfig.alertOnIncident) {
        sendTelegramNotification(
          botToken,
          tgConfig.chatId,
          `🚨 <b>[Incident Reported]</b>\n<b>${newInc.title}</b>\nSeverity: ${newInc.severity.toUpperCase()}\nStatus: INVESTIGATING`
        ).catch(() => {});
      }

      return c.json({ success: true, incident: newInc });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.post('/api/incidents/:id/updates', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = AddIncidentUpdateSchema.safeParse(rawBody);

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
      const incidents = await storage.getIncidents();
      const inc = incidents.find((i: IncidentItem) => i.id === id);
      if (!inc) return c.json({ error: 'Incident not found' }, 404);

      if (body.status) {
        inc.status = body.status;
      }
      inc.updates.unshift({
        id: `up-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: inc.status,
        message: body.message,
      });

      await storage.saveIncident(inc);
      return c.json({ success: true, incident: inc });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.post('/api/incidents/:id/resolve', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = ResolveIncidentSchema.safeParse(rawBody);

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
      const incidents = await storage.getIncidents();
      const inc = incidents.find((i: IncidentItem) => i.id === id);
      if (!inc) return c.json({ error: 'Incident not found' }, 404);

      inc.status = 'resolved';
      inc.resolvedAt = new Date().toISOString();
      inc.updates.unshift({
        id: `up-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: 'resolved',
        message: body.message || 'Incident resolved.',
      });

      await storage.saveIncident(inc);
      return c.json({ success: true, incident: inc });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.delete('/api/incidents/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      if (storage.deleteIncident) {
        await storage.deleteIncident(id);
      }
      return c.json({ success: true, id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  return router;
}
