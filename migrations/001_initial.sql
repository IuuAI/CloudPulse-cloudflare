CREATE TABLE IF NOT EXISTS system_overview (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  uptime REAL NOT NULL,
  total_nodes INTEGER NOT NULL,
  healthy_nodes INTEGER NOT NULL,
  active_incidents INTEGER NOT NULL,
  avg_latency INTEGER NOT NULL,
  last_checked TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  latency INTEGER NOT NULL,
  uptime REAL NOT NULL,
  last_check TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS server_nodes (
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
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  affected_services TEXT NOT NULL,
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  updates TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  avg_latency INTEGER NOT NULL,
  cpu_load INTEGER NOT NULL,
  ram_load INTEGER NOT NULL,
  p95_latency INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bot_token TEXT,
  chat_id TEXT,
  enabled INTEGER NOT NULL,
  alert_on_status_change INTEGER NOT NULL,
  alert_on_high_load INTEGER NOT NULL,
  alert_on_incident INTEGER NOT NULL,
  daily_digest INTEGER NOT NULL,
  digest_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT
);

CREATE TABLE IF NOT EXISTS quota_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  worker_daily_request_limit INTEGER NOT NULL,
  history_retention_days INTEGER NOT NULL,
  eco_mode INTEGER NOT NULL,
  auto_prune_expired_history INTEGER NOT NULL,
  heartbeat_interval_seconds INTEGER NOT NULL,
  client_poll_interval_seconds INTEGER NOT NULL,
  max_stored_metric_points INTEGER NOT NULL
);
