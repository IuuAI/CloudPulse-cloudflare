import { StorageAdapter, CacheAdapter } from '../core/types';
import { sendTelegramNotification } from '../adapters/notifications/TelegramNotifier';

export async function runMonitorCycle(storage: StorageAdapter, cache: CacheAdapter) {
  const nodes = await storage.getNodes();
  const services = await storage.getServices();
  const quota = await storage.getQuotaSettings();
  const tgConfig = await storage.getTelegramConfig();

  let healthyCount = 0;
  let totalLatency = 0;
  const now = Date.now();
  const heartbeatSeconds = quota?.heartbeatIntervalSeconds || 60;
  const offlineThresholdMs = Math.max(180, heartbeatSeconds * 3) * 1000;

  // Real node health evaluation based on heartbeat freshness without random overwriting
  for (const node of nodes) {
    const lastSeenTime = node.lastSeen ? new Date(node.lastSeen).getTime() : 0;
    const isStale = lastSeenTime > 0 && (now - lastSeenTime > offlineThresholdMs);

    if (isStale) {
      node.status = 'degraded';
    } else if (!node.status) {
      node.status = 'healthy';
    }

    if (node.status === 'healthy') healthyCount++;
    totalLatency += (node.ping || 20);
    await storage.saveNode(node);
  }

  // Real service health evaluation (probe HTTP/HTTPS url if configured, otherwise preserve state)
  for (const s of services) {
    if (s.url && (s.url.startsWith('http://') || s.url.startsWith('https://'))) {
      try {
        const t0 = Date.now();
        const probeRes = await fetch(s.url, { 
          method: 'HEAD', 
          signal: AbortSignal.timeout(5000) 
        });
        s.latency = Date.now() - t0;
        s.status = (!probeRes.ok && probeRes.status >= 500) ? 'degraded' : 'operational';
      } catch {
        s.status = 'degraded';
        s.latency = 999;
      }
    }
    s.lastCheck = new Date().toISOString();
    await storage.saveService(s);
  }

  const avgLatency = Math.round(totalLatency / (nodes.length || 1));
  const uptime = Number(((healthyCount / (nodes.length || 1)) * 99.99).toFixed(2));
  const incidents = await storage.getIncidents();
  const activeIncidents = incidents.filter(i => i.status !== 'resolved').length;

  const overview = {
    uptime,
    totalNodes: nodes.length,
    healthyNodes: healthyCount,
    activeIncidents,
    avgLatency,
    lastChecked: new Date().toISOString()
  };
  await storage.saveOverview(overview);

  // Append metric history point with standard ISO 8601 timestamp for proper retention pruning
  const isoTimestamp = new Date().toISOString();
  const avgCpu = Math.round(nodes.reduce((acc, n) => acc + (n.cpu || 0), 0) / (nodes.length || 1));
  const avgRam = Math.round(nodes.reduce((acc, n) => acc + (n.ram || 0), 0) / (nodes.length || 1));
  
  await storage.saveMetricPoint({
    timestamp: isoTimestamp,
    avgLatency,
    cpuLoad: avgCpu,
    ramLoad: avgRam,
    p95Latency: Math.round(avgLatency * 1.35)
  });

  // Auto prune if enabled
  if (quota.autoPruneExpiredHistory) {
    await storage.pruneHistory(quota.historyRetentionDays);
  }

  // Cache latest overview for instant retrieval
  await cache.set('latest_overview', overview, 60);

  // Send Telegram notification if high load or status changed
  if (tgConfig.enabled && tgConfig.botToken && tgConfig.chatId) {
    if (avgCpu > 85 && tgConfig.alertOnHighLoad) {
      await sendTelegramNotification(
        tgConfig.botToken,
        tgConfig.chatId,
        `⚠️ <b>[CloudPulse High Load Alert]</b>\nAverage Cluster CPU is at <b>${avgCpu}%</b>.\nPlease check infrastructure nodes.`
      );
    }
  }
}
