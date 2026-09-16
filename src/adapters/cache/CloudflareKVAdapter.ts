/// <reference types="@cloudflare/workers-types" />
import { CacheAdapter, CloudflareKVUsageStats } from '../../core/types';

export class CloudflareKVAdapter implements CacheAdapter {
  private dailyReads = 0;
  private dailyWrites = 0;
  private dailyDeletes = 0;
  private currentDate = new Date().toISOString().slice(0, 10);
  private keySet = new Set<string>();
  private estimatedStorageBytes = 24 * 1024; // Base estimate 24KB

  constructor(private kv?: KVNamespace) {}

  private checkBinding() {
    if (!this.kv) {
      throw new Error("Cloudflare KV namespace binding 'CACHE' is not configured. Please bind your KV namespace with variable name 'CACHE' in Cloudflare Pages / Workers settings or wrangler.toml.");
    }
  }

  private ensureCurrentDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.currentDate !== today) {
      this.currentDate = today;
      this.dailyReads = 0;
      this.dailyWrites = 0;
      this.dailyDeletes = 0;
    }
  }

  async get(key: string): Promise<any> {
    if (!this.kv) return null;
    this.ensureCurrentDay();
    this.dailyReads++;
    try {
      const val = await this.kv.get(key, 'json');
      return val;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.kv) return;
    this.ensureCurrentDay();
    this.dailyWrites++;
    this.keySet.add(key);

    const valStr = JSON.stringify(value);
    this.estimatedStorageBytes += (key.length + valStr.length);

    const options: KVNamespacePutOptions = {};
    if (ttlSeconds) {
      options.expirationTtl = Math.max(60, ttlSeconds);
    }
    try {
      await this.kv.put(key, valStr, options);
    } catch {
      // Gracefully ignore write failures (e.g. rate limits 429)
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.kv) return;
    this.ensureCurrentDay();
    this.dailyDeletes++;
    this.keySet.delete(key);
    try {
      await this.kv.delete(key);
    } catch {}
  }

  async getKVUsageStats(): Promise<CloudflareKVUsageStats> {
    this.ensureCurrentDay();
    const readLimit = 100000;
    const writeLimit = 1000;
    const deleteLimit = 1000;
    const storageLimitBytes = 1024 * 1024 * 1024; // 1 GB

    const totalKeys = Math.max(this.keySet.size, 14);
    const storageBytes = Math.max(this.estimatedStorageBytes, totalKeys * 2048);

    return {
      dailyReads: this.dailyReads,
      readLimit,
      dailyWrites: this.dailyWrites,
      writeLimit,
      dailyDeletes: this.dailyDeletes,
      deleteLimit,
      storageBytes,
      storageLimitBytes,
      totalKeys,
      readUsagePercent: Math.min(100, Math.round((this.dailyReads / readLimit) * 10000) / 100),
      writeUsagePercent: Math.min(100, Math.round((this.dailyWrites / writeLimit) * 10000) / 100),
    };
  }
}

