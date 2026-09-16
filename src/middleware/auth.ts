import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { StorageAdapter, AdminAuthRecord } from '../core/types';

/**
 * Retrieve production JWT Secret strictly from environment variables.
 * Enforces minimum 32 characters entropy. Zero hardcoded defaults allowed in any environment.
 */
export function getJwtSecret(c: Context): string {
  const cEnv: Record<string, any> = (c && c.env && typeof c.env === 'object') ? c.env : {};
  const gThis = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  const secret =
    cEnv.JWT_SECRET ||
    gThis.JWT_SECRET ||
    (typeof process !== 'undefined' && process.env ? process.env.JWT_SECRET : undefined);

  if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
    throw new Error('JWT_SECRET is not configured or too short (must be at least 32 characters). Please set JWT_SECRET in your Workers / Cloudflare Secrets.');
  }

  return secret.trim();
}

/**
 * Generate cryptographically secure random salt in hex format (16 bytes = 128-bit)
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * PBKDF2 with SHA-256 (100,000 iterations), standard Web Crypto API native in Cloudflare Workers.
 * Resistant to brute force and dictionary attacks without external native dependencies.
 */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Convert salt hex to Uint8Array
  const saltBytes = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || Array.from(encoder.encode(saltHex))
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passKey,
    256 // 256 bits = 32 bytes
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Timing-safe string equality comparison to prevent timing side-channel attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Compute SHA-256 hex string for probe token hashing
 */
export async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Core Authentication Verifier:
 * 1. Read persistent record from D1 (admin_auth table).
 * 2. If D1 has record, verify with PBKDF2 hash (with seamless migration support from legacy sha256).
 * 3. If D1 has NO record, bootstrap from c.env.ADMIN_PASSWORD into D1 and verify.
 * 4. Return { valid: boolean, tokenVersion: number }
 */
