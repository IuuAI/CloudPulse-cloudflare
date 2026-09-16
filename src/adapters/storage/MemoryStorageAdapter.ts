import {
  StorageAdapter,
  ServerNode,
  ServiceItem,
  IncidentItem,
  MetricHistoryPoint,
  NodeStatusEvent,
  OverviewStats,
  TelegramConfig,
  TelegramLog,
  QuotaSettings,
  AdminAuthRecord,
} from '../../core/types';

const fallbackServices: ServiceItem[] = [
  {
    id: 'gateway',
    name: 'Global API Gateway',
    category: 'Core',
    status: 'operational',
    latency: 28,
    uptime: 99.99,
    uptime30d: 99.99,
    lastCheck: new Date().toISOString(),
    description: 'Cloudflare Anycast 边缘路由网关与反向代理',
  },
  {
    id: 'auth',
    name: 'OAuth2 / IAM Service',
    category: 'Auth',
    status: 'operational',
    latency: 45,
    uptime: 99.95,
    uptime30d: 99.95,
    lastCheck: new Date().toISOString(),
    description: '鉴权中心与管理员令牌验证服务',
  },
  {
    id: 'db-cluster',
    name: 'Distributed SQL Primary',
    category: 'Database',
    status: 'operational',
    latency: 15,
    uptime: 99.99,
    uptime30d: 99.99,
    lastCheck: new Date().toISOString(),
    description: '高可用持久化存储引擎 (SQLite / Cloudflare D1)',
  },
  {
    id: 'storage',
    name: 'Object Storage (S3 / R2)',
    category: 'Storage',
    status: 'operational',
    latency: 38,
    uptime: 99.90,
    uptime30d: 99.90,
    lastCheck: new Date().toISOString(),
    description: '数据备份存档与静态多媒体资源桶',
  },
  {
    id: 'ai-engine',
    name: 'Gemini AI Inference Proxy',
    category: 'AI',
    status: 'operational',
    latency: 120,
    uptime: 99.85,
    uptime30d: 99.85,
    lastCheck: new Date().toISOString(),
    description: '智能监控事件聚合与故障自动化分析代理',
  },
];

const fallbackNodes: ServerNode[] = [
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
    uptime: 99.99,
    os: 'Ubuntu 24.04 LTS (x86_64)',
    lastSeen: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    tags: ['Asia', 'Edge', 'Gateway'],
    probeInstalled: true,
    probeToken: 'tok-tokyo-01',
    probeTokenHash: '4126bb62e92c4749f7e532b21aa6c464ef69d4e5f7f98502f92f254b3d735070',
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
    uptime: 99.95,
    os: 'Debian 12 Bookworm',
    lastSeen: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    tags: ['Europe', 'Core', 'Cluster'],
    probeInstalled: true,
    probeToken: 'tok-fra-01',
    probeTokenHash: '1f5e27a94d0c9a62aa87d65fc97ecdf3351ec8a48b594b150fe1844b26fe78dc',
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
    uptime: 99.92,
    os: 'Alpine Linux 3.20',
    lastSeen: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    tags: ['US-West', 'Edge'],
    probeInstalled: true,
    probeToken: 'tok-sjc-01',
    probeTokenHash: 'b4f8d55c7075c2e9a263d91cf97cf8e11a6ef5a882cb12d93eefae9b3806fca4',
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
    uptime: 99.98,
    os: 'Ubuntu 24.04 LTS',
    lastSeen: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    tags: ['Asia-SE', 'Edge'],
    probeInstalled: true,
    probeToken: 'tok-sin-01',
    probeTokenHash: '1ca8e4a77cecf709f6e4d4aa1525048db49b10ee7aafe6cf6e154f85e4922eb4',
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
    uptime: 99.80,
    os: 'Debian 12',
    lastSeen: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    tags: ['SA', 'Edge'],
    probeInstalled: true,
    probeToken: 'tok-sao-01',
    probeTokenHash: 'e2bf4e59f4f494dcfe6264f3fb0477174668b556942004245fcfead7baefc45d',
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
    uptime: 99.94,
    os: 'Ubuntu 22.04 LTS',
    lastSeen: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
    tags: ['Oceania', 'Edge'],
    probeInstalled: true,
    probeToken: 'tok-syd-01',
    probeTokenHash: '7ee7ef2fc42da0db7c82aee65814bfb9f67a296d8e2023ec5f470559f5b610c3',
  },
];

const fallbackMetricsHistory: MetricHistoryPoint[] = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(Date.now() - (23 - i) * 3600000);
  return {
    timestamp: d.toISOString(),
    cpu: Math.floor(25 + Math.sin(i / 3) * 12 + Math.random() * 5),
    ram: Math.floor(48 + Math.cos(i / 4) * 8 + Math.random() * 4),
    latency: Math.floor(30 + Math.sin(i / 2) * 8 + Math.random() * 4),
  };
});

export class MemoryStorageAdapter implements StorageAdapter {
  private overview: OverviewStats = {
    uptime: 99.98,
    totalNodes: 6,
    healthyNodes: 6,
    activeIncidents: 0,
    avgLatency: 32,
    lastChecked: new Date().toISOString(),
  };

