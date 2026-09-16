import { Hono } from 'hono';
import { StorageAdapter, CacheAdapter, ServerNode } from '../core/types';
import { createRequireAdminMiddleware, getJwtSecret } from '../middleware/auth';
import { verify } from 'hono/jwt';
import { CreateNodeSchema, UpdateNodeSchema } from '../core/schemas';

async function isCallerAdmin(c: any, storage: StorageAdapter): Promise<boolean> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7).trim();
  if (!token) return false;
  try {
    const secret = getJwtSecret(c);
    const payload: any = await verify(token, secret, 'HS256');
    const now = Math.floor(Date.now() / 1000);
    if (
      !payload ||
      payload.role !== 'admin' ||
      payload.sub !== 'admin' ||
      (payload.iss && payload.iss !== 'cloudpulse') ||
      typeof payload.exp !== 'number' ||
      payload.exp <= now
    ) {
      return false;
    }
    if (typeof payload.ver === 'number' && storage.getAdminAuth) {
      const record = await storage.getAdminAuth().catch(() => null);
      if (record && typeof record.tokenVersion === 'number' && payload.ver !== record.tokenVersion) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function createNodesRoutes(storage: StorageAdapter, _cache: CacheAdapter) {
  const router = new Hono();
  const requireAdmin = createRequireAdminMiddleware(storage);

  // Nodes List - ProbeToken is filtered for non-admin viewers to prevent leaks
  router.get('/api/nodes', async (c) => {
    try {
      const nodes = await storage.getNodes();
      const isAdmin = await isCallerAdmin(c, storage);
      const sanitizedNodes = (nodes || []).map((node: ServerNode) => ({
        ...node,
        ip: '***.***.***.***',
        probeToken: isAdmin ? node.probeToken : undefined,
        lastHeartbeat: node.lastHeartbeat || node.lastSeen || new Date().toISOString(),
        lastSeen: node.lastSeen || node.lastHeartbeat || new Date().toISOString(),
        probeInstalled: node.probeInstalled ?? Boolean(node.lastHeartbeat || node.lastSeen || node.probeToken),
      }));
      return c.json(sanitizedNodes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.post('/api/nodes', requireAdmin, async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = CreateNodeSchema.safeParse(rawBody);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: '输入验证失败',
            issues: parsed.error.issues,
          },
          400
        );
      }

      const body = parsed.data;
      const nodeUuid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
          : Math.random().toString(36).slice(2, 10);

      const newNode: ServerNode = {
        id: body.id || `n-${Date.now()}`,
        name: body.name,
        region: body.region,
        ip: body.ip || '***.***.***.***',
        status: body.status || 'healthy',
        cpu: body.cpu ?? 0,
        ram: body.ram ?? 0,
        disk: body.disk ?? 20,
        ping: body.ping ?? 20,
        networkIn: body.networkIn || '0 B',
        networkOut: body.networkOut || '0 B',
        uptime: body.uptime ?? 100,
        lastSeen: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        probeInstalled: true,
        probeToken: `cpm_probe_${nodeUuid}`,
        os: body.os || 'Linux',
        tags: body.tags || [],
      };

      await storage.saveNode(newNode);
      return c.json(newNode);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.put('/api/nodes/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = UpdateNodeSchema.safeParse(rawBody);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: '输入验证失败',
            issues: parsed.error.issues,
          },
          400
        );
      }

      const nodes = await storage.getNodes();
      const existing = nodes.find((n: ServerNode) => n.id === id);
      if (!existing) {
        return c.json({ error: 'Node not found' }, 404);
      }

      const updated: ServerNode = {
        ...existing,
        ...parsed.data,
        id,
        lastSeen: new Date().toISOString(),
      };

      await storage.saveNode(updated);
      return c.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  router.delete('/api/nodes/:id', requireAdmin, async (c) => {
    try {
      const id = c.req.param('id');
      if (storage.deleteNode) {
        await storage.deleteNode(id);
      }
      return c.json({ success: true, id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ error: message }, 500);
    }
  });

  return router;
}
