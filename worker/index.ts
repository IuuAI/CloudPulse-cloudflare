/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { CloudflareD1Adapter } from '../src/adapters/storage/CloudflareD1Adapter';
import { CloudflareKVAdapter } from '../src/adapters/cache/CloudflareKVAdapter';
import { MemoryStorageAdapter } from '../src/adapters/storage/MemoryStorageAdapter';
import { MemoryCacheAdapter } from '../src/adapters/cache/MemoryCacheAdapter';
import { createApiRouter } from '../src/core/router';
import { runMonitorCycle } from '../src/core/monitor';

// Persistent memory storage instance across requests within the worker isolate
const memoryStorage = new MemoryStorageAdapter();
const memoryCache = new MemoryCacheAdapter();

type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  ADMIN_PASSWORD?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  ASSETS?: Fetcher;
};

export default {
  fetch: async (request: Request, env: Bindings, ctx: ExecutionContext) => {
    const url = new URL(request.url);

    // 1. Serve frontend SPA assets when not an /api route and ASSETS binding is present
    if (!url.pathname.startsWith('/api') && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Handle CORS preflight options globally for API calls
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-probe-token',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        ok: true, 
        status: 'healthy',
        bindings: {
          d1Database: !!env.DB ? 'Bound (DB)' : 'Missing',
          kvNamespace: !!env.CACHE ? 'Bound (CACHE)' : 'Missing'
        },
        envConfigured: {
          hasAdminPassword: !!env.ADMIN_PASSWORD,
          hasTelegramToken: !!env.TELEGRAM_BOT_TOKEN
        }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-probe-token'
        }
      });
    }

    // Select storage and cache adapters (Cloudflare D1/KV if bound, else in-memory fallback)
    const storage = env.DB ? new CloudflareD1Adapter(env.DB) : memoryStorage;
    const cache = env.CACHE ? new CloudflareKVAdapter(env.CACHE) : memoryCache;

    try {
      const app = createApiRouter(storage, cache, env);
      return app.fetch(request, env, ctx);
    } catch (err: any) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cloudflare 边缘运行时错误",
        message: err.message
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  },

  scheduled: async (event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) => {
    const storage = env.DB ? new CloudflareD1Adapter(env.DB) : memoryStorage;
    const cache = env.CACHE ? new CloudflareKVAdapter(env.CACHE) : memoryCache;
    ctx.waitUntil(runMonitorCycle(storage, cache));
  }
};
