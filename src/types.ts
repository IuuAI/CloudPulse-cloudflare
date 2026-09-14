export type ServiceStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';

export type NodeStatus = 'online' | 'degraded' | 'offline';

export type IncidentSeverity = 'minor' | 'major' | 'critical';

export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';

export type ThemeMode = 'light' | 'dark' | 'cyberpunk' | 'tech-blue' | 'matrix';

export interface ServiceHistoryDay {
  date: string;
  status: 'operational' | 'degraded' | 'outage';
}

export interface SslCertInfo {
  valid: boolean;
  issuer: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining: number;
  status: 'valid' | 'expiring_soon' | 'expired' | 'none';
  lastChecked: string;
}

export interface ServiceProbeConfig {
  method: 'GET' | 'POST' | 'HEAD';
  expectedStatusCode: number;
  timeoutMs: number;
  probeType: 'http' | 'tcp' | 'ping';
  tcpPort?: number;
  customHeaders?: Record<string, string>;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  url?: string;
  status: ServiceStatus;
  latency: number;
  uptime30d: number;
  uptimeHistory: ServiceHistoryDay[];
  lastCheck: string;
  description?: string;
  ssl?: SslCertInfo;
  probeConfig?: ServiceProbeConfig;
}

export interface NodeAlertThresholds {
  cpu: number;
  ram: number;
  disk: number;
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
  networkIn: string;
  networkOut: string;
  ping: number;
  uptime: string;
  os: string;
  lastHeartbeat: string;
  tags: string[];
  probeToken: string;
  probeInstalled?: boolean;
  loadAvg?: string;
  flagEmoji?: string;
  alertThresholds?: NodeAlertThresholds;
}

export interface MetricHistoryPoint {
  timestamp: string;
  timeLabel: string;
  avgCpu: number;
  avgRam: number;
  peakCpu: number;
  peakRam: number;
  activeNodes: number;
  avgLatency?: number;
  peakLatency?: number;
  p95Latency?: number;
  minLatency?: number;
  jitter?: number;
  serviceLatencies?: Record<string, number>;
}

export interface ProbeReportPayload {
  token: string;
  cpu: number;
  ram: number;
  disk: number;
  networkIn?: string;
  networkOut?: string;
  ping?: number;
  os?: string;
  uptime?: string;
  loadAvg?: string;
}

export interface IncidentUpdate {
  id: string;
  status: IncidentStatus;
  message: string;
  timestamp: string;
}

export interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  affectedServices: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  timeline: IncidentUpdate[];
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  botUsername: string;
  webhookUrl: string;
  autoAlerts: {
    serviceStatusChanged: boolean;
    incidentCreated: boolean;
    incidentResolved: boolean;
    nodeOffline: boolean;
    cpuThresholdAlert: boolean;
  };
}

export interface TelegramLogItem {
  id: string;
  type: 'push' | 'alert' | 'test';
  sender: string;
  chatId: string;
  content: string;
  status: 'sent' | 'simulated' | 'failed';
  timestamp: string;
  error?: string;
  dataAction?: string;
}

export interface SystemOverview {
  overallStatus: 'all_good' | 'degraded' | 'major_outage' | 'maintenance';
  uptime30d: number;
  totalServices: number;
  operationalServices: number;
  totalNodes: number;
  onlineNodes: number;
  activeIncidentsCount: number;
  telegramConfigured: boolean;
  lastUpdated: string;
}

export interface AdminAuthState {
  isAuthenticated: boolean;
  token?: string;
  username?: string;
}

export interface DatabaseBackupMeta {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  servicesCount: number;
  nodesCount: number;
  incidentsCount: number;
  checksum: string;
  type: 'manual' | 'auto' | 'pre-restore';
  description?: string;
}

export interface DatabaseEngineStats {
  dbSizeBytes: number;
  dbFile: string;
  isAtomicWriteEnabled: boolean;
  lastPersistedAt: string;
  totalBackups: number;
  lastBackupAt?: string;
  servicesCount: number;
  nodesCount: number;
  incidentsCount: number;
  metricsCount: number;
  logsCount: number;
  sessionsCount: number;
  integrityStatus: 'healthy' | 'warning' | 'repaired';
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  uptimeSeconds: number;
}

export interface DatabaseOptimizationResult {
  success: boolean;
  prunedMetricsCount: number;
  prunedLogsCount: number;
  prunedSessionsCount: number;
  beforeSizeBytes: number;
  afterSizeBytes: number;
  reclaimedBytes: number;
  durationMs: number;
  message: string;
}

// Multi-Channel Webhooks & Notifications
export type WebhookChannelType = 'wecom' | 'dingtalk' | 'feishu' | 'webhook' | 'discord' | 'slack';

