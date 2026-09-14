export interface AppConfig {
  environment: 'development' | 'production' | 'test';
  telegramBotToken?: string;
  telegramChatId?: string;
  adminPasswordHash?: string;
  geminiApiKey?: string;
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
  pruneHistory(retentionDays: number): Promise<number>;
}

export interface CacheAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
