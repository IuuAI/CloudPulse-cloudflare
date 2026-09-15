export interface AppConfig {
  environment: 'development' | 'production' | 'test';
  telegramBotToken?: string;
  telegramChatId?: string;
  adminPasswordHash?: string;
  geminiApiKey?: string;
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

export interface StorageAdapter {
  getOverview(): Promise<any>;
  saveOverview(overview: any): Promise<void>;
  getServices(): Promise<any[]>;
  saveService(service: any): Promise<void>;
  deleteService?(id: string): Promise<void>;
  getNodes(): Promise<any[]>;
  saveNode(node: any): Promise<void>;
  deleteNode?(id: string): Promise<void>;
  getIncidents(): Promise<any[]>;
  saveIncident(incident: any): Promise<void>;
  deleteIncident?(id: string): Promise<void>;
  getMetricsHistory(): Promise<any[]>;
  saveMetricPoint(point: any): Promise<void>;
  getTelegramConfig(): Promise<any>;
  saveTelegramConfig(config: any): Promise<void>;
  getTelegramLogs(): Promise<any[]>;
  saveTelegramLog(log: any): Promise<void>;
  getQuotaSettings(): Promise<any>;
  saveQuotaSettings(settings: any): Promise<void>;
  getAdminPassword?(): Promise<string>;
  saveAdminPassword?(password: string): Promise<void>;
  getD1UsageStats?(): Promise<CloudflareD1UsageStats>;
  pruneHistory(retentionDays: number): Promise<number>;
}

export interface CacheAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  getKVUsageStats?(): Promise<CloudflareKVUsageStats>;
}
