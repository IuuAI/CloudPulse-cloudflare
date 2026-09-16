-- Migration 0002: Indices & Performance Optimization
CREATE UNIQUE INDEX IF NOT EXISTS idx_server_nodes_probe_token_hash ON server_nodes(probe_token_hash);
CREATE INDEX IF NOT EXISTS idx_server_nodes_probe_token ON server_nodes(probe_token);
CREATE INDEX IF NOT EXISTS idx_server_nodes_status ON server_nodes(status);
CREATE INDEX IF NOT EXISTS idx_server_nodes_last_seen ON server_nodes(last_seen);

CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_timestamp ON telegram_logs(timestamp DESC);
