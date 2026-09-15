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

    // 2. Dispatch request to cached singleton Hono router
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
