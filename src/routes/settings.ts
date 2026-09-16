import { Hono } from 'hono';
import { StorageAdapter, CacheAdapter, QuotaSettings } from '../core/types';
import { requireAdmin } from '../middleware/auth';
import { runMonitorCycle } from '../core/monitor';
import { QuotaSettingsSchema } from '../core/schemas';

export function createSettingsRoutes(storage: StorageAdapter, cache: CacheAdapter) {
  const router = new Hono();

  // Quota Settings & Usage
  router.get('/api/settings/quota', async (c) => {
    try {
      const settings = await storage.getQuotaSettings();
      const cachedD1 = await cache.get('cached_d1_usage');
      const cachedKV = await cache.get('cached_kv_usage');
      const d1Usage = cachedD1 || (storage.getD1UsageStats ? await storage.getD1UsageStats() : undefined);
      const kvUsage = cachedKV || (cache.getKVUsageStats ? await cache.getKVUsageStats() : undefined);
      if (!cachedD1 && d1Usage) await cache.set('cached_d1_usage', d1Usage, 15);
      if (!cachedKV && kvUsage) await cache.set('cached_kv_usage', kvUsage, 15);
      return c.json({
        ...settings,
        d1Usage,
        kvUsage,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  // Admin Usage with 15-60 second KV/Cache buffering (Avoids heavy D1 queries on health checks)
  router.get('/api/admin/usage', requireAdmin, async (c) => {
    try {
      const cachedD1 = await cache.get('cached_d1_usage');
      const cachedKV = await cache.get('cached_kv_usage');
      const d1Usage = cachedD1 || (storage.getD1UsageStats ? await storage.getD1UsageStats() : undefined);
      const kvUsage = cachedKV || (cache.getKVUsageStats ? await cache.getKVUsageStats() : undefined);
      if (!cachedD1 && d1Usage) await cache.set('cached_d1_usage', d1Usage, 30);
      if (!cachedKV && kvUsage) await cache.set('cached_kv_usage', kvUsage, 30);
      c.header('Cache-Control', 'private, max-age=30, s-maxage=30');
      return c.json({
        success: true,
        timestamp: new Date().toISOString(),
        d1Usage,
        kvUsage,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  // Usage with 15-second cache
  router.get('/api/settings/quota/usage', async (c) => {
    try {
      const cachedD1 = await cache.get('cached_d1_usage');
      const cachedKV = await cache.get('cached_kv_usage');
      const d1Usage = cachedD1 || (storage.getD1UsageStats ? await storage.getD1UsageStats() : undefined);
      const kvUsage = cachedKV || (cache.getKVUsageStats ? await cache.getKVUsageStats() : undefined);
      if (!cachedD1 && d1Usage) await cache.set('cached_d1_usage', d1Usage, 15);
      if (!cachedKV && kvUsage) await cache.set('cached_kv_usage', kvUsage, 15);
      c.header('Cache-Control', 'public, max-age=15, s-maxage=15');
      return c.json({
        success: true,
        d1Usage,
        kvUsage,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  // Cloudflare D1 & KV Daily Usage
  router.get('/api/cloudflare/daily-usage', async (c) => {
    try {
      const cachedD1 = await cache.get('cached_d1_usage');
      const cachedKV = await cache.get('cached_kv_usage');
      const d1Usage = cachedD1 || (storage.getD1UsageStats ? await storage.getD1UsageStats() : undefined);
      const kvUsage = cachedKV || (cache.getKVUsageStats ? await cache.getKVUsageStats() : undefined);
      if (!cachedD1 && d1Usage) await cache.set('cached_d1_usage', d1Usage, 15);
      if (!cachedKV && kvUsage) await cache.set('cached_kv_usage', kvUsage, 15);
      c.header('Cache-Control', 'public, max-age=15, s-maxage=15');
      return c.json({
        success: true,
        timestamp: new Date().toISOString(),
        d1Usage,
        kvUsage,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.get('/api/cloudflare/quota', (c) => c.redirect('/api/cloudflare/daily-usage'));

  router.put('/api/settings/quota', requireAdmin, async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = QuotaSettingsSchema.safeParse(rawBody);

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

      const current = await storage.getQuotaSettings();
      const updated: QuotaSettings = { ...current, ...parsed.data };
      await storage.saveQuotaSettings(updated);
      return c.json({ success: true, settings: updated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.post('/api/settings/quota/prune', requireAdmin, async (c) => {
    try {
      const settings = await storage.getQuotaSettings();
      const prunedCount = await storage.pruneHistory(settings.historyRetentionDays || 30);
      return c.json({ success: true, prunedMetricsCount: prunedCount });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  // API Keys & Credentials Management
  router.get('/api/settings/api-keys', async (c) => {
    try {
      const cached = ((await cache.get('system_api_keys')) as Record<string, string>) || {};
      const runtimeEnv = (c.env || {}) as Record<string, unknown>;
      const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};
      const envKeys = {
        geminiApiKey: (runtimeEnv.GEMINI_API_KEY as string) || procEnv.GEMINI_API_KEY || '',
        telegramBotToken: (runtimeEnv.TELEGRAM_BOT_TOKEN as string) || procEnv.TELEGRAM_BOT_TOKEN || '',
        telegramChatId: (runtimeEnv.TELEGRAM_CHAT_ID as string) || procEnv.TELEGRAM_CHAT_ID || '',
      };

      const gemini = cached.geminiApiKey || envKeys.geminiApiKey;
      const tgToken = cached.telegramBotToken || envKeys.telegramBotToken;
      const tgChat = cached.telegramChatId || envKeys.telegramChatId;

      return c.json({
        geminiApiKey: gemini ? `${gemini.slice(0, 6)}...${gemini.slice(-4)}` : '',
        telegramBotToken: tgToken ? `${tgToken.slice(0, 6)}...${tgToken.slice(-4)}` : '',
        telegramChatId: tgChat || '',
        isGeminiConfigured: Boolean(gemini),
        isTelegramConfigured: Boolean(tgToken && tgChat),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.post('/api/settings/api-keys', requireAdmin, async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const current = ((await cache.get('system_api_keys')) as Record<string, string>) || {};
      const updated = { ...current };

      if (body.geminiApiKey && typeof body.geminiApiKey === 'string' && !body.geminiApiKey.includes('...')) {
        updated.geminiApiKey = body.geminiApiKey.trim();
        if (typeof process !== 'undefined' && process.env) process.env.GEMINI_API_KEY = updated.geminiApiKey;
      }
      if (body.telegramBotToken && typeof body.telegramBotToken === 'string' && !body.telegramBotToken.includes('...')) {
        updated.telegramBotToken = body.telegramBotToken.trim();
        if (typeof process !== 'undefined' && process.env) process.env.TELEGRAM_BOT_TOKEN = updated.telegramBotToken;
      }
      if (body.telegramChatId && typeof body.telegramChatId === 'string') {
        updated.telegramChatId = body.telegramChatId.trim();
        if (typeof process !== 'undefined' && process.env) process.env.TELEGRAM_CHAT_ID = updated.telegramChatId;
      }

      await cache.set('system_api_keys', updated);

      if (updated.telegramBotToken || updated.telegramChatId) {
        const tgCfg = await storage.getTelegramConfig();
        await storage.saveTelegramConfig({
          ...tgCfg,
          botToken: updated.telegramBotToken || tgCfg.botToken,
          chatId: updated.telegramChatId || tgCfg.chatId,
        });
      }

      return c.json({
        success: true,
        message: 'API Credentials updated safely in session and cache.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  // Manual Trigger for Health Check Cycle
  router.post('/api/cron/check', requireAdmin, async (c) => {
    try {
      await runMonitorCycle(storage, cache);
      return c.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: 'Infrastructure health check cycle executed successfully across all nodes and services.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  return router;
}
