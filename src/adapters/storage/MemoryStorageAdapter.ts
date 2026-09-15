import { StorageAdapter } from '../../core/types';
const fallbackServices: any[] = [
  {
    id: 'gateway',
    name: 'Global API Gateway',
    category: 'Core',
    status: 'operational',
    latency: 28,
    uptime30d: 99.99,
    lastCheck: new Date().toISOString(),
    description: 'Cloudflare Anycast 边缘路由网关与反向代理',
    uptimeHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      status: 'operational' as const,
    })),
  },
  {
    id: 'auth',
    name: 'OAuth2 / IAM Service',
    category: 'Auth',
    status: 'operational',
    latency: 45,
    uptime30d: 99.95,
    lastCheck: new Date().toISOString(),
    description: '鉴权中心与管理员令牌验证服务',
    uptimeHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      status: 'operational' as const,
    })),
  },
  {
    id: 'db-cluster',
    name: 'Distributed SQL Primary',
    category: 'Database',
    status: 'operational',
    latency: 15,
    uptime30d: 99.99,
    lastCheck: new Date().toISOString(),
    description: '高可用持久化存储引擎 (SQLite / Cloudflare D1)',
    uptimeHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      status: 'operational' as const,
    })),
  },
  {
    id: 'storage',
    name: 'Object Storage (S3 / R2)',
    category: 'Storage',
    status: 'operational',
    latency: 38,
    uptime30d: 99.90,
    lastCheck: new Date().toISOString(),
    description: '数据备份存档与静态多媒体资源桶',
    uptimeHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      status: 'operational' as const,
    })),
  },
  {
    id: 'ai-engine',
    name: 'Gemini AI Inference Proxy',
    category: 'AI',
    status: 'operational',
    latency: 120,
    uptime30d: 99.85,
    lastCheck: new Date().toISOString(),
    description: '智能监控事件聚合与故障自动化分析代理',
    uptimeHistory: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      status: 'operational' as const,
    })),
  },
];

const fallbackNodes: any[] = [
  {
    id: 'n1',
    name: 'Edge-Tokyo-01',
    region: 'Asia (Tokyo)',
    ip: '***.***.***.***',
    status: 'online',
    cpu: 24,
    ram: 48,
    disk: 35,
    networkIn: '1.2 TB',
    networkOut: '4.5 TB',
    ping: 18,
    uptime: '45d 12h',
    os: 'Ubuntu 24.04 LTS (x86_64)',
    lastHeartbeat: new Date().toISOString(),
    tags: ['Asia', 'Edge', 'Gateway'],
    probeToken: '',
    flagEmoji: '🇯🇵',
  },
  {
    id: 'n2',
    name: 'Edge-Frankfurt-01',
    region: 'Europe (Germany)',
    ip: '***.***.***.***',
    status: 'online',
    cpu: 31,
    ram: 55,
    disk: 42,
    networkIn: '2.8 TB',
    networkOut: '9.1 TB',
    ping: 29,
    uptime: '62d 08h',
    os: 'Debian 12 Bookworm',
    lastHeartbeat: new Date().toISOString(),
    tags: ['Europe', 'Core', 'Cluster'],
    probeToken: '',
    flagEmoji: '🇩🇪',
  },
  {
    id: 'n3',
    name: 'Edge-SanJose-01',
    region: 'US West (California)',
    ip: '***.***.***.***',
    status: 'online',
    cpu: 45,
    ram: 62,
    disk: 58,
    networkIn: '4.1 TB',
    networkOut: '12.4 TB',
    ping: 41,
    uptime: '38d 19h',
    os: 'Alpine Linux 3.20',
    lastHeartbeat: new Date().toISOString(),
    tags: ['US-West', 'Edge'],
    probeToken: '',
    flagEmoji: '🇺🇸',
  },
  {
    id: 'n4',
    name: 'Edge-Singapore-01',
    region: 'Asia (Singapore)',
    ip: '***.***.***.***',
    status: 'online',
    cpu: 29,
    ram: 50,
    disk: 39,
    networkIn: '1.9 TB',
    networkOut: '6.0 TB',
    ping: 22,
    uptime: '51d 04h',
    os: 'Ubuntu 24.04 LTS',
    lastHeartbeat: new Date().toISOString(),
    tags: ['Asia-SE', 'Edge'],
    probeToken: '',
    flagEmoji: '🇸🇬',
  },
  {
    id: 'n5',
    name: 'Edge-SãoPaulo-01',
    region: 'South America (Brazil)',
    ip: '***.***.***.***',
    status: 'online',
    cpu: 48,
    ram: 64,
    disk: 52,
    networkIn: '850 GB',
    networkOut: '2.1 TB',
    ping: 85,
    uptime: '28d 14h',
    os: 'Debian 12',
    lastHeartbeat: new Date().toISOString(),
    tags: ['SA', 'Edge'],
    probeToken: '',
    flagEmoji: '🇧🇷',
  },
  {
    id: 'n6',
    name: 'Edge-Sydney-01',
    region: 'Oceania (Australia)',
    ip: '***.***.***.***',
    status: 'online',
    cpu: 35,
    ram: 52,
    disk: 44,
    networkIn: '1.1 TB',
    networkOut: '3.8 TB',
    ping: 52,
    uptime: '40d 22h',
    os: 'Ubuntu 24.04 LTS',
    lastHeartbeat: new Date().toISOString(),
    tags: ['Oceania', 'Edge'],
    probeToken: '',
    flagEmoji: '🇦🇺',
  },
];

const fallbackMetricsHistory: any[] = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(Date.now() - (23 - i) * 3600000);
  const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    timestamp: d.toISOString(),
    timeLabel,
    avgCpu: Math.floor(25 + Math.sin(i / 3) * 12 + Math.random() * 5),
    avgRam: Math.floor(48 + Math.cos(i / 4) * 8 + Math.random() * 4),
    peakCpu: Math.floor(45 + Math.random() * 15),
    peakRam: Math.floor(65 + Math.random() * 10),
    activeNodes: 6,
    avgLatency: Math.floor(30 + Math.sin(i / 2) * 8 + Math.random() * 4),
    p95Latency: Math.floor(55 + Math.random() * 15),
  };
});

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
