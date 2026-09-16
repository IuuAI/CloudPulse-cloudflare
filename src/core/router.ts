import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { StorageAdapter, CacheAdapter } from './types';
import { createHealthRoutes } from '../routes/health';
import { createOverviewRoutes } from '../routes/overview';
import { createAuthRoutes } from '../routes/auth';
import { createNodesRoutes } from '../routes/nodes';
import { createProbeRoutes } from '../routes/probe';
import { createServicesRoutes } from '../routes/services';
import { createIncidentsRoutes } from '../routes/incidents';
import { createMetricsRoutes } from '../routes/metrics';
import { createTelegramRoutes } from '../routes/telegram';
import { createSettingsRoutes } from '../routes/settings';

/**
 * CloudPulse Core API Router (Modularized)
 * Composes dedicated route modules with secure authentication & storage adapters.
 */
export function createApiRouter(storage: StorageAdapter, cache: CacheAdapter): Hono {
  const app = new Hono();

  // Dynamic Strict CORS Configuration
  app.use(
    '/api/*',
    cors({
      origin: (origin, c) => {
        if (!origin) return origin; // Non-browser clients (e.g. curl / background probe agents)
        const runtimeEnv: Record<string, unknown> = c && c.env && typeof c.env === 'object' ? c.env : {};
        const rawAllowed =
          (runtimeEnv.ALLOWED_ORIGINS as string | undefined) ||
          (typeof process !== 'undefined' && process.env ? process.env.ALLOWED_ORIGINS : '');

        if (!rawAllowed || rawAllowed === '*') {
          return origin;
        }

        const allowedList = rawAllowed
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        if (
          allowedList.includes(origin) ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          origin.endsWith('.pages.dev') ||
          origin.endsWith('.run.app')
        ) {
          return origin;
        }

        return undefined;
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'x-probe-token'],
      exposeHeaders: ['Content-Length', 'Content-Type', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
      maxAge: 86400,
    })
  );

  // Mount Modular Sub-Routers
  app.route('/', createHealthRoutes(storage, cache));
  app.route('/', createOverviewRoutes(storage, cache));
  app.route('/', createAuthRoutes(storage, cache));
  app.route('/', createNodesRoutes(storage, cache));
  app.route('/', createProbeRoutes(storage, cache));
  app.route('/', createServicesRoutes(storage, cache));
  app.route('/', createIncidentsRoutes(storage, cache));
  app.route('/', createMetricsRoutes(storage, cache));
  app.route('/', createTelegramRoutes(storage, cache));
  app.route('/', createSettingsRoutes(storage, cache));

  return app;
}
