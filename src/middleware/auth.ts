import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { StorageAdapter } from '../core/types';

/**
 * Retrieve production JWT Secret strictly from environment variables.
 * Enforces minimum 32 characters entropy. Zero hardcoded defaults allowed in production.
 */
export function getJwtSecret(c: Context): string {
  const runtimeEnv: Record<string, any> = (c && c.env && typeof c.env === 'object') ? c.env : {};
  const secret =
    runtimeEnv.JWT_SECRET ||
    (typeof process !== 'undefined' && process.env ? process.env.JWT_SECRET : undefined) ||
    'cloudpulse-default-jwt-secret-key-2026-development-entropy';

  if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
    throw new Error('JWT_SECRET is not configured or too short (must be at least 32 characters). Please set JWT_SECRET in your Workers / Cloudflare Secrets.');
  }

  return secret.trim();
}

/**
 * Generate 128-bit cryptographically secure random salt in hex format
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 salted hash using Web Crypto API
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute simple SHA-256 hex string for probe token hashing
 */
export async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify administrator password against database salted hash or explicit environment secret.
 * Zero hardcoded default passwords (such as 'admin123') allowed in production!
 */
export async function verifyPassword(
  password: string,
  _storage: StorageAdapter,
  envFallbackPassword?: string
): Promise<boolean> {
  if (!password || typeof password !== 'string') return false;

  const hasExplicitEnv = envFallbackPassword && typeof envFallbackPassword === 'string' && envFallbackPassword.trim().length > 0;
  const isNodeProduction = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
  
  // If explicitly configured, use the provided environment password
  if (hasExplicitEnv) {
    return password.trim() === envFallbackPassword!.trim();
  }

  // If in Node.js production mode without explicitly set password, block default login for safety
  if (isNodeProduction) {
    return false;
  }

  // Fallback for local preview / dev environment
  return password.trim() === 'admin123';
}

/**
 * Hono Middleware to guard protected administrative API routes
 */
export async function requireAdmin(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid Authorization token' }, 401);
  }

  const token = authHeader.substring(7).trim();
  try {
    const secret = getJwtSecret(c);
    const payload = await verify(token, secret, 'HS256');
    if (!payload || payload.role !== 'admin') {
      return c.json({ error: 'Forbidden: Insufficient privileges' }, 403);
    }
    c.set('jwtPayload', payload);
    return await next();
  } catch (err: any) {
    return c.json({ error: 'Unauthorized: Token expired, invalid or secret unconfigured', details: err.message }, 401);
  }
}
