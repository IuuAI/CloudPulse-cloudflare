export type NodeStatus = 'online' | 'degraded' | 'offline' | 'healthy' | 'maintenance';
export type ServiceStatus = 'operational' | 'degraded' | 'down' | 'maintenance';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentSeverity = 'critical' | 'major' | 'minor' | 'info';

export interface AppConfig {
  environment: 'development' | 'production' | 'test';
  telegramBotToken?: string;
  telegramChatId?: string;
  adminPasswordHash?: string;
  geminiApiKey?: string;
  allowedOrigins?: string[];
}

export interface ServerNode {
  id: string;
  name: string;
  region: string;
  ip: string;
  status: NodeStatus;
  cpu: number;
  ram: number;
  disk: number;
  ping: number;
  networkIn: string;
  networkOut: string;
  uptime: number;
  lastSeen: string;
  lastHeartbeat?: string;
  probeInstalled: boolean;
  probeToken?: string;
  probeTokenHash?: string | null;
  os?: string;
  tags?: string[];
}

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  status: ServiceStatus;
  latency: number;
  uptime: number;
  uptime30d: number;
  lastCheck: string;
  url?: string;
  description?: string;
}

export interface IncidentUpdate {
  id: string;
  timestamp: string;
  status: IncidentStatus;
  message: string;
}

export interface IncidentItem {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedServices: string[];
  startedAt: string;
  resolvedAt?: string;
  updates: IncidentUpdate[];
}

export interface MetricHistoryPoint {
  id?: number | string;
  timestamp: string;
  cpu: number;
  ram: number;
  latency: number;
  qps?: number;
  activeNodes?: number;
}

export interface NodeStatusEvent {
  id?: number | string;
  nodeId: string;
  timestamp: string;
  status: NodeStatus;
  reason?: string;
}

export interface OverviewStats {
  uptime: number;
  totalNodes: number;
  healthyNodes: number;
  activeIncidents: number;
  avgLatency: number;
  lastChecked: string;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken?: string;
  chatId: string;
  alertOnStatusChange?: boolean;
  alertOnHighLoad?: boolean;
  alertOnIncident?: boolean;
  dailyDigest?: boolean;
  digestTime?: string;
}

export interface TelegramLog {
  id: string;
  timestamp: string;
  type: string;
  status: 'success' | 'error' | 'sent' | 'skipped' | string;
  message: string;
  details?: string;
}

export interface CloudflareD1UsageStats {
  dailyRowsRead: number;
  readLimit: number;
  dailyRowsWritten: number;
  writeLimit: number;
  storageBytes: number;
  storageLimitBytes: number;
  totalTables: number;
  totalRows: number;
  readUsagePercent: number;
  writeUsagePercent: number;
  storageUsagePercent: number;
}

export interface CloudflareKVUsageStats {
  dailyReads: number;
  readLimit: number;
  dailyWrites: number;
  writeLimit: number;
  dailyDeletes: number;
  deleteLimit: number;
  storageBytes: number;
  storageLimitBytes: number;
  totalKeys: number;
  readUsagePercent: number;
  writeUsagePercent: number;
}

export interface QuotaSettings {
  d1ReadLimitDaily: number;
  d1WriteLimitDaily: number;
  kvReadLimitDaily: number;
  kvWriteLimitDaily: number;
  historyRetentionDays: number;
  checkIntervalMinutes: number;
  autoPruneEnabled: boolean;
  d1Usage?: CloudflareD1UsageStats;
  kvUsage?: CloudflareKVUsageStats;
}

export interface AdminAuthRecord {
  passwordHash: string;
  salt: string;
  updatedAt: string;
  tokenVersion?: number;
}

export interface StorageAdapter {
  getOverview(): Promise<OverviewStats>;
  saveOverview(overview: OverviewStats): Promise<void>;
  getServices(): Promise<ServiceItem[]>;
  saveService(service: ServiceItem): Promise<void>;
  saveServices?(services: ServiceItem[]): Promise<void>;
  deleteService?(id: string): Promise<void>;
  getNodes(): Promise<ServerNode[]>;
  getNodeByProbeTokenHash?(tokenHash: string): Promise<ServerNode | null>;
  saveNode(node: ServerNode): Promise<void>;
  saveNodes?(nodes: ServerNode[]): Promise<void>;
  deleteNode?(id: string): Promise<void>;
  recordNodeStatusEvent?(event: NodeStatusEvent): Promise<void>;
  getNodeStatusEvents?(nodeId?: string, limit?: number): Promise<NodeStatusEvent[]>;
  getIncidents(): Promise<IncidentItem[]>;
  saveIncident(incident: IncidentItem): Promise<void>;
  deleteIncident?(id: string): Promise<void>;
  getMetricsHistory(): Promise<MetricHistoryPoint[]>;
  saveMetricPoint(point: MetricHistoryPoint): Promise<void>;
  getTelegramConfig(): Promise<TelegramConfig>;
  saveTelegramConfig(config: TelegramConfig): Promise<void>;
  getTelegramLogs(): Promise<TelegramLog[]>;
  saveTelegramLog(log: TelegramLog): Promise<void>;
  getQuotaSettings(): Promise<QuotaSettings>;
  saveQuotaSettings(settings: QuotaSettings): Promise<void>;
  getAdminPassword?(): Promise<string>;
  saveAdminPassword?(password: string): Promise<void>;
  getAdminAuth?(): Promise<AdminAuthRecord | null>;
  saveAdminAuth?(auth: AdminAuthRecord): Promise<void>;
  getD1UsageStats?(): Promise<CloudflareD1UsageStats>;
  pruneHistory(retentionDays: number): Promise<number>;
}

export interface CacheAdapter {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  getKVUsageStats?(): Promise<CloudflareKVUsageStats>;
}
