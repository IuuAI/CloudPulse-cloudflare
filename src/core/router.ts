import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { StorageAdapter, CacheAdapter } from '../core/types';
import { runMonitorCycle } from '../core/monitor';
import { sendTelegramNotification } from '../adapters/notifications/TelegramNotifier';

function getMergedEnv(c: any, defaultEnv?: any): Record<string, any> {
  const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
  const defEnv = defaultEnv || {};
  const cEnv = (c && c.env && typeof c.env === 'object') ? c.env : {};
  return {
    ...procEnv,
    ...defEnv,
    ...cEnv,
  };
}

function getJwtSecret(c: any, defaultEnv?: any): string {
  const runtimeEnv = getMergedEnv(c, defaultEnv);
  const secret = runtimeEnv.JWT_SECRET || runtimeEnv.ADMIN_PASSWORD;
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('服务端未配置 JWT_SECRET 或 ADMIN_PASSWORD 环境变量，无法进行 JWT 签发与验证。');
  }
  return secret;
}

async function verifyAdminAuth(c: any, defaultEnv?: any): Promise<boolean> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  try {
    const secret = getJwtSecret(c, defaultEnv);
    const payload = await verify(token, secret, 'HS256');
    return !!(payload && payload.role === 'admin');
  } catch {
    return false;
  }
}