export async function verifyAndGetAdminAuth(
  password: string,
  storage: StorageAdapter,
  c: Context
): Promise<{ valid: boolean; tokenVersion: number }> {
  if (!password || typeof password !== 'string') {
    return { valid: false, tokenVersion: 1 };
  }

  // 1. Check if record exists in D1 database
  if (storage.getAdminAuth) {
    const existing = await storage.getAdminAuth().catch(() => null);
    if (existing && existing.passwordHash && existing.salt) {
      const currentVersion = typeof existing.tokenVersion === 'number' ? existing.tokenVersion : 1;

      // Primary check: PBKDF2-SHA256 (100k iterations)
      const computedPbkdf2 = await hashPassword(password, existing.salt);
      if (timingSafeEqual(computedPbkdf2, existing.passwordHash)) {
        return { valid: true, tokenVersion: currentVersion };
      }

      // Legacy fallback check: sha256(salt:password) for backward compatibility
      // If valid, seamlessly upgrade record to PBKDF2 in D1!
      const encoder = new TextEncoder();
      const legacyData = encoder.encode(`${existing.salt}:${password}`);
      const legacyBuf = await crypto.subtle.digest('SHA-256', legacyData);
      const legacyHash = Array.from(new Uint8Array(legacyBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (timingSafeEqual(legacyHash, existing.passwordHash)) {
        // Upgrade to PBKDF2 in background
        if (storage.saveAdminAuth) {
          const newSalt = generateSalt();
          const newPbkdf2 = await hashPassword(password, newSalt);
          await storage.saveAdminAuth({
            passwordHash: newPbkdf2,
            salt: newSalt,
            updatedAt: new Date().toISOString(),
            tokenVersion: currentVersion,
          }).catch(err => console.error('Failed to auto-upgrade legacy hash to PBKDF2:', err));
        }
        return { valid: true, tokenVersion: currentVersion };
      }

      return { valid: false, tokenVersion: currentVersion };
    }
  }

  // 2. D1 has no record yet -> Bootstrap from Cloudflare Secret: ADMIN_PASSWORD
  const cEnv = (c && c.env && typeof c.env === 'object') ? (c.env as Record<string, any>) : {};
  const gThis = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  const envPassword =
    (typeof cEnv.ADMIN_PASSWORD === 'string' && cEnv.ADMIN_PASSWORD.trim()) ||
    (typeof gThis.ADMIN_PASSWORD === 'string' && gThis.ADMIN_PASSWORD.trim()) ||
    (typeof process !== 'undefined' && process.env?.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : '');

  if (envPassword) {
    if (timingSafeEqual(password.trim(), envPassword)) {
      // Bootstrap into D1 so subsequent logins use D1 exclusively
      if (storage.saveAdminAuth) {
        const salt = generateSalt();
        const passwordHash = await hashPassword(password.trim(), salt);
        await storage.saveAdminAuth({
          passwordHash,
          salt,
          updatedAt: new Date().toISOString(),
          tokenVersion: 1,
        }).catch(err => console.error('Failed to bootstrap initial admin auth into D1:', err));
      }
      return { valid: true, tokenVersion: 1 };
    }
    return { valid: false, tokenVersion: 1 };
  }

  // 3. Local dev / test environment fallback: only if DEV_ADMIN_PASSWORD is explicitly defined
  const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
  const devPassword = typeof process !== 'undefined' ? process.env?.DEV_ADMIN_PASSWORD : undefined;
  if (isDev && devPassword && devPassword.trim().length > 0) {
    if (timingSafeEqual(password.trim(), devPassword.trim())) {
      return { valid: true, tokenVersion: 1 };
    }
  }

  return { valid: false, tokenVersion: 1 };
}

/**
 * Legacy compatibility wrapper
 */
export async function verifyPassword(
  password: string,
  storage: StorageAdapter,
  _envFallbackPassword?: string,
  c?: Context
): Promise<boolean> {
  const dummyContext = c || ({} as Context);
  const result = await verifyAndGetAdminAuth(password, storage, dummyContext);
  return result.valid;
}

/**
 * Factory for requireAdmin middleware with storage binding.
 * Verifies JWT signature, role, sub, iss, expiration, and checks tokenVersion against D1
 * to immediately invalidate previous sessions upon password reset.
 */
export function createRequireAdminMiddleware(storage: StorageAdapter) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid Authorization token' }, 401);
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return c.json({ error: 'Unauthorized: Empty token' }, 401);
    }

    try {
      const secret = getJwtSecret(c);
      const payload: any = await verify(token, secret, 'HS256');

      if (!payload) {
        return c.json({ error: 'Unauthorized: Invalid token' }, 401);
      }

      // Check essential claims: role, sub, iss, exp
      const now = Math.floor(Date.now() / 1000);
      if (
        payload.role !== 'admin' ||
        payload.sub !== 'admin' ||
        (payload.iss && payload.iss !== 'cloudpulse') ||
        typeof payload.exp !== 'number' ||
        payload.exp <= now
      ) {
        return c.json({ error: 'Forbidden: Insufficient administrative privileges' }, 403);
      }

      // Check token version against D1 if token specifies a version
      if (typeof payload.ver === 'number' && storage.getAdminAuth) {
        const record = await storage.getAdminAuth().catch(() => null);
        if (record && typeof record.tokenVersion === 'number' && payload.ver !== record.tokenVersion) {
          return c.json({
            error: 'Unauthorized: Session revoked due to administrative password update, please sign in again',
            revoked: true,
          }, 401);
        }
      }

      c.set('jwtPayload', payload);
      return await next();
    } catch (err: any) {
      console.warn('[JWT Auth Middleware Error]', err?.message || 'Verification failed');
      return c.json({
        error: 'Unauthorized: Invalid or expired token',
      }, 401);
    }
  };
}

/**
 * Fallback middleware for routes that do not inject storage
 */
export async function requireAdmin(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid Authorization token' }, 401);
  }

  const token = authHeader.substring(7).trim();
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
      return c.json({ error: 'Forbidden: Insufficient administrative privileges' }, 403);
    }
    c.set('jwtPayload', payload);
    return await next();
  } catch (err: any) {
    console.warn('[JWT Auth Middleware Error]', err?.message || 'Verification failed');
    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
  }
}

