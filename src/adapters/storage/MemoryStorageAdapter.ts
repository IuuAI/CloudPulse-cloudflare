import { StorageAdapter } from '../../core/types';
import {
  fallbackOverview,
  fallbackServices,
  fallbackNodes,
  fallbackMetricsHistory,
} from '../../data/fallbackData';

export class MemoryStorageAdapter implements StorageAdapter {
  private overview: any = {
    uptime: 99.98,
    totalNodes: 6,
    healthyNodes: 6,
    activeIncidents: 0,
    avgLatency: 32,
    lastChecked: new Date().toISOString(),
    overallStatus: 'all_good',
    uptime30d: 99.98,
    totalServices: 5,
    operationalServices: 5,
    onlineNodes: 6,
    activeIncidentsCount: 0,
    telegramConfigured: false,
    lastUpdated: new Date().toISOString(),
  };

  private services: any[] = JSON.parse(JSON.stringify(fallbackServices));
  private nodes: any[] = JSON.parse(JSON.stringify(fallbackNodes));
  private incidents: any[] = [];
  private metricsHistory: any[] = JSON.parse(JSON.stringify(fallbackMetricsHistory));
  private telegramConfig: any = {
    botToken: '',
    chatId: '',
    enabled: false,
    alertOnStatusChange: true,
    alertOnHighLoad: true,
    alertOnIncident: true,
    dailyDigest: false,
    digestTime: '08:00',
  };
  private telegramLogs: any[] = [];
  private quotaSettings: any = {
    workerDailyRequestLimit: 100000,
    historyRetentionDays: 30,
    ecoMode: true,
    autoPruneExpiredHistory: true,
    heartbeatIntervalSeconds: 60,
    clientPollIntervalSeconds: 30,
    maxStoredMetricPoints: 720,
  };

  async getOverview(): Promise<any> {
    return { ...this.overview, lastChecked: new Date().toISOString() };
  }

  async saveOverview(overview: any): Promise<void> {
    this.overview = { ...this.overview, ...overview };
  }

  async getServices(): Promise<any[]> {
    return [...this.services];
  }

  async saveService(service: any): Promise<void> {
    const idx = this.services.findIndex((s) => s.id === service.id);
    if (idx >= 0) {
      this.services[idx] = { ...this.services[idx], ...service };
    } else {
      this.services.push(service);
    }
  }

  async deleteService(id: string): Promise<void> {
    this.services = this.services.filter((s) => s.id !== id);
  }

  async getNodes(): Promise<any[]> {
    return [...this.nodes];
  }

  async saveNode(node: any): Promise<void> {
    const idx = this.nodes.findIndex((n) => n.id === node.id);
    if (idx >= 0) {
      this.nodes[idx] = { ...this.nodes[idx], ...node };
    } else {
      this.nodes.push(node);
    }
  }

  async deleteNode(id: string): Promise<void> {
    this.nodes = this.nodes.filter((n) => n.id !== id);
  }

  async getIncidents(): Promise<any[]> {
    return [...this.incidents];
  }

  async saveIncident(incident: any): Promise<void> {
    const idx = this.incidents.findIndex((i) => i.id === incident.id);
    if (idx >= 0) {
      this.incidents[idx] = { ...this.incidents[idx], ...incident };
    } else {
      this.incidents.unshift(incident);
    }
  }

  async deleteIncident(id: string): Promise<void> {
    this.incidents = this.incidents.filter((i) => i.id !== id);
  }

  async getMetricsHistory(): Promise<any[]> {
    return this.metricsHistory.slice(-200);
  }

  async saveMetricPoint(point: any): Promise<void> {
    this.metricsHistory.push(point);
    if (this.metricsHistory.length > 720) {
      this.metricsHistory.shift();
    }
  }

  async getTelegramConfig(): Promise<any> {
    return { ...this.telegramConfig };
  }

  async saveTelegramConfig(config: any): Promise<void> {
    this.telegramConfig = { ...this.telegramConfig, ...config };
  }

  async getTelegramLogs(): Promise<any[]> {
    return [...this.telegramLogs];
  }

  async saveTelegramLog(log: any): Promise<void> {
    this.telegramLogs.unshift(log);
    if (this.telegramLogs.length > 100) {
      this.telegramLogs.pop();
    }
  }

  async getQuotaSettings(): Promise<any> {
    return { ...this.quotaSettings };
  }

  async saveQuotaSettings(settings: any): Promise<void> {
    this.quotaSettings = { ...this.quotaSettings, ...settings };
  }

  async getD1UsageStats(): Promise<any> {
    const readLimit = 5000000;
    const writeLimit = 100000;
    const storageLimitBytes = 5 * 1024 * 1024 * 1024;
    const totalRows = this.services.length + this.nodes.length + this.incidents.length + this.metricsHistory.length + this.telegramLogs.length;
    const storageBytes = 64 * 1024 + totalRows * 320;
    return {
      dailyRowsRead: 1680,
      readLimit,
      dailyRowsWritten: 320,
      writeLimit,
      storageBytes,
      storageLimitBytes,
      totalTables: 9,
      totalRows,
      readUsagePercent: 0.03,
      writeUsagePercent: 0.32,
      storageUsagePercent: 0.01,
    };
  }

  async pruneHistory(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const initialLen = this.metricsHistory.length;
    this.metricsHistory = this.metricsHistory.filter(
      (m: any) => typeof m.timestamp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.timestamp) && m.timestamp >= cutoff
    );
    return initialLen - this.metricsHistory.length;
  }
}
