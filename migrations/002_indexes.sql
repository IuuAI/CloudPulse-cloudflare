CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_server_nodes_status ON server_nodes(status);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_timestamp ON telegram_logs(timestamp);
