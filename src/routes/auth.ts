import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { StorageAdapter, CacheAdapter, AppEnv } from '../core/types';
import {
  getJwtSecret,
  hashPassword,
  generateSalt,
  verifyAndGetAdminAuth,
  createRequireAdminMiddleware,
} from '../middleware/auth';
import { createRateLimiter, getClientIp } from '../middleware/rateLimit';
import { AdminVerifySchema, ChangePasswordSchema } from '../core/schemas';

export function createAuthRoutes(storage: StorageAdapter, cache: CacheAdapter) {
  const router = new Hono<AppEnv>();
  const requireAdminWithStorage = createRequireAdminMiddleware(storage);

  // Rate limiter: 5 requests / 60s per IP + username combo to block brute-force
  const loginLimiter = createRateLimiter(cache, {
    windowSeconds: 60,
    maxRequests: 5,
    keyPrefix: 'auth_login',
    keyExtractor: (c) => {
      const ip = getClientIp(c);
      return `${ip}:admin`;
    },
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
      const { valid, tokenVersion } = await verifyAndGetAdminAuth(password, storage, c);

      if (!valid) {
        // Log internally for debugging, never leak environment or secret structure to client
        console.warn(`[Admin Login Rejected] Failed password attempt from ${getClientIp(c)}`);
        return c.json({ success: false, error: '认证失败，管理员密码不正确' }, 401);
      }

      let secret: string;
      try {
        secret = getJwtSecret(c);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown secret error';
        console.error('[JWT Configuration Error]', message);
        return c.json(
          {
            success: false,
            error: '系统安全错误: JWT_SECRET 未配置或长度不足 32 位',
          },
          500
        );
      }

      // Secure JWT Payload: standard claims (iss, sub, role, iat, exp, jti, ver)
      // Access token expiration: 2 hours (7200s)
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 2 * 60 * 60;
      const jti = crypto.randomUUID();

      const token = await sign(
        {
          iss: 'cloudpulse',
          sub: 'admin',
          role: 'admin',
          iat: now,
          exp,
          jti,
          ver: tokenVersion,
        },
        secret,
        'HS256'
      );

      return c.json({ success: true, token, expiresIn: 7200 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      console.error('[Admin Login Exception]', err);
      return c.json({ success: false, error: '服务器内部错误' }, 500);
    }
  });

  // Admin Change Password Endpoint - requires valid admin session
  router.post('/api/admin/change-password', requireAdminWithStorage, async (c) => {
    try {
      // Must guarantee storage persistence is functional
      if (!storage.saveAdminAuth || !storage.getAdminAuth) {
        return c.json(
          {
            success: false,
            error: '持久化存储引擎不可用，无法安全保存管理员凭证',
          },
          500
        );
      }

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

      // 1. Verify old password strictly against D1 / initial secret
      const { valid: isOldValid, tokenVersion: currentVersion } = await verifyAndGetAdminAuth(oldPassword, storage, c);
      if (!isOldValid) {
        return c.json({ success: false, error: '原密码输入不正确，请重新核对' }, 403);
      }

      // 2. Generate new salt and compute PBKDF2 hash
      const newSalt = generateSalt();
      const newPasswordHash = await hashPassword(newPassword, newSalt);
      const nowIso = new Date().toISOString();
      const nextTokenVersion = (currentVersion || 1) + 1;

      // 3. Persist new credentials and increment token_version in D1
      await storage.saveAdminAuth({
        passwordHash: newPasswordHash,
        salt: newSalt,
        updatedAt: nowIso,
        tokenVersion: nextTokenVersion,
      });

      // 4. Invalidate temporary caches
      await cache.delete('runtime_admin_secret').catch(() => null);

      let secret: string;
      try {
        secret = getJwtSecret(c);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown secret error';
        return c.json({ success: false, error: '系统安全错误: ' + message }, 500);
      }

      // 5. Issue new JWT reflecting incremented tokenVersion (all old JWTs with previous version become instantly invalid)
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 2 * 60 * 60;
      const jti = crypto.randomUUID();

      const newToken = await sign(
        {
          iss: 'cloudpulse',
          sub: 'admin',
          role: 'admin',
          iat: now,
          exp,
          jti,
          ver: nextTokenVersion,
        },
        secret,
        'HS256'
      );

      return c.json({
        success: true,
        message: '管理员密码已成功持久化至 D1 数据库，全部历史会话已自动失效并签发新凭证',
        token: newToken,
        expiresIn: 7200,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      console.error('[Change Password Exception]', err);
      return c.json({ success: false, error: '修改密码失败: ' + message }, 500);
    }
  });

  return router;
}

