/// <reference types="@cloudflare/workers-types" />
import {
  StorageAdapter,
  CloudflareD1UsageStats,
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

async function computeSha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
      throw new Error(
        "Cloudflare D1 database binding 'DB' is not configured. Please bind your D1 database with variable name 'DB' in Cloudflare Pages / Workers settings or wrangler.toml."
      );
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
      await this.db
        .prepare(
          `
        INSERT INTO d1_daily_stats (date, rows_read, rows_written, last_updated)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          rows_read = d1_daily_stats.rows_read + excluded.rows_read,
          rows_written = d1_daily_stats.rows_written + excluded.rows_written,
          last_updated = excluded.last_updated
      `
        )
        .bind(today, readsToFlush, writesToFlush, new Date().toISOString())
        .run();
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
          probe_token_hash TEXT,
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
        `CREATE TABLE IF NOT EXISTS node_status_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          node_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          status TEXT NOT NULL,
          reason TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS telegram_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
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
        `CREATE TABLE IF NOT EXISTS d1_daily_stats (
          date TEXT PRIMARY KEY,
          rows_read INTEGER NOT NULL DEFAULT 0,
          rows_written INTEGER NOT NULL DEFAULT 0,
          last_updated TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS admin_auth (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
      ];

      await this.db!.batch(tableStatements.map((sql) => this.db!.prepare(sql)));

      // Indexes creation
      const indexStatements = [
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_server_nodes_probe_token_hash ON server_nodes(probe_token_hash)`,
        `CREATE INDEX IF NOT EXISTS idx_server_nodes_probe_token ON server_nodes(probe_token)`,
        `CREATE INDEX IF NOT EXISTS idx_server_nodes_status ON server_nodes(status)`,
        `CREATE INDEX IF NOT EXISTS idx_server_nodes_last_seen ON server_nodes(last_seen)`,
        `CREATE INDEX IF NOT EXISTS idx_services_status ON services(status)`,
        `CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)`,
        `CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents(started_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_history(timestamp DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_node_status_events_node_time ON node_status_events(node_id, timestamp DESC)`,
      ];
      await this.db!.batch(indexStatements.map((sql) => this.db!.prepare(sql)));

      // Initialize default single-row configurations if not present (system metadata only, zero fake demo data)
      const ovCheck = (await this.db!.prepare('SELECT COUNT(*) as cnt FROM system_overview').first()) as any;
      if (!ovCheck || ovCheck.cnt === 0) {
        await this.db!.prepare(`
          INSERT OR IGNORE INTO system_overview (id, uptime, total_nodes, healthy_nodes, active_incidents, avg_latency, last_checked)
          VALUES (1, 100.0, 0, 0, 0, 0, ?)
        `).bind(new Date().toISOString()).run();

        await this.db!.prepare(`
          INSERT OR IGNORE INTO telegram_config (id, chat_id, enabled, alert_on_status_change, alert_on_high_load, alert_on_incident, daily_digest, digest_time)
          VALUES (1, '', 0, 1, 1, 1, 0, '08:00')
        `).run();

        await this.db!.prepare(`
          INSERT OR IGNORE INTO quota_settings (id, worker_daily_request_limit, history_retention_days, eco_mode, auto_prune_expired_history, heartbeat_interval_seconds, client_poll_interval_seconds, max_stored_metric_points)
          VALUES (1, 100000, 30, 1, 1, 60, 30, 720)
        `).run();
      }

      this.initialized = true;
    } catch (e: any) {
      console.error('D1 Init Schema Error:', e);
      throw e;
    }
  }

  async getOverview(): Promise<OverviewStats> {
    await this.ensureInitialized();
    this.recordRead(1);
    const { results } = await this.db!.prepare('SELECT * FROM system_overview WHERE id = 1').all();
    if (!results || results.length === 0) {
      return {
        uptime: 100.0,
        totalNodes: 0,
        healthyNodes: 0,
        activeIncidents: 0,
        avgLatency: 0,
        lastChecked: new Date().toISOString(),
      };
    }
    const r = results[0] as any;
    return {
      uptime: r.uptime,
      totalNodes: r.total_nodes,
      healthyNodes: r.healthy_nodes,
      activeIncidents: r.active_incidents,
      avgLatency: r.avg_latency,
      lastChecked: r.last_checked,
    };
  }

  async saveOverview(ov: OverviewStats): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare(
      `
      INSERT INTO system_overview (id, uptime, total_nodes, healthy_nodes, active_incidents, avg_latency, last_checked)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        uptime = excluded.uptime, 
        total_nodes = excluded.total_nodes, 
        healthy_nodes = excluded.healthy_nodes, 
        active_incidents = excluded.active_incidents, 
        avg_latency = excluded.avg_latency, 
        last_checked = excluded.last_checked
    `
    )
      .bind(ov.uptime, ov.totalNodes, ov.healthyNodes, ov.activeIncidents, ov.avgLatency, ov.lastChecked)
      .run();
  }

  async getServices(): Promise<ServiceItem[]> {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare('SELECT * FROM services').all();
    this.recordRead(results?.length || 1);
    return (results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      status: r.status,
      latency: r.latency,
      uptime: r.uptime,
      uptime30d: r.uptime,
      lastCheck: r.last_check,
      url: r.url || '',
      description: r.description || '',
    }));
  }

  async saveService(s: ServiceItem): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare(
      `
      INSERT INTO services (id, name, category, status, latency, uptime, last_check, url, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        name = excluded.name, 
        category = excluded.category, 
        status = excluded.status, 
        latency = excluded.latency, 
        uptime = excluded.uptime, 
        last_check = excluded.last_check,
        url = COALESCE(excluded.url, services.url),
        description = COALESCE(excluded.description, services.description)
    `
    )
      .bind(
        s.id,
        s.name,
        s.category,
        s.status,
        s.latency,
        s.uptime ?? 99.9,
        s.lastCheck || new Date().toISOString(),
        s.url || null,
        s.description || null
      )
      .run();
  }

  async saveServices(services: ServiceItem[]): Promise<void> {
    if (!services || services.length === 0) return;
    await this.ensureInitialized();
    this.recordWrite(services.length);

    const statements = services.map((s) =>
      this.db!.prepare(
        `
        INSERT INTO services (id, name, category, status, latency, uptime, last_check, url, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          name = excluded.name, 
          category = excluded.category, 
          status = excluded.status, 
          latency = excluded.latency, 
          uptime = excluded.uptime, 
          last_check = excluded.last_check,
          url = COALESCE(excluded.url, services.url),
          description = COALESCE(excluded.description, services.description)
      `
      ).bind(
        s.id,
        s.name,
        s.category,
        s.status,
        s.latency,
        s.uptime ?? 99.9,
        s.lastCheck || new Date().toISOString(),
        s.url || null,
        s.description || null
      )
    );

    await this.db!.batch(statements);
  }

  async deleteService(id: string): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare('DELETE FROM services WHERE id = ?').bind(id).run();
  }

  async getNodes(): Promise<ServerNode[]> {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare('SELECT * FROM server_nodes').all();
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
      lastHeartbeat: r.last_seen || new Date().toISOString(),
      probeInstalled: true,
      probeToken: r.probe_token || `cpm_probe_${r.id}`,
      probeTokenHash: r.probe_token_hash,
      os: r.os || 'Linux (Edge Node)',
      tags: r.tags ? (typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags) : [],
    }));
  }

  async getNodeByProbeTokenHash(tokenHash: string): Promise<ServerNode | null> {
    await this.ensureInitialized();
    this.recordRead(1);
    const result = await this.db!
      .prepare('SELECT * FROM server_nodes WHERE probe_token_hash = ? OR probe_token = ? LIMIT 1')
      .bind(tokenHash, tokenHash)
      .first();
    if (!result) return null;
    const r = result as any;
    return {
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
      lastHeartbeat: r.last_seen || new Date().toISOString(),
      probeInstalled: true,
      probeToken: r.probe_token,
      probeTokenHash: r.probe_token_hash,
      os: r.os || 'Linux (Edge Node)',
      tags: r.tags ? (typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags) : [],
    };
  }

  async saveNode(n: ServerNode): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    const tagsJson = JSON.stringify(n.tags || []);
    const rawToken = n.probeToken || `cpm_probe_${n.id}`;
    const tokenHash = n.probeTokenHash || (rawToken ? await computeSha256(rawToken) : null);

    await this.db!
      .prepare(
        `
      INSERT INTO server_nodes (id, name, region, ip, status, cpu, ram, disk, ping, network_in, network_out, uptime, last_seen, probe_token, probe_token_hash, os, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        probe_token_hash = COALESCE(excluded.probe_token_hash, server_nodes.probe_token_hash),
        os = COALESCE(excluded.os, server_nodes.os),
        tags = COALESCE(excluded.tags, server_nodes.tags)
    `
      )
      .bind(
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
        rawToken,
        tokenHash,
        n.os || 'Linux',
        tagsJson
      )
      .run();
  }

  async saveNodes(nodes: ServerNode[]): Promise<void> {
    if (!nodes || nodes.length === 0) return;
    await this.ensureInitialized();
    this.recordWrite(nodes.length);

    const statements = await Promise.all(
      nodes.map(async (n) => {
        const tagsJson = JSON.stringify(n.tags || []);
        const rawToken = n.probeToken || `cpm_probe_${n.id}`;
        const tokenHash = n.probeTokenHash || (rawToken ? await computeSha256(rawToken) : null);

        return this.db!.prepare(
          `
          INSERT INTO server_nodes (id, name, region, ip, status, cpu, ram, disk, ping, network_in, network_out, uptime, last_seen, probe_token, probe_token_hash, os, tags)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            probe_token_hash = COALESCE(excluded.probe_token_hash, server_nodes.probe_token_hash),
            os = COALESCE(excluded.os, server_nodes.os),
            tags = COALESCE(excluded.tags, server_nodes.tags)
        `
        ).bind(
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
          rawToken,
          tokenHash,
          n.os || 'Linux',
          tagsJson
        );
      })
    );

    await this.db!.batch(statements);
  }

  async deleteNode(id: string): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare('DELETE FROM server_nodes WHERE id = ?').bind(id).run();
  }

  async recordNodeStatusEvent(event: NodeStatusEvent): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!
      .prepare(
        `
      INSERT INTO node_status_events (node_id, timestamp, status, reason)
      VALUES (?, ?, ?, ?)
    `
      )
      .bind(event.nodeId, event.timestamp, event.status, event.reason || null)
      .run();
  }

  async getNodeStatusEvents(nodeId?: string, limit: number = 100): Promise<NodeStatusEvent[]> {
    await this.ensureInitialized();
    let query = 'SELECT * FROM node_status_events';
    let bindings: any[] = [];
    if (nodeId) {
      query += ' WHERE node_id = ?';
      bindings.push(nodeId);
    }
    query += ' ORDER BY timestamp DESC LIMIT ?';
    bindings.push(limit);

    const { results } = await this.db!.prepare(query).bind(...bindings).all();
    this.recordRead(results?.length || 1);
    return (results || []).map((r: any) => ({
      id: r.id,
      nodeId: r.node_id,
      timestamp: r.timestamp,
      status: r.status,
      reason: r.reason || undefined,
    }));
  }

  async getIncidents(): Promise<IncidentItem[]> {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare('SELECT * FROM incidents ORDER BY started_at DESC').all();
    this.recordRead(results?.length || 1);
    return (results || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      severity: r.severity,
      status: r.status,
      affectedServices: JSON.parse(r.affected_services || '[]'),
      startedAt: r.started_at,
      resolvedAt: r.resolved_at || undefined,
      updates: JSON.parse(r.updates || '[]'),
    }));
  }

  async saveIncident(inc: IncidentItem): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!
      .prepare(
        `
      INSERT INTO incidents (id, title, severity, status, affected_services, started_at, resolved_at, updates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, resolved_at = excluded.resolved_at, updates = excluded.updates
    `
      )
      .bind(
        inc.id,
        inc.title,
        inc.severity,
        inc.status,
        JSON.stringify(inc.affectedServices),
        inc.startedAt,
        inc.resolvedAt || null,
        JSON.stringify(inc.updates)
      )
      .run();
  }

  async deleteIncident(id: string): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!.prepare('DELETE FROM incidents WHERE id = ?').bind(id).run();
  }

  async getMetricsHistory(): Promise<MetricHistoryPoint[]> {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare('SELECT * FROM metrics_history ORDER BY id DESC LIMIT 200').all();
    this.recordRead(results?.length || 1);
    const points: MetricHistoryPoint[] = (results || []).map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      latency: r.avg_latency,
      cpu: r.cpu_load,
      ram: r.ram_load,
      p95Latency: r.p95_latency,
    }));
    return points.reverse();
  }

  async saveMetricPoint(pt: MetricHistoryPoint): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!
      .prepare(
        `
      INSERT INTO metrics_history (timestamp, avg_latency, cpu_load, ram_load, p95_latency)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .bind(pt.timestamp, pt.latency, pt.cpu, pt.ram, pt.latency * 1.4)
      .run();
  }

  async getTelegramConfig(): Promise<TelegramConfig> {
    await this.ensureInitialized();
    this.recordRead(1);
    const { results } = await this.db!.prepare('SELECT * FROM telegram_config WHERE id = 1').all();
    if (!results || results.length === 0) {
      return {
        botToken: '',
        chatId: '',
        enabled: false,
        alertOnStatusChange: true,
        alertOnHighLoad: true,
        alertOnIncident: true,
        dailyDigest: false,
        digestTime: '08:00',
      };
    }
    const r = results[0] as any;
    return {
      botToken: '', // Token is strictly resolved via Cloudflare Secrets/Env, never from D1
      chatId: r.chat_id || '',
      enabled: Boolean(r.enabled),
      alertOnStatusChange: Boolean(r.alert_on_status_change),
      alertOnHighLoad: Boolean(r.alert_on_high_load),
      alertOnIncident: Boolean(r.alert_on_incident),
      dailyDigest: Boolean(r.daily_digest),
      digestTime: r.digest_time || '08:00',
    };
  }

  async saveTelegramConfig(cfg: TelegramConfig): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!
      .prepare(
        `
      INSERT INTO telegram_config (id, chat_id, enabled, alert_on_status_change, alert_on_high_load, alert_on_incident, daily_digest, digest_time)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        chat_id = excluded.chat_id, 
        enabled = excluded.enabled, 
        alert_on_status_change = excluded.alert_on_status_change, 
        alert_on_high_load = excluded.alert_on_high_load, 
        alert_on_incident = excluded.alert_on_incident, 
        daily_digest = excluded.daily_digest, 
        digest_time = excluded.digest_time
    `
      )
      .bind(
        cfg.chatId || '',
        cfg.enabled ? 1 : 0,
        cfg.alertOnStatusChange ? 1 : 0,
        cfg.alertOnHighLoad ? 1 : 0,
        cfg.alertOnIncident ? 1 : 0,
        cfg.dailyDigest ? 1 : 0,
        cfg.digestTime || '08:00'
      )
      .run();
  }

  async getTelegramLogs(): Promise<TelegramLog[]> {
    await this.ensureInitialized();
    const { results } = await this.db!.prepare('SELECT * FROM telegram_logs ORDER BY timestamp DESC LIMIT 50').all();
    this.recordRead(results?.length || 1);
    return (results || []).map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      status: r.status,
      message: r.message,
      details: r.details || undefined,
    }));
  }

  async saveTelegramLog(log: TelegramLog): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    try {
      await this.db!
        .prepare(
          `
        INSERT INTO telegram_logs (id, timestamp, type, status, message, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .bind(log.id, log.timestamp, log.type, log.status, log.message, log.details || null)
        .run();
    } catch (e) {
      console.error('saveTelegramLog error:', e);
    }
  }

  async getQuotaSettings(): Promise<QuotaSettings> {
    await this.ensureInitialized();
    this.recordRead(1);
    const { results } = await this.db!.prepare('SELECT * FROM quota_settings WHERE id = 1').all();
    if (!results || results.length === 0) {
      return {
        d1ReadLimitDaily: 5000000,
        d1WriteLimitDaily: 100000,
        kvReadLimitDaily: 100000,
        kvWriteLimitDaily: 1000,
        historyRetentionDays: 30,
        checkIntervalMinutes: 5,
        autoPruneEnabled: true,
      };
    }
    const r = results[0] as any;
    return {
      d1ReadLimitDaily: 5000000,
      d1WriteLimitDaily: 100000,
      kvReadLimitDaily: 100000,
      kvWriteLimitDaily: 1000,
      historyRetentionDays: r.history_retention_days || 30,
      checkIntervalMinutes: r.heartbeat_interval_seconds ? Math.round(r.heartbeat_interval_seconds / 60) : 5,
      autoPruneEnabled: Boolean(r.auto_prune_expired_history),
    };
  }

  async saveQuotaSettings(q: QuotaSettings): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!
      .prepare(
        `
      INSERT INTO quota_settings (id, worker_daily_request_limit, history_retention_days, eco_mode, auto_prune_expired_history, heartbeat_interval_seconds, client_poll_interval_seconds, max_stored_metric_points)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        history_retention_days = excluded.history_retention_days, 
        auto_prune_expired_history = excluded.auto_prune_expired_history, 
        heartbeat_interval_seconds = excluded.heartbeat_interval_seconds
    `
      )
      .bind(
        100000,
        q.historyRetentionDays || 30,
        1,
        q.autoPruneEnabled ? 1 : 0,
        (q.checkIntervalMinutes || 5) * 60,
        30,
        720
      )
      .run();
  }

  async getAdminAuth(): Promise<AdminAuthRecord | null> {
    await this.ensureInitialized();
    this.recordRead(1);
    try {
      const { results } = await this.db!.prepare('SELECT * FROM admin_auth WHERE id = 1').all();
      if (!results || results.length === 0) return null;
      const r = results[0] as any;
      return {
        passwordHash: r.password_hash,
        salt: r.salt,
        updatedAt: r.updated_at,
      };
    } catch {
      return null;
    }
  }

  async saveAdminAuth(auth: AdminAuthRecord): Promise<void> {
    await this.ensureInitialized();
    this.recordWrite(1);
    await this.db!
      .prepare(
        `
      INSERT INTO admin_auth (id, password_hash, salt, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        password_hash = excluded.password_hash,
        salt = excluded.salt,
        updated_at = excluded.updated_at
    `
      )
      .bind(auth.passwordHash, auth.salt, auth.updatedAt)
      .run();
  }

  async getD1UsageStats(): Promise<CloudflareD1UsageStats> {
    await this.ensureInitialized();
    const today = new Date().toISOString().slice(0, 10);

    let totalRows = 0;
    let tableCount = 10;
    try {
      const tablesRes = await this.db!
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")
        .all();
      const tables = tablesRes.results || [];
      if (tables.length > 0) {
        tableCount = tables.length;
        for (const tbl of tables) {
          try {
            const cnt = (await this.db!.prepare(`SELECT COUNT(*) as c FROM "${(tbl as any).name}"`).first()) as any;
            totalRows += Number(cnt?.c || 0);
          } catch {}
        }
      }
    } catch {}

    let storageBytes = 0;
    try {
      const pageCountRes = (await this.db!.prepare('PRAGMA page_count').first()) as any;
      const pageSizeRes = (await this.db!.prepare('PRAGMA page_size').first()) as any;
      const pageCount = Number(pageCountRes?.page_count || 0);
      const pageSize = Number(pageSizeRes?.page_size || 4096);
      if (pageCount > 0) {
        storageBytes = pageCount * pageSize;
      }
    } catch {}

    if (storageBytes === 0) {
      storageBytes = 64 * 1024 + totalRows * 360;
    }

    await this.flushDailyStats();
    let dailyRowsRead = Math.max(this.rowsReadSession, 1);
    let dailyRowsWritten = Math.max(this.rowsWrittenSession, 1);

    try {
      const existing = (await this.db!
        .prepare('SELECT rows_read, rows_written FROM d1_daily_stats WHERE date = ?')
        .bind(today)
        .first()) as any;
      if (existing) {
        dailyRowsRead = Number(existing.rows_read || 0) + this.unpersistedReads;
        dailyRowsWritten = Number(existing.rows_written || 0) + this.unpersistedWrites;
      }
    } catch {}

    const readLimit = 5000000;
    const writeLimit = 100000;
    const storageLimitBytes = 5 * 1024 * 1024 * 1024;

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
    await this.ensureInitialized();
    try {
      await this.db!.prepare("DELETE FROM metrics_history WHERE timestamp NOT LIKE '____-__-__%'").run();
    } catch (e) {
      console.warn('Failed to prune legacy non-ISO metrics:', e);
    }
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const res = await this.db!.prepare('DELETE FROM metrics_history WHERE timestamp < ?').bind(cutoff).run();
    return res.meta?.changes || 0;
  }
}
