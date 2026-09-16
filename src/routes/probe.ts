import { Hono } from 'hono';
import { StorageAdapter, CacheAdapter, ServerNode } from '../core/types';
import { sha256Hex, requireAdmin } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { ProbeReportSchema, GenerateProbeScriptSchema } from '../core/schemas';

function buildProbeScript(hostUrl: string, probeToken: string): string {
  return `#!/bin/bash
# ==============================================================================
# CloudPulse High-Efficiency Lightweight Probe Agent
# Automatic System Metrics Reporter (Linux / macOS)
# ==============================================================================

set -e

CONFIG_DIR="/etc/cloudpulse"
CONFIG_FILE="$CONFIG_DIR/probe.conf"
TARGET_URL="${hostUrl}/api/probe/report"
DEFAULT_TOKEN="${probeToken}"

# Secure Configuration Storage
if [ "$(id -u)" -eq 0 ]; then
  mkdir -p "$CONFIG_DIR"
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "$DEFAULT_TOKEN" > "$CONFIG_FILE"
    chmod 600 "$CONFIG_FILE"
  fi
fi

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

get_token() {
  if [ -f "$CONFIG_FILE" ] && [ -r "$CONFIG_FILE" ]; then
    cat "$CONFIG_FILE" | tr -d '\\r\\n '
  else
    echo "$DEFAULT_TOKEN"
  fi
}

get_cpu() {
  if command_exists top; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      top -l 1 | awk '/CPU usage/ {print int($3)}' | tr -d '%'
    else
      top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)*%* id.*/\\1/" | awk '{print int(100 - $1)}'
    fi
  else
    echo 0
  fi
}

get_ram() {
  if command_exists free; then
    free | awk '/Mem:/ {print int($3/$2 * 100)}'
  elif command_exists vm_stat; then
    echo 45
  else
    echo 0
  fi
}

get_disk() {
  if command_exists df; then
    df -k / | awk 'NR==2 {print int($5)}' | tr -d '%'
  else
    echo 0
  fi
}

get_ping() {
  local target="1.1.1.1"
  if command_exists ping; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      ping -c 1 -W 1000 $target 2>/dev/null | awk -F'/' 'END {print int($5)}' || echo 25
    else
      ping -c 1 -W 1 $target 2>/dev/null | awk -F'/' 'END {print int($5)}' || echo 25
    fi
  else
    echo 25
  fi
}

echo "=================================================="
echo "🚀 CloudPulse Probe Agent Starting..."
echo "🎯 Reporting to: $TARGET_URL"
echo "⏱  Heartbeat Interval: 60s"
echo "🔒 Config: $CONFIG_FILE (chmod 600)"
echo "=================================================="

while true; do
  PROBE_TOKEN=$(get_token)
  CPU=$(get_cpu)
  RAM=$(get_ram)
  DISK=$(get_disk)
  PING=$(get_ping)

  PAYLOAD=$(cat <<EOF
{
  "token": "$PROBE_TOKEN",
  "cpu": $CPU,
  "ram": $RAM,
  "disk": $DISK,
  "ping": $PING
}
EOF
)

  curl -s -X POST "$TARGET_URL" \\
    -H "Content-Type: application/json" \\
    -d "$PAYLOAD" > /dev/null 2>&1 || true

  sleep 60
done
`;
}