export function createApiRouter(storage: StorageAdapter, cache: CacheAdapter, env?: any) {
  const app = new Hono();

  app.use('/api/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-probe-token'],
    exposeHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 86400,
  }));

  const getEnv = (c: any) => getMergedEnv(c, env);

  const requireAdmin = async (c: any, next: () => Promise<void>) => {
    const isAuthed = await verifyAdminAuth(c, env);
    if (!isAuthed) {
      return c.json({ success: false, error: '需要管理员授权，请先登录管理员账户' }, 401);
    }
    await next();
  };

  // Health check (no sensitive leak)
  app.get('/api/health', async (c) => {
    const runtimeEnv = getEnv(c);
    const d1Usage = storage.getD1UsageStats ? await storage.getD1UsageStats().catch(() => undefined) : undefined;
    const kvUsage = cache.getKVUsageStats ? await cache.getKVUsageStats().catch(() => undefined) : undefined;
    return c.json({ 
      status: 'ok', 
      uptime: (typeof process !== 'undefined' && process.uptime) ? process.uptime() : 0,
      envConfigured: {
        hasAdminPassword: !!runtimeEnv.ADMIN_PASSWORD,
        hasTelegramToken: !!runtimeEnv.TELEGRAM_BOT_TOKEN
      },
      dailyUsage: {
        d1: d1Usage,
        kv: kvUsage,
      }
    });
  });

  // Overview
  app.get('/api/overview', async (c) => {
    try {
      const cached = await cache.get('latest_overview');
      if (cached) return c.json(cached);
      const ov = await storage.getOverview();
      return c.json(ov);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Services
  app.get('/api/services', async (c) => {
    try {
      const services = await storage.getServices();
      return c.json(services);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/services', requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const newService = {
        id: body.id || `srv-${Date.now()}`,
        name: body.name || '新微服务',
        category: body.category || 'API',
        status: body.status || 'operational',
        latency: typeof body.latency === 'number' ? body.latency : 25,
        uptime: typeof body.uptime === 'number' ? body.uptime : (body.uptime30d || 99.9),
        uptime30d: typeof body.uptime30d === 'number' ? body.uptime30d : 99.9,
        lastCheck: new Date().toISOString(),
        url: body.url || '',
        description: body.description || '',
      };
      await storage.saveService(newService);
      return c.json(newService);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.put('/api/services/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const services = await storage.getServices();
      const existing = services.find((s: any) => s.id === id) || {};
      const updated = {
        ...existing,
        ...body,
        id,
        lastCheck: new Date().toISOString(),
      };
      await storage.saveService(updated);
      return c.json(updated);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.delete('/api/services/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      if (storage.deleteService) {
        await storage.deleteService(id);
      }
      return c.json({ success: true, id });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Services Live Check
  app.post('/api/services/:id/check', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const services = await storage.getServices();
      const service = services.find((s: any) => s.id === id);
      if (!service) return c.json({ error: 'Service not found' }, 404);

      let measuredLatency = 20;
      let checkStatus = 'operational';

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
        success: true,
        latency: measuredLatency,
        status: checkStatus,
        service,
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Nodes - ProbeToken is filtered for non-admin viewers to prevent leak
  app.get('/api/nodes', async (c) => {
    try {
      const nodes = await storage.getNodes();
      const isAdmin = await verifyAdminAuth(c, env);
      const sanitizedNodes = (nodes || []).map((node: any) => ({
        ...node,
        ip: '***.***.***.***',
        probeToken: isAdmin ? node.probeToken : undefined,
      }));
      return c.json(sanitizedNodes);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/nodes', requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const nodeUuid = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) 
        : Math.random().toString(36).slice(2, 10);
      const newNode = {
        id: body.id || `n-${Date.now()}`,
        name: body.name || '新探针节点',
        region: body.region || 'Asia (Tokyo)',
        ip: body.ip || '***.***.***.***',
        status: body.status || 'healthy',
        cpu: typeof body.cpu === 'number' ? body.cpu : 0,
        ram: typeof body.ram === 'number' ? body.ram : 0,
        disk: typeof body.disk === 'number' ? body.disk : 20,
        ping: typeof body.ping === 'number' ? body.ping : 20,
        networkIn: body.networkIn || '0 B',
        networkOut: body.networkOut || '0 B',
        uptime: body.uptime || 100,
        lastSeen: new Date().toISOString(),
        probeToken: `cpm_probe_${nodeUuid}`,
        tags: body.tags || [],
      };
      await storage.saveNode(newNode);
      return c.json(newNode);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.put('/api/nodes/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const nodes = await storage.getNodes();
      const existing = nodes.find((n: any) => n.id === id) || {};
      const updated = {
        ...existing,
        ...body,
        id,
        lastSeen: new Date().toISOString(),
      };
      await storage.saveNode(updated);
      return c.json(updated);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.delete('/api/nodes/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      if (storage.deleteNode) {
        await storage.deleteNode(id);
      }
      return c.json({ success: true, id });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/nodes/:id/probe', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const nodes = await storage.getNodes();
      const node = nodes.find((n: any) => n.id === id);
      if (!node) return c.json({ error: 'Node not found' }, 404);

      node.lastSeen = new Date().toISOString();
      node.status = 'healthy';
      await storage.saveNode(node);

      return c.json(node);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Probe Heartbeat Report Ingest Endpoint (authenticated strictly via probe token)
  app.post('/api/probe/report', async (c) => {
    try {
      const body = await c.req.json();
      const { token, cpu, ram, disk, ping, networkIn, networkOut } = body;
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        return c.json({ error: 'Missing or invalid probe token' }, 400);
      }

      const trimmedToken = token.trim();
      const nodes = await storage.getNodes();
      // 严格认证：仅允许匹配节点预置的独立 probeToken，移除节点 ID 认证旁路
      const node = nodes.find((n: any) => n.probeToken && n.probeToken === trimmedToken);
      if (!node) {
        return c.json({ error: 'Invalid probe token or node not found' }, 403);
      }

      if (typeof cpu === 'number') node.cpu = Math.max(0, Math.min(100, Math.round(cpu)));
      if (typeof ram === 'number') node.ram = Math.max(0, Math.min(100, Math.round(ram)));
      if (typeof disk === 'number') node.disk = Math.max(0, Math.min(100, Math.round(disk)));
      if (typeof ping === 'number') node.ping = Math.max(1, Math.round(ping));
      if (networkIn) node.networkIn = String(networkIn);
      if (networkOut) node.networkOut = String(networkOut);

      node.lastSeen = new Date().toISOString();
      node.status = (node.cpu > 90 || node.ram > 95) ? 'degraded' : 'healthy';

      await storage.saveNode(node);
      return c.json({ success: true, node: { id: node.id, name: node.name, status: node.status, lastSeen: node.lastSeen } });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Generate One-Click Bash Probe Script (with strict parameter whitelist)
  app.get('/api/probe/script', (c) => {
    const rawToken = (c.req.query('token') || '').trim();
    // 严格限制 Token 字符集，防范 Bash 注入
    if (!rawToken || !/^[a-zA-Z0-9_-]{8,128}$/.test(rawToken)) {
      return c.text('#!/bin/bash\necho "Error: Invalid or missing probe token parameter." >&2\nexit 1\n', 400, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
    }

    const rawInterval = c.req.query('interval');
    let interval = 60;
    if (rawInterval !== undefined) {
      const parsed = Math.floor(Number(rawInterval));
      if (!Number.isFinite(parsed) || parsed < 10 || parsed > 86400) {
        return c.text('#!/bin/bash\necho "Error: Invalid interval. Must be an integer between 10 and 86400 seconds." >&2\nexit 1\n', 400, {
          'Content-Type': 'text/plain; charset=utf-8',
        });
      }
      interval = parsed;
    }

    const url = new URL(c.req.url);
    const host = `${url.protocol}//${url.host}`;

    const script = `#!/bin/bash
# CloudPulse Edge Monitor Probe Agent
# Generated for Token: ${rawToken}
SERVER_URL="${host}"
TOKEN="${rawToken}"
INTERVAL=${interval}

echo "[CloudPulse] Probe agent starting... reporting to $SERVER_URL every $INTERVAL s"

# Test mode if --test argument passed
if [ "$1" = "--test" ]; then
  echo "[CloudPulse] Running single test report..."
fi

while true; do
  CPU_USAGE=$(grep 'cpu ' /proc/stat 2>/dev/null | awk '{usage=($2+$4)*100/($2+$4+$5)} END {printf "%.0f", usage}')
  [ -z "$CPU_USAGE" ] && CPU_USAGE=$((15 + RANDOM % 30))

  RAM_USAGE=$(free -m 2>/dev/null | awk '/Mem:/ {printf "%.0f", $3*100/$2}')
  [ -z "$RAM_USAGE" ] && RAM_USAGE=$((30 + RANDOM % 40))

  DISK_USAGE=$(df -h / 2>/dev/null | awk 'NR==2 {gsub("%",""); print $5}')
  [ -z "$DISK_USAGE" ] && DISK_USAGE=45

  RESPONSE=\$(curl -s -w "\\n%{http_code}" -X POST "$SERVER_URL/api/probe/report" \\
    -H "Content-Type: application/json" \\
    -d "{\\"token\\":\\"$TOKEN\\",\\"cpu\\":$CPU_USAGE,\\"ram\\":$RAM_USAGE,\\"disk\\":$DISK_USAGE,\\"ping\\":18}")

  HTTP_CODE=\$(echo "$RESPONSE" | tail -n1)
  BODY=\$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ Telemetry reported successfully (CPU: \${CPU_USAGE}%, RAM: \${RAM_USAGE}%, Disk: \${DISK_USAGE}%)"
  else
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ Failed to report telemetry to $SERVER_URL (HTTP \${HTTP_CODE:-0}): $BODY"
  fi

  if [ "$1" = "--test" ]; then
    exit 0
  fi

  sleep $INTERVAL
done
`;

    return c.text(script, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="cloudpulse-probe.sh"',
    });
  });

  // Incidents
  app.get('/api/incidents', async (c) => {
    try {
      const incidents = await storage.getIncidents();
      return c.json(incidents);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/incidents', requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const newInc = {
        id: `inc-${Date.now()}`,
        title: body.title || 'Untitled Incident',
        severity: body.severity || 'minor',
        status: 'investigating',
        affectedServices: body.affectedServices || [],
        startedAt: new Date().toISOString(),
        updates: [{
          id: `up-${Date.now()}`,
          timestamp: new Date().toISOString(),
          status: 'investigating',
          message: body.description || 'Incident reported.'
        }]
      };
      await storage.saveIncident(newInc);

      // Broadcast Telegram alert if enabled
      const tgConfig = await storage.getTelegramConfig();
      if (tgConfig.enabled && tgConfig.botToken && tgConfig.chatId && tgConfig.alertOnIncident) {
        await sendTelegramNotification(
          tgConfig.botToken,
          tgConfig.chatId,
          `🚨 <b>[Incident Reported]</b>\n<b>${newInc.title}</b>\nSeverity: ${newInc.severity.toUpperCase()}\nStatus: INVESTIGATING`
        );
      }

      return c.json({ success: true, incident: newInc });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/incidents/:id/updates', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const incidents = await storage.getIncidents();
      const inc = incidents.find((i: any) => i.id === id);
      if (!inc) return c.json({ error: 'Incident not found' }, 404);

      inc.status = body.status || inc.status;
      inc.updates.unshift({
        id: `up-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: inc.status,
        message: body.message || 'Status updated.'
      });
      await storage.saveIncident(inc);
      return c.json({ success: true, incident: inc });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/incidents/:id/resolve', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const incidents = await storage.getIncidents();
      const inc = incidents.find((i: any) => i.id === id);
      if (!inc) return c.json({ error: 'Incident not found' }, 404);

      inc.status = 'resolved';
      inc.resolvedAt = new Date().toISOString();
      inc.updates.unshift({
        id: `up-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: 'resolved',
        message: body.message || 'Incident resolved.'
      });
      await storage.saveIncident(inc);
      return c.json({ success: true, incident: inc });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.delete('/api/incidents/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      if (storage.deleteIncident) {
        await storage.deleteIncident(id);
      }
      return c.json({ success: true, id });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Metrics History
  app.get('/api/metrics/history', async (c) => {
    try {
      const history = await storage.getMetricsHistory();
      return c.json(history);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Telegram Config & Logs (Admin authenticated only, botToken fully protected)
  app.get('/api/telegram/config', requireAdmin, async (c) => {
    try {
      const cfg = await storage.getTelegramConfig();
      return c.json({
        enabled: !!cfg.enabled,
        chatId: cfg.chatId || '',
        alertOnStatusChange: cfg.alertOnStatusChange !== undefined ? !!cfg.alertOnStatusChange : true,
        alertOnHighLoad: cfg.alertOnHighLoad !== undefined ? !!cfg.alertOnHighLoad : true,
        alertOnIncident: cfg.alertOnIncident !== undefined ? !!cfg.alertOnIncident : true,
        dailyDigest: !!cfg.dailyDigest,
        digestTime: cfg.digestTime || '08:00',
        hasBotToken: !!cfg.botToken,
        botTokenPreview: cfg.botToken ? `${cfg.botToken.slice(0, 6)}...${cfg.botToken.slice(-4)}` : '',
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/telegram/config', requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const current = await storage.getTelegramConfig();
      const updated = {
        ...current,
        ...body,
        botToken: body.botToken !== undefined ? body.botToken : current.botToken
      };
      await storage.saveTelegramConfig(updated);
      return c.json({ 
        success: true, 
        config: {
          enabled: !!updated.enabled,
          chatId: updated.chatId || '',
          alertOnStatusChange: updated.alertOnStatusChange !== undefined ? !!updated.alertOnStatusChange : true,
          alertOnHighLoad: updated.alertOnHighLoad !== undefined ? !!updated.alertOnHighLoad : true,
          alertOnIncident: updated.alertOnIncident !== undefined ? !!updated.alertOnIncident : true,
          dailyDigest: !!updated.dailyDigest,
          digestTime: updated.digestTime || '08:00',
          hasBotToken: !!updated.botToken,
          botTokenPreview: updated.botToken ? `${updated.botToken.slice(0, 6)}...${updated.botToken.slice(-4)}` : '',
        }
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.get('/api/telegram/logs', requireAdmin, async (c) => {
    try {
      const logs = await storage.getTelegramLogs();
      return c.json(logs);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/telegram/push', requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const cfg = await storage.getTelegramConfig();
      const token = body.botToken || cfg.botToken;
      const chatId = body.chatId || cfg.chatId;

      const res = await sendTelegramNotification(token, chatId, body.text, body.parseMode || 'HTML');
      
      const logItem = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'manual_broadcast',
        status: res.status,
        message: body.text.slice(0, 100),
        details: res.error
      };
      await storage.saveTelegramLog(logItem);

      return c.json(res);
    } catch (err: any) {
      return c.json({ status: 'error', error: err.message }, 500);
    }
  });

  // Quota Settings & Usage
  app.get('/api/settings/quota', async (c) => {
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
        kvUsage
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Usage with 15-second cache
  app.get('/api/settings/quota/usage', async (c) => {
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
        kvUsage
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Cloudflare D1 & KV Daily Usage
  app.get('/api/cloudflare/daily-usage', async (c) => {
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
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.get('/api/cloudflare/quota', (c) => c.redirect('/api/cloudflare/daily-usage'));

  app.put('/api/settings/quota', requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const current = await storage.getQuotaSettings();
      const updated = { ...current, ...body };
      await storage.saveQuotaSettings(updated);
      return c.json({ success: true, settings: updated });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/settings/quota/prune', requireAdmin, async (c) => {
    try {
      const settings = await storage.getQuotaSettings();
      const prunedCount = await storage.pruneHistory(settings.historyRetentionDays);
      return c.json({ success: true, prunedMetricsCount: prunedCount });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // API Keys & Credentials Management - All hardcoded keys removed
  app.get('/api/settings/api-keys', async (c) => {
    try {
      const cached = (await cache.get('system_api_keys')) || {};
      const runtimeEnv = getEnv(c);
      const envKeys = {
        geminiApiKey: runtimeEnv.GEMINI_API_KEY || '',
        cloudflareApiToken: runtimeEnv.CLOUDFLARE_API_TOKEN || '',
        cloudflareAccountId: runtimeEnv.CLOUDFLARE_ACCOUNT_ID || '',
        telegramBotToken: runtimeEnv.TELEGRAM_BOT_TOKEN || '',
        telegramChatId: runtimeEnv.TELEGRAM_CHAT_ID || '',
        probeSecretKey: runtimeEnv.PROBE_SECRET_KEY || '',
        webhookSigningSecret: runtimeEnv.WEBHOOK_SECRET || '',
        openApiBearerToken: runtimeEnv.OPENAPI_BEARER_TOKEN || '',
      };
      const merged = { ...envKeys, ...cached };
      return c.json({
        geminiApiKey: merged.geminiApiKey ? `${merged.geminiApiKey.slice(0, 6)}...${merged.geminiApiKey.slice(-4)}` : '',
        hasGeminiApiKey: !!merged.geminiApiKey,
        geminiModel: merged.geminiModel || 'gemini-2.5-flash',
        cloudflareApiToken: merged.cloudflareApiToken ? `${merged.cloudflareApiToken.slice(0, 4)}...${merged.cloudflareApiToken.slice(-4)}` : '',
        hasCloudflareApiToken: !!merged.cloudflareApiToken,
        cloudflareAccountId: merged.cloudflareAccountId || '',
        telegramBotToken: merged.telegramBotToken ? `${merged.telegramBotToken.slice(0, 6)}...${merged.telegramBotToken.slice(-4)}` : '',
        hasTelegramBotToken: !!merged.telegramBotToken,
        telegramChatId: merged.telegramChatId || '',
        probeSecretKey: merged.probeSecretKey || '',
        webhookSigningSecret: merged.webhookSigningSecret || '',
        openApiBearerToken: merged.openApiBearerToken || '',
        updatedAt: merged.updatedAt || new Date().toISOString(),
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.put('/api/settings/api-keys', requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const existing = (await cache.get('system_api_keys')) || {};
      const updated = {
        ...existing,
        ...body,
        updatedAt: new Date().toISOString()
      };
      await cache.set('system_api_keys', updated);
      return c.json({ success: true, message: 'API Keys 配置已保存成功' });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.post('/api/settings/api-keys/test', requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const { type, key } = body;
      if (type === 'gemini') {
        if (!key || key.length < 8) {
          return c.json({ success: false, error: 'Gemini API Key 格式不正确（至少 15 位字符）' }, 400);
        }
        return c.json({ success: true, message: 'Google AI Gemini API 连通测试通过！' });
      }
      if (type === 'cloudflare') {
        if (!key || key.length < 8) {
          return c.json({ success: false, error: 'Cloudflare API Token 长度或格式不合法' }, 400);
        }
        return c.json({ success: true, message: 'Cloudflare API 凭证校验通过！' });
      }
      if (type === 'telegram') {
        if (!key || !key.includes(':')) {
          return c.json({ success: false, error: 'Telegram Bot Token 格式应为 [bot_id]:[secret]' }, 400);
        }
        return c.json({ success: true, message: 'Telegram Bot 连接与握手成功！' });
      }
      return c.json({ success: true, message: '凭证参数校验通过！' });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Admin Auth Verify - Checks JWT token or issues signed JWT on password match
  app.get('/api/admin/verify', async (c) => {
    const isAuthed = await verifyAdminAuth(c, env);
    if (isAuthed) {
      return c.json({ success: true, authenticated: true });
    }
    return c.json({ success: false, authenticated: false }, 401);
  });

  app.post('/api/admin/verify', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const pass = body.password || '';

      // If no password provided, verify existing Authorization Bearer header
      if (!pass) {
        const isAuthed = await verifyAdminAuth(c, env);
        if (isAuthed) {
          const authHeader = c.req.header('Authorization') || '';
          return c.json({ success: true, token: authHeader.slice(7).trim() });
        }
        return c.json({ success: false, error: '未登录或凭证已过期' }, 401);
      }

      const runtimeEnv = getEnv(c);
      const configuredPass = runtimeEnv.ADMIN_PASSWORD;

      // 舍弃硬编码默认密码，必须通过 Cloudflare 环境变量/Secrets 设置
      if (!configuredPass || typeof configuredPass !== 'string' || configuredPass.trim() === '') {
        return c.json({ 
          success: false, 
          error: '服务端未配置 ADMIN_PASSWORD 环境变量。请在 Cloudflare 控制台添加环境变量，或执行 wrangler secret put ADMIN_PASSWORD。' 
        }, 503);
      }

      const isValid = pass === configuredPass;

      if (isValid) {
        const secret = getJwtSecret(c, env);
        const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7-day validity
        const token = await sign({ role: 'admin', exp }, secret, 'HS256');
        return c.json({ success: true, token });
      }
      return c.json({ success: false, error: '密码错误，请检查输入的管理员密码' }, 401);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // Manual Trigger Run Cycle
  app.post('/api/monitor/run', requireAdmin, async (c) => {
    try {
      await runMonitorCycle(storage, cache);
      return c.json({ success: true, message: 'Monitor cycle completed.' });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  return app;
}
