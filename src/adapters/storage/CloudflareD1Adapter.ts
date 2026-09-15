/// <reference types="@cloudflare/workers-types" />
import { StorageAdapter, CloudflareD1UsageStats } from '../../core/types';

export class CloudflareD1Adapter implements StorageAdapter {
  private initialized = false;
  private rowsReadSession = 0;
  private rowsWrittenSession = 0;
  private unpersistedReads = 0;
  private unpersistedWrites = 0;

  constructor(private db?: D1Database) {}

  public async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  private checkBinding() {
    if (!this.db) {
      throw new Error("Cloudflare D1 database binding 'DB' is not configured. Please bind your D1 database with variable name 'DB' in Cloudflare Pages / Workers settings or wrangler.toml.");
    }
  }

  private recordRead(rows: number = 1) {
    const count = Math.max(1, rows);
    this.rowsReadSession += count;
    this.unpersistedReads += count;
    if (this.unpersistedReads >= 20) {
      this.flushDailyStats().catch(() => {});
    }
  }

  private recordWrite(rows: number = 1) {
    const count = Math.max(1, rows);
    this.rowsWrittenSession += count;
    this.unpersistedWrites += count;
    if (this.unpersistedWrites >= 5) {
      this.flushDailyStats().catch(() => {});
    }
  }

  private async flushDailyStats() {
    if (!this.db || !this.initialized || (this.unpersistedReads === 0 && this.unpersistedWrites === 0)) return;
    const readsToFlush = this.unpersistedReads;
    const writesToFlush = this.unpersistedWrites;
    this.unpersistedReads = 0;
    this.unpersistedWrites = 0;

    const today = new Date().toISOString().slice(0, 10);
    try {
      await this.db.prepare(`
        INSERT INTO d1_daily_stats (date, rows_read, rows_written, last_updated)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          rows_read = d1_daily_stats.rows_read + excluded.rows_read,
          rows_written = d1_daily_stats.rows_written + excluded.rows_written,
          last_updated = excluded.last_updated
      `).bind(today, readsToFlush, writesToFlush, new Date().toISOString()).run();
    } catch (e) {
      this.unpersistedReads += readsToFlush;
      this.unpersistedWrites += writesToFlush;
    }
  }

