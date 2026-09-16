import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { StorageAdapter, CacheAdapter } from '../core/types';
import { getJwtSecret, hashPassword, generateSalt, verifyPassword, requireAdmin } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';
import { AdminVerifySchema, ChangePasswordSchema } from '../core/schemas';

export function createAuthRoutes(storage: StorageAdapter, cache: CacheAdapter) {
  const router = new Hono();

  // Rate limiter: 5 requests / min / IP for login verification
  const loginLimiter = createRateLimiter(cache, {
    windowSeconds: 60,
    maxRequests: 5,
    keyPrefix: 'auth_login',
    errorMessage: '登录尝试过于频繁，已触发安全频率限制，请 1 分钟后再试。',
  });

  // Admin Login / Verification Endpoint
  router.post('/api/admin/verify', loginLimiter, async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = AdminVerifySchema.safeParse(rawBody);

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

      const { password } = parsed.data;
      const runtimeEnv = (c.env || {}) as Record<string, unknown>;
      const envPassword =
        (runtimeEnv.ADMIN_PASSWORD as string | undefined) ||
        (typeof process !== 'undefined' && process.env ? process.env.ADMIN_PASSWORD : undefined);

      const isValid = await verifyPassword(password, storage, envPassword);
      if (!isValid) {
        return c.json({ success: false, error: '密码错误或管理员账户尚未初始化' }, 401);
      }

      // Auto-initialize admin_auth in D1 database on first successful login if empty
      if (storage.getAdminAuth && storage.saveAdminAuth) {
        try {
          const existingAuth = await storage.getAdminAuth().catch(() => null);
          if (!existingAuth) {
            const salt = generateSalt();
            const passwordHash = await hashPassword(password.trim(), salt);
            await storage.saveAdminAuth({
              passwordHash,
              salt,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn('Auto-initializing admin_auth record failed gracefully:', e);
        }
      }

      let secret: string;
      try {
        secret = getJwtSecret(c);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown secret error';
        return c.json(
          {
            success: false,
            error: '系统安全错误: ' + message,
          },
          500
        );
      }

      const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
      const token = await sign({ role: 'admin', exp }, secret, 'HS256');

      return c.json({ success: true, token });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ success: false, error: message }, 500);
    }
  });

  // Admin Change Password Endpoint
  router.post('/api/admin/change-password', requireAdmin, async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      const parsed = ChangePasswordSchema.safeParse(rawBody);

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

      const { oldPassword, newPassword } = parsed.data;
      const runtimeEnv = (c.env || {}) as Record<string, unknown>;
      const envPassword =
        (runtimeEnv.ADMIN_PASSWORD as string | undefined) ||
        (typeof process !== 'undefined' && process.env ? process.env.ADMIN_PASSWORD : undefined);

      const isOldValid = await verifyPassword(oldPassword, storage, envPassword);
      if (!isOldValid) {
        return c.json({ success: false, error: '原密码输入不正确，请重新核对' }, 403);
      }

      const salt = generateSalt();
      const passwordHash = await hashPassword(newPassword, salt);
      const nowIso = new Date().toISOString();

      if (storage.saveAdminAuth) {
        await storage.saveAdminAuth({
          passwordHash,
          salt,
          updatedAt: nowIso,
        });
      }

      // Synchronize runtime secret in Cloudflare Worker environment & cache
      if (c && c.env && typeof c.env === 'object') {
        (c.env as Record<string, unknown>).ADMIN_PASSWORD = newPassword;
      }
      if (typeof process !== 'undefined' && process.env) {
        process.env.ADMIN_PASSWORD = newPassword;
      }
      await cache.set('runtime_admin_secret', newPassword).catch(() => null);

      let secret: string;
      try {
        secret = getJwtSecret(c);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown secret error';
        return c.json(
          {
            success: false,
            error: '系统安全错误: ' + message,
          },
          500
        );
      }

      const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      const newToken = await sign({ role: 'admin', exp, updatedAt: nowIso }, secret, 'HS256');

      return c.json({
        success: true,
        message: '管理员凭证更新成功，已即时持久化到 D1 数据库并刷新安全会话',
        token: newToken,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      return c.json({ success: false, error: message }, 500);
    }
  });

  return router;
}
