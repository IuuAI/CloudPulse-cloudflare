import { StorageAdapter, CacheAdapter, ServerNode, ServiceItem, NodeStatus } from '../core/types';
import { sendTelegramNotification, resolveTelegramBotToken } from '../adapters/notifications/TelegramNotifier';

interface ServiceProbeResult {
  service: ServiceItem;
  changed: boolean;
}

async function probeSingleService(s: ServiceItem): Promise<ServiceProbeResult> {
  const cloned: ServiceItem = { ...s };
  let statusChanged = false;

  if (cloned.url && (cloned.url.startsWith('http://') || cloned.url.startsWith('https://'))) {
    try {
      const t0 = Date.now();
      const probeRes = await fetch(cloned.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      const latency = Date.now() - t0;
      const newStatus = !probeRes.ok && probeRes.status >= 500 ? 'degraded' : 'operational';

      if (cloned.status !== newStatus) {
        statusChanged = true;
        cloned.status = newStatus;
      }
      cloned.latency = latency;
    } catch {
      if (cloned.status !== 'degraded' && cloned.status !== 'down') {
        statusChanged = true;
        cloned.status = 'degraded';
      }
      cloned.latency = 999;
    }
  }

  cloned.lastCheck = new Date().toISOString();
  return {
    service: cloned,
    changed: statusChanged,
  };
}

export async function runMonitorCycle(storage: StorageAdapter, _cache: CacheAdapter, envContext?: any): Promise<void> {
  const nodes = await storage.getNodes();
  const services = await storage.getServices();
  const quota = await storage.getQuotaSettings();
  const tgConfig = await storage.getTelegramConfig();
  const botToken = resolveTelegramBotToken(envContext ? { env: envContext } : undefined);

  const now = Date.now();
  const heartbeatSeconds = (quota?.checkIntervalMinutes || 5) * 60;
  // Node considered offline if no heartbeat received for > 3.5x heartbeat interval (minimum 180s)
  const offlineThresholdMs = Math.max(180, heartbeatSeconds * 3.5) * 1000;

  const changedNodes: ServerNode[] = [];
  let healthyNodesCount = 0;
  let totalLatency = 0;

  // 1. Evaluate node health & only write changed nodes
  for (const node of nodes) {
    const previousStatus = node.status;
    const lastSeenTime = node.lastSeen ? new Date(node.lastSeen).getTime() : 0;
    const isStale = lastSeenTime > 0 && now - lastSeenTime > offlineThresholdMs;

    let targetStatus: NodeStatus = previousStatus;
    if (isStale) {
      targetStatus = 'offline';
    } else if (node.cpu > 90 || node.ram > 95) {
      targetStatus = 'degraded';
    } else {
      targetStatus = 'online';
    }

    if (targetStatus !== previousStatus) {
      node.status = targetStatus;
      changedNodes.push(node);

      // Record event log on transition
      if (storage.recordNodeStatusEvent) {
        await storage.recordNodeStatusEvent({
          nodeId: node.id,
          timestamp: new Date().toISOString(),
          status: targetStatus,
          reason: isStale ? 'Heartbeat timeout / node unreachable' : 'Status evaluated from cluster metrics',
        }).catch(() => {});
      }

      // Telegram notification on status change
      if (tgConfig.enabled && botToken && tgConfig.chatId && tgConfig.alertOnStatusChange) {
        const icon = targetStatus === 'online' ? '🟢' : targetStatus === 'degraded' ? '🟡' : '🔴';
        sendTelegramNotification(
          botToken,
          tgConfig.chatId,
          `${icon} <b>[Node Status Changed]</b>\nNode: <b>${node.name}</b> (${node.region})\nStatus: <b>${previousStatus}</b> ➜ <b>${targetStatus.toUpperCase()}</b>`
        ).catch(() => {});
      }
    }

    if (node.status === 'online' || node.status === 'healthy') {
      healthyNodesCount++;
    }
    totalLatency += node.ping || 20;
  }

  // Batch persist changed nodes only (avoids wasteful D1 writes)
  if (changedNodes.length > 0) {
    if (storage.saveNodes) {
      await storage.saveNodes(changedNodes);
    } else {
      for (const n of changedNodes) {
        await storage.saveNode(n);
      }
    }
  }

  // 2. Parallel HTTP/HTTPS service probing with Promise.allSettled
  const probeSettled = await Promise.allSettled(services.map((s) => probeSingleService(s)));
  const updatedServices: ServiceItem[] = [];
  const changedServices: ServiceItem[] = [];

  for (const item of probeSettled) {
    if (item.status === 'fulfilled') {
      const { service, changed } = item.value;
      updatedServices.push(service);
      if (changed) {
        changedServices.push(service);
        if (tgConfig.enabled && tgConfig.botToken && tgConfig.chatId && tgConfig.alertOnStatusChange) {
          sendTelegramNotification(
            tgConfig.botToken,
            tgConfig.chatId,
            `⚠️ <b>[Service Status Changed]</b>\nService: <b>${service.name}</b>\nStatus: <b>${service.status.toUpperCase()}</b>\nLatency: ${service.latency}ms`
          ).catch(() => {});
        }
      }
    }
  }

  // Batch persist changed services or updated check times
  if (changedServices.length > 0) {
    if (storage.saveServices) {
      await storage.saveServices(changedServices);
    } else {
      for (const s of changedServices) {
        await storage.saveService(s);
      }
    }
  }

  // 3. Real Uptime & System Overview Calculation
  const avgLatency = nodes.length > 0 ? Math.round(totalLatency / nodes.length) : 0;
  const operationalServicesCount = updatedServices.filter((s) => s.status === 'operational').length;
  const totalElements = nodes.length + updatedServices.length;
  const healthyElements = healthyNodesCount + operationalServicesCount;

  // Real availability sample percentage across nodes and services
  const clusterUptime = totalElements > 0
    ? Number(((healthyElements / totalElements) * 100).toFixed(2))
    : 100.0;

  const incidents = await storage.getIncidents();
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved').length;

  const overview = {
    uptime: clusterUptime,
    totalNodes: nodes.length,
    healthyNodes: healthyNodesCount,
    activeIncidents,
    avgLatency,
    lastChecked: new Date().toISOString(),
  };
  await storage.saveOverview(overview);

  // 4. Record Metrics History Point
  const isoTimestamp = new Date().toISOString();
  const avgCpu = nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + (n.cpu || 0), 0) / nodes.length) : 0;
  const avgRam = nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + (n.ram || 0), 0) / nodes.length) : 0;

  await storage.saveMetricPoint({
    timestamp: isoTimestamp,
    latency: avgLatency,
    cpu: avgCpu,
    ram: avgRam,
  });

  // 5. Automatic retention pruning
  if (quota.autoPruneEnabled && quota.historyRetentionDays) {
    await storage.pruneHistory(quota.historyRetentionDays).catch(() => {});
  }

  // 6. High load alerts
  if (tgConfig.enabled && botToken && tgConfig.chatId && tgConfig.alertOnHighLoad) {
    if (avgCpu > 85) {
      sendTelegramNotification(
        botToken,
        tgConfig.chatId,
        `⚠️ <b>[CloudPulse High Load Alert]</b>\nAverage Cluster CPU is at <b>${avgCpu}%</b>.\nPlease check active server nodes.`
      ).catch(() => {});
    }
  }
}
