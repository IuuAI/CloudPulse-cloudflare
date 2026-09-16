-- Migration 0003: Node Status History & Availability Events
CREATE TABLE IF NOT EXISTS node_status_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_node_status_events_node_time ON node_status_events(node_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_node_status_events_timestamp ON node_status_events(timestamp DESC);