  private async ensureInitialized() {
    this.checkBinding();
    if (this.initialized) return;
    try {
      const tableStatements = [
        `CREATE TABLE IF NOT EXISTS system_overview (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          uptime REAL NOT NULL,
          total_nodes INTEGER NOT NULL,
          healthy_nodes INTEGER NOT NULL,
          active_incidents INTEGER NOT NULL,
          avg_latency INTEGER NOT NULL,
          last_checked TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          status TEXT NOT NULL,
          latency INTEGER NOT NULL,
          uptime REAL NOT NULL,
          last_check TEXT NOT NULL,
          url TEXT,
          description TEXT,
          uptime_history TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS server_nodes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          region TEXT NOT NULL,
          ip TEXT NOT NULL,
          status TEXT NOT NULL,
          cpu INTEGER NOT NULL,
          ram INTEGER NOT NULL,
          disk INTEGER NOT NULL,
          ping INTEGER NOT NULL,
          network_in TEXT NOT NULL,
          network_out TEXT NOT NULL,
          uptime REAL NOT NULL,
          last_seen TEXT NOT NULL,
          probe_token TEXT,
          os TEXT,
          tags TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS incidents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          severity TEXT NOT NULL,
          status TEXT NOT NULL,
          affected_services TEXT NOT NULL,
          started_at TEXT NOT NULL,
          resolved_at TEXT,
          updates TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS metrics_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          avg_latency INTEGER NOT NULL,
          cpu_load INTEGER NOT NULL,
          ram_load INTEGER NOT NULL,
          p95_latency INTEGER NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS telegram_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          bot_token TEXT,
          chat_id TEXT,
          enabled INTEGER NOT NULL,
          alert_on_status_change INTEGER NOT NULL,
          alert_on_high_load INTEGER NOT NULL,
          alert_on_incident INTEGER NOT NULL,
          daily_digest INTEGER NOT NULL,
          digest_time TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS telegram_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS quota_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          worker_daily_request_limit INTEGER NOT NULL,
          history_retention_days INTEGER NOT NULL,
          eco_mode INTEGER NOT NULL,
          auto_prune_expired_history INTEGER NOT NULL,
          heartbeat_interval_seconds INTEGER NOT NULL,
          client_poll_interval_seconds INTEGER NOT NULL,
          max_stored_metric_points INTEGER NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS admin_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          admin_password TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS d1_daily_stats (
          date TEXT PRIMARY KEY,
          rows_read INTEGER NOT NULL DEFAULT 0,
          rows_written INTEGER NOT NULL DEFAULT 0,
          last_updated TEXT NOT NULL
        )`
      ];

      await this.db!.batch(tableStatements.map(sql => this.db!.prepare(sql)));

      const ovCheck = await this.db!.prepare("SELECT COUNT(*) as cnt FROM system_overview").first() as any;
      if (!ovCheck || ovCheck.cnt === 0) {
        await this.db!.prepare(`
          INSERT OR IGNORE INTO system_overview (id, uptime, total_nodes, healthy_nodes, active_incidents, avg_latency, last_checked)
          VALUES (1, 99.98, 6, 6, 0, 42, ?)
        `).bind(new Date().toISOString()).run();

        const defaultServices = [
          ['gateway', 'Global API Gateway', 'Core', 'operational', 28, 99.99, new Date().toISOString()],
          ['auth', 'OAuth2 / IAM Service', 'Auth', 'operational', 45, 99.95, new Date().toISOString()],
          ['db-cluster', 'Distributed SQL Primary', 'Database', 'operational', 15, 99.99, new Date().toISOString()],
          ['storage', 'Object Storage (S3)', 'Storage', 'operational', 38, 99.90, new Date().toISOString()],
          ['ai-engine', 'Gemini AI Inference Proxy', 'AI', 'operational', 120, 99.85, new Date().toISOString()],
        ];
        for (const s of defaultServices) {
          await this.db!.prepare("INSERT OR IGNORE INTO services (id, name, category, status, latency, uptime, last_check) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(...s).run();
        }

        const defaultNodes = [
          ['n1', 'Edge-Tokyo-01', 'Asia (Tokyo)', '104.18.32.1', 'healthy', 24, 48, 35, 18, '1.2 TB', '4.5 TB', 99.99, new Date().toISOString(), 'tok-tokyo-01', 'Ubuntu 24.04 LTS (x86_64)', JSON.stringify(['Asia', 'Edge', 'Gateway'])],
          ['n2', 'Edge-Frankfurt-01', 'Europe (Germany)', '104.18.32.2', 'healthy', 31, 55, 42, 29, '2.8 TB', '9.1 TB', 99.95, new Date().toISOString(), 'tok-fra-01', 'Debian 12 Bookworm', JSON.stringify(['Europe', 'Core', 'Cluster'])],
          ['n3', 'Edge-SanJose-01', 'US West (California)', '104.18.32.3', 'healthy', 45, 62, 58, 41, '4.1 TB', '12.4 TB', 99.92, new Date().toISOString(), 'tok-sjc-01', 'Alpine Linux 3.20', JSON.stringify(['US', 'API-Gateway'])],
          ['n4', 'Edge-Singapore-01', 'Asia (Singapore)', '104.18.32.4', 'healthy', 29, 50, 39, 22, '1.9 TB', '6.0 TB', 99.98, new Date().toISOString(), 'tok-sin-01', 'Ubuntu 24.04 LTS', JSON.stringify(['Asia', 'ASEAN-Hub'])],
          ['n5', 'Edge-SãoPaulo-01', 'South America (Brazil)', '104.18.32.5', 'healthy', 58, 70, 65, 85, '850 GB', '2.1 TB', 99.80, new Date().toISOString(), 'tok-sao-01', 'Debian 12 Bookworm', JSON.stringify(['SA', 'Edge'])],
          ['n6', 'Edge-Sydney-01', 'Oceania (Australia)', '104.18.32.6', 'healthy', 35, 52, 44, 52, '1.1 TB', '3.8 TB', 99.94, new Date().toISOString(), 'tok-syd-01', 'Ubuntu 22.04 LTS', JSON.stringify(['Oceania', 'Edge'])],
        ];
        for (const n of defaultNodes) {
          await this.db!.prepare("INSERT OR IGNORE INTO server_nodes (id, name, region, ip, status, cpu, ram, disk, ping, network_in, network_out, uptime, last_seen, probe_token, os, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...n).run();
        }

        await this.db!.prepare(`
          INSERT OR IGNORE INTO telegram_config (id, bot_token, chat_id, enabled, alert_on_status_change, alert_on_high_load, alert_on_incident, daily_digest, digest_time)
          VALUES (1, '', '', 0, 1, 1, 1, 0, '08:00')
        `).run();

        await this.db!.prepare(`
          INSERT OR IGNORE INTO quota_settings (id, worker_daily_request_limit, history_retention_days, eco_mode, auto_prune_expired_history, heartbeat_interval_seconds, client_poll_interval_seconds, max_stored_metric_points)
          VALUES (1, 100000, 30, 1, 1, 60, 30, 720)
        `).run();

        await this.db!.prepare(`
          INSERT OR IGNORE INTO admin_settings (id, admin_password)
          VALUES (1, 'admin123')
        `).run();
      }

      this.initialized = true;
    } catch (e: any) {
      console.error("D1 Init Schema Error:", e);
      throw e;
    }
  }

  async getOverview() {
    await this.ensureInitialized();
    this.recordRead(1);
    const { results } = await this.db!.prepare("SELECT * FROM system_overview WHERE id = 1").all();
    if (!results || results.length === 0) {
      return { uptime: 99.98, totalNodes: 6, healthyNodes: 6, activeIncidents: 0, avgLatency: 42, lastChecked: new Date().toISOString() };
    }
    const r: any = results[0];
    return { uptime: r.uptime, totalNodes: r.total_nodes, healthyNodes: r.healthy_nodes, activeIncidents: r.active_incidents, avgLatency: r.avg_latency, lastChecked: r.last_checked };
  }

  async saveOverview(ov: any) {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare(`
      INSERT INTO system_overview (id, uptime, total_nodes, healthy_nodes, active_incidents, avg_latency, last_checked)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET uptime = excluded.uptime, total_nodes = excluded.total_nodes, healthy_nodes = excluded.healthy_nodes, active_incidents = excluded.active_incidents, avg_latency = excluded.avg_latency, last_checked = excluded.last_checked
    `).bind(ov.uptime, ov.totalNodes, ov.healthyNodes, ov.activeIncidents, ov.avgLatency, ov.lastChecked).run();
  }

  async getServices() {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare("SELECT * FROM services").all();
    this.recordRead(results?.length || 1);
    return (results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      status: r.status,
      latency: r.latency,
      uptime: r.uptime,
      lastCheck: r.last_check,
      url: r.url || '',
      description: r.description || '',
      uptimeHistory: r.uptime_history ? JSON.parse(r.uptime_history) : undefined,
    }));
  }

