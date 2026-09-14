import { StorageAdapter, CacheAdapter } from '../core/types';
import { sendTelegramNotification } from '../adapters/notifications/TelegramNotifier';

export async function runMonitorCycle(storage: StorageAdapter, cache: CacheAdapter) {
  const nodes = await storage.getNodes();
  const services = await storage.getServices();
  const quota = await storage.getQuotaSettings();
  const tgConfig = await storage.getTelegramConfig();

  // Simulate probe health checks
  let healthyCount = 0;
  let totalLatency = 0;

  for (const node of nodes) {
    const isDegraded = Math.random() < 0.05;
    node.status = isDegraded ? 'degraded' : 'healthy';
    node.cpu = Math.floor(20 + Math.random() * 45);
    node.ram = Math.floor(40 + Math.random() * 30);
    node.ping = Math.floor(15 + Math.random() * 50);
    node.lastSeen = new Date().toISOString();
    await storage.saveNode(node);
    if (node.status === 'healthy') healthyCount++;
    totalLatency += node.ping;
  }

  for (const s of services) {
    const isDown = Math.random() < 0.02;
    s.status = isDown ? 'degraded' : 'operational';
    s.latency = Math.floor(20 + Math.random() * 80);
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

  // Append metric history point
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const avgCpu = Math.round(nodes.reduce((acc, n) => acc + n.cpu, 0) / (nodes.length || 1));
  const avgRam = Math.round(nodes.reduce((acc, n) => acc + n.ram, 0) / (nodes.length || 1));
  
  await storage.saveMetricPoint({
    timestamp: timeStr,
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
