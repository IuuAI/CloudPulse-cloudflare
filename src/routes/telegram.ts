import { Hono } from 'hono';
import { StorageAdapter, CacheAdapter, TelegramConfig, TelegramLog } from '../core/types';
import { createRequireAdminMiddleware } from '../middleware/auth';
import { sendTelegramNotification, resolveTelegramBotToken } from '../adapters/notifications/TelegramNotifier';
import { TelegramConfigSchema } from '../core/schemas';

export function createTelegramRoutes(storage: StorageAdapter, _cache: CacheAdapter) {
  const router = new Hono();
  const requireAdmin = createRequireAdminMiddleware(storage);

  // Telegram Config (Admin authenticated only, botToken retrieved exclusively from Cloudflare Secrets / Env)
  router.get('/api/telegram/config', requireAdmin, async (c) => {
    try {
      const cfg: TelegramConfig = await storage.getTelegramConfig();
      const secretToken = resolveTelegramBotToken(c);

      return c.json({
        enabled: Boolean(cfg.enabled),
        chatId: cfg.chatId || '',
        alertOnStatusChange: cfg.alertOnStatusChange !== undefined ? Boolean(cfg.alertOnStatusChange) : true,
        alertOnHighLoad: cfg.alertOnHighLoad !== undefined ? Boolean(cfg.alertOnHighLoad) : true,
        alertOnIncident: cfg.alertOnIncident !== undefined ? Boolean(cfg.alertOnIncident) : true,
        dailyDigest: Boolean(cfg.dailyDigest),
        digestTime: cfg.digestTime || '08:00',
        hasBotToken: Boolean(secretToken),
        botTokenPreview: secretToken ? `${secretToken.slice(0, 6)}...${secretToken.slice(-4)}` : '',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.post('/api/telegram/config', requireAdmin, async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = TelegramConfigSchema.safeParse(rawBody);

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
      const current = await storage.getTelegramConfig();
      const secretToken = resolveTelegramBotToken(c);

      const updated: TelegramConfig = {
        ...current,
        chatId: body.chatId !== undefined ? body.chatId : current.chatId,
        enabled: body.enabled !== undefined ? body.enabled : current.enabled,
        alertOnStatusChange: body.alertOnStatusChange !== undefined ? body.alertOnStatusChange : current.alertOnStatusChange,
        alertOnHighLoad: body.alertOnHighLoad !== undefined ? body.alertOnHighLoad : current.alertOnHighLoad,
        alertOnIncident: body.alertOnIncident !== undefined ? body.alertOnIncident : current.alertOnIncident,
        dailyDigest: body.dailyDigest !== undefined ? body.dailyDigest : current.dailyDigest,
        digestTime: body.digestTime !== undefined ? body.digestTime : current.digestTime,
      };
      await storage.saveTelegramConfig(updated);

      return c.json({
        success: true,
        config: {
          enabled: Boolean(updated.enabled),
          chatId: updated.chatId || '',
          alertOnStatusChange: updated.alertOnStatusChange !== undefined ? Boolean(updated.alertOnStatusChange) : true,
          alertOnHighLoad: updated.alertOnHighLoad !== undefined ? Boolean(updated.alertOnHighLoad) : true,
          alertOnIncident: updated.alertOnIncident !== undefined ? Boolean(updated.alertOnIncident) : true,
          dailyDigest: Boolean(updated.dailyDigest),
          digestTime: updated.digestTime || '08:00',
          hasBotToken: Boolean(secretToken),
          botTokenPreview: secretToken ? `${secretToken.slice(0, 6)}...${secretToken.slice(-4)}` : '',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.get('/api/telegram/logs', requireAdmin, async (c) => {
    try {
      const logs: TelegramLog[] = await storage.getTelegramLogs();
      return c.json(logs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.post('/api/telegram/push', requireAdmin, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const cfg = await storage.getTelegramConfig();
      const secretToken = resolveTelegramBotToken(c);
      const token = body.botToken || secretToken;
      const chatId = body.chatId || cfg.chatId;

      const res = await sendTelegramNotification(token, chatId, body.text, body.parseMode || 'HTML');

      const logItem: TelegramLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'manual_broadcast',
        status: res.status,
        message: body.text ? String(body.text).slice(0, 100) : '',
        details: res.error,
      };
      await storage.saveTelegramLog(logItem);

      return c.json(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ status: 'error', error: message }, 500);
    }
  });

  return router;
}