  async saveService(s: any) {
    await this.ensureInitialized();
    this.recordWrite(1);
    const historyJson = s.uptimeHistory ? JSON.stringify(s.uptimeHistory) : null;
    await this.db!.prepare(`
      INSERT INTO services (id, name, category, status, latency, uptime, last_check, url, description, uptime_history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        name = excluded.name, 
        category = excluded.category, 
        status = excluded.status, 
        latency = excluded.latency, 
        uptime = excluded.uptime, 
        last_check = excluded.last_check,
        url = COALESCE(excluded.url, services.url),
        description = COALESCE(excluded.description, services.description),
        uptime_history = COALESCE(excluded.uptime_history, services.uptime_history)
    `).bind(
      s.id,
      s.name,
      s.category,
      s.status,
      s.latency,
      s.uptime ?? 99.9,
      s.lastCheck || new Date().toISOString(),
      s.url || null,
      s.description || null,
      historyJson
    ).run();
  }

  async deleteService(id: string) {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare("DELETE FROM services WHERE id = ?").bind(id).run();
  }

  async getNodes() {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare("SELECT * FROM server_nodes").all();
    this.recordRead(results?.length || 1);
    return (results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      region: r.region,
      ip: r.ip,
      status: r.status,
      cpu: r.cpu,
      ram: r.ram,
      disk: r.disk,
      ping: r.ping,
      networkIn: r.network_in,
      networkOut: r.network_out,
      uptime: r.uptime,
      lastSeen: r.last_seen,
      probeToken: r.probe_token || `cpm_probe_${r.id}`,
      os: r.os || 'Linux (Edge Node)',
      tags: r.tags ? (typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags) : [],
    }));
  }

  async saveNode(n: any) {
    await this.ensureInitialized();
    this.recordWrite(1);
    const tagsJson = JSON.stringify(n.tags || []);
    await this.db!.prepare(`
      INSERT INTO server_nodes (id, name, region, ip, status, cpu, ram, disk, ping, network_in, network_out, uptime, last_seen, probe_token, os, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        name = excluded.name, 
        region = excluded.region, 
        ip = excluded.ip, 
        status = excluded.status, 
        cpu = excluded.cpu, 
        ram = excluded.ram, 
        disk = excluded.disk, 
        ping = excluded.ping, 
        network_in = excluded.network_in, 
        network_out = excluded.network_out, 
        last_seen = excluded.last_seen,
        probe_token = COALESCE(excluded.probe_token, server_nodes.probe_token),
        os = COALESCE(excluded.os, server_nodes.os),
        tags = COALESCE(excluded.tags, server_nodes.tags)
    `).bind(
      n.id,
      n.name,
      n.region,
      n.ip,
      n.status,
      n.cpu,
      n.ram,
      n.disk,
      n.ping,
      n.networkIn,
      n.networkOut,
      n.uptime,
      n.lastSeen,
      n.probeToken || `cpm_probe_${n.id}`,
      n.os || 'Linux',
      tagsJson
    ).run();
  }

  async deleteNode(id: string) {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare("DELETE FROM server_nodes WHERE id = ?").bind(id).run();
  }

  async getIncidents() {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare("SELECT * FROM incidents ORDER BY started_at DESC").all();
    this.recordRead(results?.length || 1);
    return (results || []).map((r: any) => ({ id: r.id, title: r.title, severity: r.severity, status: r.status, affectedServices: JSON.parse(r.affected_services || '[]'), startedAt: r.started_at, resolvedAt: r.resolved_at || undefined, updates: JSON.parse(r.updates || '[]') }));
  }

  async saveIncident(inc: any) {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare(`
      INSERT INTO incidents (id, title, severity, status, affected_services, started_at, resolved_at, updates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, resolved_at = excluded.resolved_at, updates = excluded.updates
    `).bind(inc.id, inc.title, inc.severity, inc.status, JSON.stringify(inc.affectedServices), inc.startedAt, inc.resolvedAt || null, JSON.stringify(inc.updates)).run();
  }

  async deleteIncident(id: string) {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare("DELETE FROM incidents WHERE id = ?").bind(id).run();
  }

  async getMetricsHistory() {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare("SELECT * FROM metrics_history ORDER BY id ASC LIMIT 200").all();
    this.recordRead(results?.length || 1);
    return (results || []).map((r: any) => ({ 
      timestamp: r.timestamp, 
      avgLatency: r.avg_latency, 
      cpuLoad: r.cpu_load, 
      ramLoad: r.ram_load,
      avgCpu: r.cpu_load,
      avgRam: r.ram_load,
      peakCpu: Math.min(100, Math.round(r.cpu_load * 1.25)),
      peakRam: Math.min(100, Math.round(r.ram_load * 1.15)),
      p95Latency: r.p95_latency 
    }));
  }

  async saveMetricPoint(pt: any) {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare(`
      INSERT INTO metrics_history (timestamp, avg_latency, cpu_load, ram_load, p95_latency)
      VALUES (?, ?, ?, ?, ?)
    `).bind(pt.timestamp, pt.avgLatency, pt.cpuLoad, pt.ramLoad, pt.p95Latency || pt.avgLatency * 1.4).run();
  }

  async getTelegramConfig() {
    await this.ensureInitialized();
    this.recordRead(1);
    const { results } = await this.db!.prepare("SELECT * FROM telegram_config WHERE id = 1").all();
    if (!results || results.length === 0) return { botToken: '', chatId: '', enabled: false, alertOnStatusChange: true, alertOnHighLoad: true, alertOnIncident: true, dailyDigest: false, digestTime: '08:00' };
    const r: any = results[0];
    return { botToken: r.bot_token, chatId: r.chat_id, enabled: !!r.enabled, alertOnStatusChange: !!r.alert_on_status_change, alertOnHighLoad: !!r.alert_on_high_load, alertOnIncident: !!r.alert_on_incident, dailyDigest: !!r.daily_digest, digestTime: r.digest_time };
  }

  async saveTelegramConfig(cfg: any) {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare(`
      INSERT INTO telegram_config (id, bot_token, chat_id, enabled, alert_on_status_change, alert_on_high_load, alert_on_incident, daily_digest, digest_time)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET bot_token = excluded.bot_token, chat_id = excluded.chat_id, enabled = excluded.enabled, alert_on_status_change = excluded.alert_on_status_change, alert_on_high_load = excluded.alert_on_high_load, alert_on_incident = excluded.alert_on_incident, daily_digest = excluded.daily_digest, digest_time = excluded.digest_time
    `).bind(cfg.botToken || '', cfg.chatId || '', cfg.enabled ? 1 : 0, cfg.alertOnStatusChange ? 1 : 0, cfg.alertOnHighLoad ? 1 : 0, cfg.alertOnIncident ? 1 : 0, cfg.dailyDigest ? 1 : 0, cfg.digestTime || '08:00').run();
  }

  async getTelegramLogs() {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare("SELECT * FROM telegram_logs ORDER BY timestamp DESC LIMIT 50").all();
    this.recordRead(results?.length || 1);
    return (results || []).map((r: any) => ({ id: r.id, timestamp: r.timestamp, type: r.type, status: r.status, message: r.message, details: r.details || undefined }));
  }

  async saveTelegramLog(log: any) {
    await this.ensureInitialized();
    this.recordWrite(1);
    try {
      await this.db!.prepare(`
        INSERT INTO telegram_logs (id, timestamp, type, status, message, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(log.id, log.timestamp, log.type, log.status, log.message, log.details || null).run();
    } catch (e) {
      console.error("saveTelegramLog error:", e);
    }
  }

  async getQuotaSettings() {
    await this.ensureInitialized();
    this.recordRead(1);
    const { results } = await this.db!.prepare("SELECT * FROM quota_settings WHERE id = 1").all();
    if (!results || results.length === 0) return { workerDailyRequestLimit: 100000, historyRetentionDays: 30, ecoMode: true, autoPruneExpiredHistory: true, heartbeatIntervalSeconds: 60, clientPollIntervalSeconds: 30, maxStoredMetricPoints: 720 };
    const r: any = results[0];
    return { workerDailyRequestLimit: r.worker_daily_request_limit, historyRetentionDays: r.history_retention_days, ecoMode: !!r.eco_mode, autoPruneExpiredHistory: !!r.auto_prune_expired_history, heartbeatIntervalSeconds: r.heartbeat_interval_seconds, clientPollIntervalSeconds: r.client_poll_interval_seconds, maxStoredMetricPoints: r.max_stored_metric_points };
  }

  async saveQuotaSettings(q: any) {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare(`
      INSERT INTO quota_settings (id, worker_daily_request_limit, history_retention_days, eco_mode, auto_prune_expired_history, heartbeat_interval_seconds, client_poll_interval_seconds, max_stored_metric_points)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET worker_daily_request_limit = excluded.worker_daily_request_limit, history_retention_days = excluded.history_retention_days, eco_mode = excluded.eco_mode, auto_prune_expired_history = excluded.auto_prune_expired_history, heartbeat_interval_seconds = excluded.heartbeat_interval_seconds, client_poll_interval_seconds = excluded.client_poll_interval_seconds, max_stored_metric_points = excluded.max_stored_metric_points
    `).bind(q.workerDailyRequestLimit, q.historyRetentionDays, q.ecoMode ? 1 : 0, q.autoPruneExpiredHistory ? 1 : 0, q.heartbeatIntervalSeconds, q.clientPollIntervalSeconds, q.maxStoredMetricPoints).run();
  }

  async getAdminPassword(): Promise<string> {
    await this.ensureInitialized();
    this.recordRead(1);
    const { results } = await this.db!.prepare("SELECT admin_password FROM admin_settings WHERE id = 1").all();
    if (!results || results.length === 0) return 'admin123';
    return (results[0] as any).admin_password || 'admin123';
  }

  async saveAdminPassword(password: string): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare(`
      INSERT INTO admin_settings (id, admin_password)
      VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET admin_password = excluded.admin_password
    `).bind(password).run();
  }

  async getD1UsageStats(): Promise<CloudflareD1UsageStats> {
    await this.ensureInitialized();
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. Calculate row counts and table counts
    let totalRows = 0;
    let tableCount = 10;
    try {
      const tablesRes = await this.db!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all();
      const tables = tablesRes.results || [];
      if (tables.length > 0) {
        tableCount = tables.length;
        for (const tbl of tables) {
          try {
            const cnt = await this.db!.prepare(`SELECT COUNT(*) as c FROM "${(tbl as any).name}"`).first() as any;
            totalRows += Number(cnt?.c || 0);
          } catch {}
        }
      }
    } catch {}

    // 2. Storage size estimation or via PRAGMA
    let storageBytes = 0;
    try {
      const pageCountRes = await this.db!.prepare("PRAGMA page_count").first() as any;
      const pageSizeRes = await this.db!.prepare("PRAGMA page_size").first() as any;
      const pageCount = Number(pageCountRes?.page_count || 0);
      const pageSize = Number(pageSizeRes?.page_size || 4096);
      if (pageCount > 0) {
        storageBytes = pageCount * pageSize;
      }
    } catch {}

    if (storageBytes === 0) {
      storageBytes = 64 * 1024 + totalRows * 360;
    }

    // 3. Daily read/write tracking persisted in d1_daily_stats
    await this.flushDailyStats();
    let dailyRowsRead = Math.max(this.rowsReadSession, 1);
    let dailyRowsWritten = Math.max(this.rowsWrittenSession, 1);

    try {
      const existing = await this.db!.prepare("SELECT rows_read, rows_written FROM d1_daily_stats WHERE date = ?").bind(today).first() as any;
      if (existing) {
        dailyRowsRead = Number(existing.rows_read || 0) + this.unpersistedReads;
        dailyRowsWritten = Number(existing.rows_written || 0) + this.unpersistedWrites;
      }
    } catch {}

    const readLimit = 5000000; // 5 Million rows read / day (Free Tier)
    const writeLimit = 100000; // 100,000 rows written / day (Free Tier)
    const storageLimitBytes = 5 * 1024 * 1024 * 1024; // 5 GB Free Tier

    return {
      dailyRowsRead,
      readLimit,
      dailyRowsWritten,
      writeLimit,
      storageBytes,
      storageLimitBytes,
      totalTables: tableCount,
      totalRows,
      readUsagePercent: Math.min(100, Math.round((dailyRowsRead / readLimit) * 10000) / 100),
      writeUsagePercent: Math.min(100, Math.round((dailyRowsWritten / writeLimit) * 10000) / 100),
      storageUsagePercent: Math.min(100, Math.round((storageBytes / storageLimitBytes) * 10000) / 100),
    };
  }

  async pruneHistory(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const res = await this.db!.prepare("DELETE FROM metrics_history WHERE timestamp < ?").bind(cutoff).run();
    return res.meta?.changes || 0;
  }
}