  private services: ServiceItem[] = JSON.parse(JSON.stringify(fallbackServices));
  private nodes: ServerNode[] = JSON.parse(JSON.stringify(fallbackNodes));
  private incidents: IncidentItem[] = [];
  private metricsHistory: MetricHistoryPoint[] = JSON.parse(JSON.stringify(fallbackMetricsHistory));
  private nodeEvents: NodeStatusEvent[] = [];
  private telegramConfig: TelegramConfig = {
    botToken: '',
    chatId: '',
    enabled: false,
    alertOnStatusChange: true,
    alertOnHighLoad: true,
    alertOnIncident: true,
    dailyDigest: false,
    digestTime: '08:00',
  };
  private telegramLogs: TelegramLog[] = [];
  private quotaSettings: QuotaSettings = {
    d1ReadLimitDaily: 5000000,
    d1WriteLimitDaily: 100000,
    kvReadLimitDaily: 100000,
    kvWriteLimitDaily: 1000,
    historyRetentionDays: 30,
    checkIntervalMinutes: 5,
    autoPruneEnabled: true,
  };
  private adminAuth: AdminAuthRecord | null = null;

  async getOverview(): Promise<OverviewStats> {
    return { ...this.overview, lastChecked: new Date().toISOString() };
  }

  async saveOverview(overview: OverviewStats): Promise<void> {
    this.overview = { ...this.overview, ...overview };
  }

  async getServices(): Promise<ServiceItem[]> {
    return [...this.services];
  }

  async saveService(service: ServiceItem): Promise<void> {
    const idx = this.services.findIndex((s) => s.id === service.id);
    if (idx >= 0) {
      this.services[idx] = { ...this.services[idx], ...service };
    } else {
      this.services.push(service);
    }
  }

  async saveServices(services: ServiceItem[]): Promise<void> {
    for (const s of services) {
      await this.saveService(s);
    }
  }

  async deleteService(id: string): Promise<void> {
    this.services = this.services.filter((s) => s.id !== id);
  }

  async getNodes(): Promise<ServerNode[]> {
    return [...this.nodes];
  }

  async getNodeByProbeTokenHash(tokenHash: string): Promise<ServerNode | null> {
    const node = this.nodes.find(
      (n) => n.probeTokenHash === tokenHash || n.probeToken === tokenHash
    );
    return node ? { ...node } : null;
  }

  async saveNode(node: ServerNode): Promise<void> {
    const idx = this.nodes.findIndex((n) => n.id === node.id);
    if (idx >= 0) {
      this.nodes[idx] = { ...this.nodes[idx], ...node };
    } else {
      this.nodes.push(node);
    }
  }

  async saveNodes(nodes: ServerNode[]): Promise<void> {
    for (const n of nodes) {
      await this.saveNode(n);
    }
  }

  async deleteNode(id: string): Promise<void> {
    this.nodes = this.nodes.filter((n) => n.id !== id);
  }

  async recordNodeStatusEvent(event: NodeStatusEvent): Promise<void> {
    this.nodeEvents.unshift({
      id: this.nodeEvents.length + 1,
      ...event,
    });
    if (this.nodeEvents.length > 500) {
      this.nodeEvents = this.nodeEvents.slice(0, 500);
    }
  }

  async getNodeStatusEvents(nodeId?: string, limit: number = 100): Promise<NodeStatusEvent[]> {
    let filtered = this.nodeEvents;
    if (nodeId) {
      filtered = filtered.filter((e) => e.nodeId === nodeId);
    }
    return filtered.slice(0, limit);
  }

  async getIncidents(): Promise<IncidentItem[]> {
    return [...this.incidents];
  }

  async saveIncident(incident: IncidentItem): Promise<void> {
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

  async getMetricsHistory(): Promise<MetricHistoryPoint[]> {
    return [...this.metricsHistory];
  }

  async saveMetricPoint(point: MetricHistoryPoint): Promise<void> {
    this.metricsHistory.push(point);
    if (this.metricsHistory.length > 200) {
      this.metricsHistory = this.metricsHistory.slice(-200);
    }
  }

  async getTelegramConfig(): Promise<TelegramConfig> {
    return { ...this.telegramConfig };
  }

  async saveTelegramConfig(config: TelegramConfig): Promise<void> {
    this.telegramConfig = { ...this.telegramConfig, ...config };
  }

  async getTelegramLogs(): Promise<TelegramLog[]> {
    return [...this.telegramLogs];
  }

  async saveTelegramLog(log: TelegramLog): Promise<void> {
    this.telegramLogs.unshift(log);
    if (this.telegramLogs.length > 50) {
      this.telegramLogs = this.telegramLogs.slice(0, 50);
    }
  }

  async getQuotaSettings(): Promise<QuotaSettings> {
    return { ...this.quotaSettings };
  }

  async saveQuotaSettings(settings: QuotaSettings): Promise<void> {
    this.quotaSettings = { ...this.quotaSettings, ...settings };
  }

  async getAdminAuth(): Promise<AdminAuthRecord | null> {
    return this.adminAuth ? { ...this.adminAuth } : null;
  }

  async saveAdminAuth(auth: AdminAuthRecord): Promise<void> {
    this.adminAuth = { ...auth };
  }

  async pruneHistory(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const initial = this.metricsHistory.length;
    this.metricsHistory = this.metricsHistory.filter((m) => m.timestamp >= cutoff);
    return initial - this.metricsHistory.length;
  }
}