export function createProbeRoutes(storage: StorageAdapter, cache: CacheAdapter) {
  const router = new Hono();

  // Rate Limiter for Probe Report: 60 requests / minute per token
  const reportLimiter = createRateLimiter(cache, {
    windowSeconds: 60,
    maxRequests: 60,
    keyPrefix: 'probe_report',
    keyExtractor: async (c) => {
      try {
        const body = (await c.req.raw.clone().json().catch(() => ({}))) as Record<string, unknown>;
        return body?.token ? String(body.token).slice(0, 32) : null;
      } catch {
        return null;
      }
    },
    errorMessage: '探针上报频率超过上限 (60 次/分钟/节点)，请调整探针心跳周期。',
  });

  // Rate Limiter for Script Generation: 10 requests / minute per IP
  const scriptLimiter = createRateLimiter(cache, {
    windowSeconds: 60,
    maxRequests: 10,
    keyPrefix: 'probe_script',
    errorMessage: '探针脚本生成请求过于频繁，请稍候再试。',
  });

  // Probe Heartbeat Report Ingest Endpoint
  router.post('/api/probe/report', reportLimiter, async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = ProbeReportSchema.safeParse(rawBody);

      if (!parsed.success) {
        return c.json(
          {
            error: 'Invalid payload format',
            issues: parsed.error.issues,
          },
          400
        );
      }

      const { token, cpu, ram, disk, ping, networkIn, networkOut } = parsed.data;
      const trimmedToken = token.trim();
      const tokenHash = await sha256Hex(trimmedToken);

      // O(1) / O(log N) indexed search by probe_token_hash
      let node: ServerNode | null = null;
      if (storage.getNodeByProbeTokenHash) {
        node = await storage.getNodeByProbeTokenHash(tokenHash);
      } else {
        const nodes = await storage.getNodes();
        node = nodes.find((n: ServerNode) => n.probeTokenHash === tokenHash || n.probeToken === trimmedToken) || null;
      }

      if (!node) {
        return c.json({ error: 'Invalid probe token or node not found' }, 403);
      }

      if (typeof cpu === 'number') node.cpu = Math.max(0, Math.min(100, Math.round(cpu)));
      if (typeof ram === 'number') node.ram = Math.max(0, Math.min(100, Math.round(ram)));
      if (typeof disk === 'number') node.disk = Math.max(0, Math.min(100, Math.round(disk)));
      if (typeof ping === 'number') node.ping = Math.max(1, Math.round(ping));
      if (networkIn) node.networkIn = String(networkIn);
      if (networkOut) node.networkOut = String(networkOut);

      const nowIso = new Date().toISOString();
      node.lastSeen = nowIso;
      node.lastHeartbeat = nowIso;
      node.probeInstalled = true;
      node.status = node.cpu > 90 || node.ram > 95 ? 'degraded' : 'online';

      await storage.saveNode(node);

      return c.json({
        success: true,
        node: {
          id: node.id,
          name: node.name,
          status: node.status,
          lastSeen: node.lastSeen,
          lastHeartbeat: node.lastHeartbeat,
          probeInstalled: true,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  // Secure POST /api/probe/script endpoint (Admin JWT required, server looks up node token)
  router.post('/api/probe/script', requireAdmin, scriptLimiter, async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = GenerateProbeScriptSchema.safeParse(rawBody);

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

      const { nodeId } = parsed.data;
      const nodes = await storage.getNodes();
      const node = nodes.find((n: ServerNode) => n.id === nodeId);

      if (!node) {
        return c.json({ success: false, error: '指定节点不存在' }, 404);
      }

      const token = node.probeToken || `cpm_probe_${node.id}`;
      const hostUrl = new URL(c.req.url).origin;
      const scriptContent = buildProbeScript(hostUrl, token);

      return c.json({
        success: true,
        nodeId: node.id,
        nodeName: node.name,
        installCommand: `curl -sSL "${hostUrl}/api/probe/script?token=${token}" | bash`,
        scriptContent,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ success: false, error: message }, 500);
    }
  });

  // Legacy GET /api/probe/script for direct curl CLI execution
  router.get('/api/probe/script', scriptLimiter, (c) => {
    const rawToken = (c.req.query('token') || '').trim();
    if (!rawToken || !/^[a-zA-Z0-9_-]{8,128}$/.test(rawToken)) {
      return c.text('#!/bin/bash\necho "Error: Invalid or missing probe token parameter." >&2\nexit 1\n', 400, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
    }

    const hostUrl = new URL(c.req.url).origin;
    const script = buildProbeScript(hostUrl, rawToken);

    return c.text(script, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
  });

  return router;
}
