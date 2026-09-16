-- Seed Data for Development / Demo Environments
INSERT OR IGNORE INTO system_overview (id, uptime, total_nodes, healthy_nodes, active_incidents, avg_latency, last_checked)
VALUES (1, 99.98, 6, 6, 0, 32, datetime('now'));

INSERT OR IGNORE INTO services (id, name, category, status, latency, uptime, last_check, description) VALUES
('gateway', 'Global API Gateway', 'Core', 'operational', 28, 99.99, datetime('now'), 'Cloudflare Anycast 边缘路由网关与反向代理'),
('auth', 'OAuth2 / IAM Service', 'Auth', 'operational', 45, 99.95, datetime('now'), '鉴权中心与管理员令牌验证服务'),
('db-cluster', 'Distributed SQL Primary', 'Database', 'operational', 15, 99.99, datetime('now'), '高可用持久化存储引擎 (SQLite / Cloudflare D1)'),
('storage', 'Object Storage (S3 / R2)', 'Storage', 'operational', 38, 99.90, datetime('now'), '数据备份存档与静态多媒体资源桶'),
('ai-engine', 'Gemini AI Inference Proxy', 'AI', 'operational', 120, 99.85, datetime('now'), '智能监控事件聚合与故障自动化分析代理');

INSERT OR IGNORE INTO server_nodes (id, name, region, ip, status, cpu, ram, disk, ping, network_in, network_out, uptime, last_seen, probe_token, probe_token_hash, os, tags) VALUES
('n1', 'Edge-Tokyo-01', 'Asia (Tokyo)', '***.***.***.***', 'online', 24, 48, 35, 18, '1.2 TB', '4.5 TB', 99.99, datetime('now'), 'tok-tokyo-01', '4126bb62e92c4749f7e532b21aa6c464ef69d4e5f7f98502f92f254b3d735070', 'Ubuntu 24.04 LTS (x86_64)', '["Asia", "Edge", "Gateway"]'),
('n2', 'Edge-Frankfurt-01', 'Europe (Germany)', '***.***.***.***', 'online', 31, 55, 42, 29, '2.8 TB', '9.1 TB', 99.95, datetime('now'), 'tok-fra-01', '1f5e27a94d0c9a62aa87d65fc97ecdf3351ec8a48b594b150fe1844b26fe78dc', 'Debian 12 Bookworm', '["Europe", "Core", "Cluster"]'),
('n3', 'Edge-SanJose-01', 'US West (California)', '***.***.***.***', 'online', 45, 62, 58, 41, '4.1 TB', '12.4 TB', 99.92, datetime('now'), 'tok-sjc-01', 'b4f8d55c7075c2e9a263d91cf97cf8e11a6ef5a882cb12d93eefae9b3806fca4', 'Alpine Linux 3.20', '["US-West", "Edge"]'),
('n4', 'Edge-Singapore-01', 'Asia (Singapore)', '***.***.***.***', 'online', 29, 50, 39, 22, '1.9 TB', '6.0 TB', 99.98, datetime('now'), 'tok-sin-01', '1ca8e4a77cecf709f6e4d4aa1525048db49b10ee7aafe6cf6e154f85e4922eb4', 'Ubuntu 24.04 LTS', '["Asia-SE", "Edge"]'),
('n5', 'Edge-SãoPaulo-01', 'South America (Brazil)', '***.***.***.***', 'online', 48, 64, 52, 85, '850 GB', '2.1 TB', 99.80, datetime('now'), 'tok-sao-01', 'e2bf4e59f4f494dcfe6264f3fb0477174668b556942004245fcfead7baefc45d', 'Debian 12', '["SA", "Edge"]'),
('n6', 'Edge-Sydney-01', 'Oceania (Australia)', '***.***.***.***', 'online', 35, 52, 44, 52, '1.1 TB', '3.8 TB', 99.94, datetime('now'), 'tok-syd-01', '7ee7ef2fc42da0db7c82aee65814bfb9f67a296d8e2023ec5f470559f5b610c3', 'Ubuntu 22.04 LTS', '["Oceania", "Edge"]');

INSERT OR IGNORE INTO telegram_config (id, bot_token, chat_id, enabled, alert_on_status_change, alert_on_high_load, alert_on_incident, daily_digest, digest_time)
VALUES (1, '', '', 0, 1, 1, 1, 0, '08:00');

INSERT OR IGNORE INTO quota_settings (id, worker_daily_request_limit, history_retention_days, eco_mode, auto_prune_expired_history, heartbeat_interval_seconds, client_poll_interval_seconds, max_stored_metric_points)
VALUES (1, 100000, 30, 1, 1, 60, 30, 720);
