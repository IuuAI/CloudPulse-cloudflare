-- Migration 0004: Remove bot_token from D1 telegram_config
-- In adherence to production security standards, Telegram bot secrets must reside exclusively in Cloudflare Secrets (TELEGRAM_BOT_TOKEN) rather than SQL backups/tables.
-- SQLite does not support DROP COLUMN in older versions without table rebuild, so we recreate telegram_config without bot_token.

CREATE TABLE IF NOT EXISTS telegram_config_new (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  chat_id TEXT,
  enabled INTEGER NOT NULL,
  alert_on_status_change INTEGER NOT NULL,
  alert_on_high_load INTEGER NOT NULL,
  alert_on_incident INTEGER NOT NULL,
  daily_digest INTEGER NOT NULL,
  digest_time TEXT NOT NULL
);

INSERT OR IGNORE INTO telegram_config_new (id, chat_id, enabled, alert_on_status_change, alert_on_high_load, alert_on_incident, daily_digest, digest_time)
SELECT id, chat_id, enabled, alert_on_status_change, alert_on_high_load, alert_on_incident, daily_digest, digest_time
FROM telegram_config WHERE id = 1;

DROP TABLE IF EXISTS telegram_config;

ALTER TABLE telegram_config_new RENAME TO telegram_config;