export interface WebhookChannelEvents {
  serviceOutage: boolean;
  serviceRecovered: boolean;
  nodeOffline: boolean;
  highLoad: boolean;
  sslExpiring: boolean;
  backupCompleted: boolean;
}

export interface WebhookChannelConfig {
  id: string;
  name: string;
  type: WebhookChannelType;
  enabled: boolean;
  webhookUrl: string;
  secret?: string; // Signature secret for DingTalk / Feishu
  events: WebhookChannelEvents;
  createdAt: string;
  lastTestedAt?: string;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
}

export interface MaintenanceWindowConfig {
  enabled: boolean;
  startHour: number; // 0-23
  endHour: number; // 0-23
  mutedChannels: string[]; // 'all' or channel IDs
  reason?: string;
  updatedAt: string;
}

// Public Status Page Mode & Maintenance Announcement
export interface PublicAnnouncement {
  enabled: boolean;
  type: 'info' | 'warning' | 'maintenance' | 'success';
  title: string;
  message: string;
  updatedAt: string;
}

export interface PublicStatusConfig {
  isPublicEnabled: boolean;
  companyName: string;
  customTitle: string;
  customSubtitle: string;
  hideInternalIps: boolean;
  showUptimeChart: boolean;
  supportContactUrl?: string;
  announcement: PublicAnnouncement;
}

// SLA Reports & Reporting
export interface ServiceSlaSummary {
  serviceId: string;
  serviceName: string;
  category: string;
  url?: string;
  status: ServiceStatus;
  uptime30d: number;
  uptime7d: number;
  uptime90d: number;
  outageMinutes30d: number;
  outageMinutes7d: number;
  avgLatencyMs: number;
  targetSla: number; // e.g. 99.9%
  targetMet: boolean;
  incidentCount: number;
  sslStatus?: string;
}

export interface SlaReportResponse {
  generatedAt: string;
  reportingPeriod: '7d' | '30d' | '90d';
  overallAvailability: number;
  totalServices: number;
  compliantServices: number;
  nonCompliantServices: number;
  systemReliabilityTier: 'Tier IV (99.99%)' | 'Tier III (99.9%)' | 'Tier II (99.0%)' | 'Needs Attention';
  services: ServiceSlaSummary[];
}

// Audit Logs
export type AuditCategory = 'auth' | 'service' | 'node' | 'incident' | 'backup' | 'webhook' | 'settings' | 'database';

export interface AuditLogItem {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  category: AuditCategory;
  details: string;
  ip?: string;
}

// Cloudflare Free Tier & Quota Configuration
export interface CloudflareQuotaConfig {
  heartbeatIntervalSeconds: number; // e.g. 60 (Heartbeat report time: 10s - 600s)
  historyRetentionDays: number; // e.g. 30 (Historical metrics retention: 1 - 180 days)
  clientPollIntervalSeconds: number; // e.g. 30 (Frontend refresh polling: 10s - 300s)
  ecoMode: boolean; // Free tier eco mode: enables aggressive edge caching & optimization
  edgeCacheMaxAge: number; // Edge CDN cache TTL in seconds (e.g. 30)
  maxStoredMetricPoints: number; // Cap on stored metric points to stay within storage quota
  autoPruneExpiredHistory: boolean;
  workerDailyRequestLimit: number; // Standard free tier: 100,000
}

export type QuotaSettings = CloudflareQuotaConfig;

export interface CloudflareQuotaEstimate {
  config: CloudflareQuotaConfig;
  totalNodes: number;
  dailyNodeHeartbeatRequests: number;
  estimatedDailyPageViews: number;
  estimatedDailyApiReads: number;
  estimatedTotalDailyRequests: number;
  freeTierLimit: number;
  usagePercentage: number;
  status: 'safe' | 'warning' | 'exceeded';
  recommendations: string[];
}

export interface SystemApiKeysConfig {
  apiBaseUrl?: string;
  geminiApiKey?: string;
  hasGeminiApiKey?: boolean;
  geminiModel?: string;
  cloudflareApiToken?: string;
  hasCloudflareApiToken?: boolean;
  cloudflareAccountId?: string;
  cloudflareZoneId?: string;
  telegramBotToken?: string;
  hasTelegramBotToken?: boolean;
  telegramChatId?: string;
  probeSecretKey?: string;
  webhookSigningSecret?: string;
  openApiBearerToken?: string;
  updatedAt?: string;
}

export type MainAppTab = 'overview' | 'nodes' | 'sla' | 'incidents' | 'api-status' | 'telegram' | 'admin';



