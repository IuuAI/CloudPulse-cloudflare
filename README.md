# CloudPulse Edge Monitor (`cloudpulse-cloudflare-api`)

CloudPulse is a high-performance, edge-native infrastructure monitoring and incident management system designed for **Cloudflare Workers**, **Cloudflare D1**, and **Workers KV**.

---

## 🏗️ Architecture

CloudPulse follows a serverless edge architecture:
1. **Edge Router (`worker/index.ts` & `src/core/router.ts`)**: Powered by [Hono](https://hono.dev/), running natively on Cloudflare Workers with Node.js compatibility (`nodejs_compat`).
2. **Persistent Storage (Cloudflare D1 SQLite)**: Stores server nodes, microservice statuses, historical telemetry metrics, incidents, Telegram alert configurations, and daily usage statistics.
3. **Caching Layer (Workers KV)**: High-speed caching for rate limiting, system health flags, and ephemeral states.
4. **Static Assets & SPA Frontend**: Built with React 18, Vite, Tailwind CSS, and Recharts, served via Cloudflare Workers Static Assets binding.
5. **Cron Triggers**: Automated worker triggers configured to execute background health-checks and probes every **30 minutes** (`*/30 * * * *`).

---

## 🛠️ Tech Stack

- **Edge Runtime**: Cloudflare Workers (V8 Isolate)
- **Framework**: Hono v4
- **Database**: Cloudflare D1 (Serverless SQLite)
- **Key-Value Store**: Cloudflare KV
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Security**: JWT (HS256) authentication, Bearer tokens, strict token sanitization, and Cloudflare Secret environment variables (`ADMIN_PASSWORD`).

---

## 🚀 Deployment & Configuration Guide

### Prerequisites
- Node.js 18+ installed locally
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) authenticated (`wrangler login`)

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure `wrangler.toml`
Ensure your `wrangler.toml` has the correct bindings:
```toml
name = "cloudpulse-cloudflare-api"
main = "worker/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

assets = { directory = "./dist" }

[[d1_databases]]
binding = "DB"
database_name = "cloudpulse-d1"
database_id = "YOUR_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_KV_NAMESPACE_ID"

[triggers]
crons = ["*/30 * * * *"]
```

### 3. Initialize D1 Database Schema
Apply the initial SQL migration to your D1 database:
```bash
wrangler d1 execute cloudpulse-cloudflare-api --file=migrations/001_initial.sql
```

### 4. Set Admin Password Secret
CloudPulse discards default passwords and hardcoded credentials. You **must** configure your admin password securely via Cloudflare Secrets:
```bash
wrangler secret put ADMIN_PASSWORD
```
*(Enter your secure password when prompted)*

### 5. Build and Deploy
```bash
npm run build
wrangler deploy
```

---

## 🤖 Node Probe Agent Setup

To monitor remote VPS or edge nodes:
1. Open the Admin Dashboard under **Server Nodes**.
2. Click **One-Click Probe Install Script** for the target node.
3. Run the generated bash command on your target server:
   ```bash
   curl -sSL "https://your-worker.workers.dev/api/probe/script?token=YOUR_NODE_PROBE_TOKEN" | sudo bash
   ```
4. The probe agent securely reports CPU, RAM, Disk, and Ping telemetry back to CloudPulse via authenticated POST requests to `/api/probe/report`.
