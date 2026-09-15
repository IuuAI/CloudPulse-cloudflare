/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { CloudflareD1Adapter } from '../src/adapters/storage/CloudflareD1Adapter';
import { CloudflareKVAdapter } from '../src/adapters/cache/CloudflareKVAdapter';
import { MemoryStorageAdapter } from '../src/adapters/storage/MemoryStorageAdapter';
import { MemoryCacheAdapter } from '../src/adapters/cache/MemoryCacheAdapter';
import { createApiRouter } from '../src/core/router';
import { runMonitorCycle } from '../src/core/monitor';
import { StorageAdapter, CacheAdapter } from '../src/core/types';

export type Bindings = {
  DB?: D1Database;
  CACHE?: KVNamespace;
  ADMIN_PASSWORD?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  ASSETS?: Fetcher;
};

// ============================================================================
// Global Singleton Cache across requests within the Cloudflare Worker Isolate
// ============================================================================
// Caches raw D1 database and KV namespace bindings passed from Cloudflare environment
let cachedD1Binding: D1Database | null = null;
let cachedKVBinding: KVNamespace | null = null;

// Caches initialized adapter instances and Hono application router
let cachedStorage: StorageAdapter | null = null;
let cachedCache: CacheAdapter | null = null;
let cachedApp: Hono | null = null;

// Connection pool & schema DDL initialization tracking
let isDbInitialized = false;
let dbInitializationPromise: Promise<void> | null = null;
let poolInitializedAt: string | null = null;

// In-memory fallback adapters for local testing / unconfigured environments
const memoryStorage = new MemoryStorageAdapter();
const memoryCache = new MemoryCacheAdapter();

/**
 * Singleton factory for D1 and KV bindings, storage/cache adapters, and router instances.
 * Guarantees one-time D1 connection pool and schema initialization on Worker startup / cold-start,
 * preventing SQLite locked / busy errors or configuration loss from repeated per-request bindings.
 */
async function getOrInitWorkerContext(env: Bindings): Promise<{
  storage: StorageAdapter;
  cache: CacheAdapter;
  app: Hono;
}> {
  // 1. Cache raw D1 binding instance if available
  if (env.DB && !cachedD1Binding) {
    cachedD1Binding = env.DB;
  }

  // 2. Cache raw KV namespace binding instance if available
  if (env.CACHE && !cachedKVBinding) {
    cachedKVBinding = env.CACHE;
  }

  // 3. Initialize or retrieve cached Storage Adapter using cached D1 binding
  if (!cachedStorage) {
    const activeD1 = cachedD1Binding || env.DB;
    if (activeD1) {
      cachedStorage = new CloudflareD1Adapter(activeD1);
    } else {
      cachedStorage = memoryStorage;
    }
  }

  // 4. Initialize or retrieve cached KV Cache Adapter using cached KV binding
  if (!cachedCache) {
    const activeKV = cachedKVBinding || env.CACHE;
    if (activeKV) {
      cachedCache = new CloudflareKVAdapter(activeKV);
    } else {
      cachedCache = memoryCache;
    }
  }

  // 5. Initialize or retrieve cached Hono Application Router
  if (!cachedApp) {
    cachedApp = createApiRouter(cachedStorage, cachedCache);
  }

  // 6. One-time D1 database schema and connection pool initialization with concurrency lock
  if (cachedStorage instanceof CloudflareD1Adapter && !isDbInitialized) {
    if (!dbInitializationPromise) {
      dbInitializationPromise = (async () => {
        try {
          await (cachedStorage as CloudflareD1Adapter).initialize();
          isDbInitialized = true;
          poolInitializedAt = new Date().toISOString();
          console.log('[Cloudflare Worker] D1 single connection pool and schema successfully initialized at:', poolInitializedAt);
        } catch (err) {
          console.error('[Cloudflare Worker Cold-Start] D1 connection pool initialization warning:', err);
          dbInitializationPromise = null; // Allow retry on subsequent request if transient
        }
      })();
    }
    try {
      await dbInitializationPromise;
    } catch (e) {
      console.warn('[Cloudflare Worker] D1 initialization deferred:', e);
    }
  }

  return {
    storage: cachedStorage,
    cache: cachedCache,
    app: cachedApp,
  };
}

export default {
  fetch: async (request: Request, env: Bindings, ctx: ExecutionContext) => {
    const url = new URL(request.url);

    // 1. Serve frontend SPA assets when not an /api route and ASSETS binding is present
    if (!url.pathname.startsWith('/api') && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // 2. Direct optimized handling for /api/probe/report with strict probeToken authentication & DB logging
    if (url.pathname === '/api/probe/report' && request.method === 'POST') {
      try {
        const { storage } = await getOrInitWorkerContext(env);
        const body: any = await request.json().catch(() => ({}));
        console.log('[Worker Probe Ingest] Received Payload:', JSON.stringify(body, null, 2));

        const { token, cpu, ram, disk, ping, networkIn, networkOut } = body;
        if (!token || typeof token !== 'string' || token.trim().length === 0) {
          console.warn('[Worker Probe Ingest] Rejected: Missing or empty probe token in payload:', body);
          return new Response(JSON.stringify({ error: 'Missing or invalid probe token' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
          });
        }

        const trimmedToken = token.trim();
        const nodes = await storage.getNodes();

        // Strict authentication: ONLY match n.probeToken === trimmedToken, strictly removing any || n.id === token bypass
        const node = nodes.find((n: any) => n.probeToken && n.probeToken === trimmedToken);

        if (!node) {
          console.warn('[Worker Probe Ingest] Rejected: No node found with probeToken:', trimmedToken);
          return new Response(JSON.stringify({ error: 'Invalid probe token or node not found' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
          });
        }

        if (typeof cpu === 'number') node.cpu = Math.max(0, Math.min(100, Math.round(cpu)));
        if (typeof ram === 'number') node.ram = Math.max(0, Math.min(100, Math.round(ram)));
        if (typeof disk === 'number') node.disk = Math.max(0, Math.min(100, Math.round(disk)));
        if (typeof ping === 'number') node.ping = Math.max(1, Math.round(ping));
        if (networkIn) node.networkIn = String(networkIn);
        if (networkOut) node.networkOut = String(networkOut);

        const nowIso = new Date().toISOString();
        node.lastSeen = nowIso;
        node.lastHeartbeat = nowIso;
        node.probeInstalled = true;
        node.status = (node.cpu > 90 || node.ram > 95) ? 'degraded' : 'online';

        await storage.saveNode(node);
        console.log('[Worker DB Confirmation] Successfully persisted probe report to database:', {
          nodeId: node.id,
          name: node.name,
          cpu: node.cpu,
          ram: node.ram,
          disk: node.disk,
          ping: node.ping,
          status: node.status,
          lastSeen: node.lastSeen,
          lastHeartbeat: node.lastHeartbeat,
          probeInstalled: true,
        });

        return new Response(JSON.stringify({
          success: true,
          node: {
            id: node.id,
            name: node.name,
            status: node.status,
            lastSeen: node.lastSeen,
            lastHeartbeat: node.lastHeartbeat,
            probeInstalled: true,
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        });
      } catch (err: any) {
        console.error('[Worker Probe Ingest] Error processing probe report:', err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    // 3. Dispatch remaining requests to cached singleton Hono router
    try {
      const { app } = await getOrInitWorkerContext(env);
      return app.fetch(request, env, ctx);
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cloudflare 边缘运行时错误',
          message: err.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },

  scheduled: async (event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) => {
    const { storage, cache } = await getOrInitWorkerContext(env);
    ctx.waitUntil(runMonitorCycle(storage, cache));
  },
};
