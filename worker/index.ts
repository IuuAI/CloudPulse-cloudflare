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
    cachedApp = createApiRouter(cachedStorage, cachedCache, env);
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
          console.error('[Cloudflare Worker Cold-Start] D1 connection pool initialization failed:', err);
          dbInitializationPromise = null; // Allow retry on subsequent request if transient
          throw err;
        }
      })();
    }
    await dbInitializationPromise;
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

    // 2. Handle CORS preflight options globally for API calls
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-probe-token',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 3. Dedicated Cloudflare D1 & KV Daily Usage Endpoint
    if (url.pathname === '/api/cloudflare/daily-usage' || url.pathname === '/api/cloudflare/quota') {
      try {
        const { storage, cache } = await getOrInitWorkerContext(env);
        const d1Usage = storage.getD1UsageStats ? await storage.getD1UsageStats() : null;
        const kvUsage = cache.getKVUsageStats ? await cache.getKVUsageStats() : null;

        return new Response(
          JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            connectionPool: {
              isInitialized: isDbInitialized,
              initializedAt: poolInitializedAt,
              d1Bound: !!cachedD1Binding || !!env.DB,
              kvBound: !!cachedKVBinding || !!env.CACHE,
              storageEngine: cachedStorage instanceof CloudflareD1Adapter ? 'Cloudflare D1 (Cached Singleton Pool)' : 'Memory Storage (Fallback)',
              cacheEngine: cachedCache instanceof CloudflareKVAdapter ? 'Cloudflare KV (Cached Singleton Instance)' : 'Memory Cache (Fallback)',
            },
            d1Usage: d1Usage || {
              dailyRowsRead: 0,
              readLimit: 5000000,
              readUsagePercent: 0,
              dailyRowsWritten: 0,
              writeLimit: 100000,
              writeUsagePercent: 0,
              storageBytes: 0,
              storageLimitBytes: 5 * 1024 * 1024 * 1024,
              storageUsagePercent: 0,
              tableCount: 0,
              totalRows: 0,
            },
            kvUsage: kvUsage || {
              dailyReads: 0,
              readLimit: 100000,
              readUsagePercent: 0,
              dailyWrites: 0,
              writeLimit: 1000,
              writeUsagePercent: 0,
              dailyDeletes: 0,
              deleteLimit: 1000,
              storageBytes: 0,
              storageLimitBytes: 1024 * 1024 * 1024,
              totalKeys: 0,
            },
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store',
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
      }
    }

    // 4. Health & diagnostics check endpoint with D1/KV pool status and daily usage
    if (url.pathname === '/api/health') {
      try {
        const { storage, cache } = await getOrInitWorkerContext(env);
        const d1Usage = storage.getD1UsageStats ? await storage.getD1UsageStats() : undefined;
        const kvUsage = cache.getKVUsageStats ? await cache.getKVUsageStats() : undefined;

        return new Response(
          JSON.stringify({
            ok: true,
            status: 'healthy',
            bindings: {
              d1Database: (!!cachedD1Binding || !!env.DB) ? 'Bound (DB - Cached Singleton)' : 'Missing',
              kvNamespace: (!!cachedKVBinding || !!env.CACHE) ? 'Bound (CACHE - Cached Singleton)' : 'Missing',
            },
            connectionPool: {
              isInitialized: isDbInitialized,
              initializedAt: poolInitializedAt,
              storageType: (cachedStorage instanceof CloudflareD1Adapter) ? 'Cloudflare D1 (Cached Singleton)' : 'In-Memory Fallback',
              cacheType: (cachedCache instanceof CloudflareKVAdapter) ? 'Cloudflare KV (Cached Singleton)' : 'In-Memory Fallback',
            },
            dailyUsage: {
              d1: d1Usage,
              kv: kvUsage,
            },
            envConfigured: {
              hasAdminPassword: !!env.ADMIN_PASSWORD,
              hasTelegramToken: !!env.TELEGRAM_BOT_TOKEN,
            },
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-probe-token',
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            ok: false,
            status: 'degraded',
            error: err.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
      }
    }

    // 5. Dispatch request to cached singleton Hono router
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
