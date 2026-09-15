import { CacheAdapter, CloudflareKVUsageStats } from '../../core/types';

export class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, { value: any; expiresAt?: number }>();
  private dailyReads = 120;
  private dailyWrites = 45;
  private dailyDeletes = 5;

  async get(key: string): Promise<any> {
    this.dailyReads++;
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    this.dailyWrites++;
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.dailyDeletes++;
    this.store.delete(key);
  }

  async getKVUsageStats(): Promise<CloudflareKVUsageStats> {
    const readLimit = 100000;
    const writeLimit = 1000;
    const deleteLimit = 1000;
    const storageLimitBytes = 1024 * 1024 * 1024;
    return {
      dailyReads: this.dailyReads,
      readLimit,
      dailyWrites: this.dailyWrites,
      writeLimit,
      dailyDeletes: this.dailyDeletes,
      deleteLimit,
      storageBytes: Math.max(this.store.size * 2048, 16 * 1024),
      storageLimitBytes,
      totalKeys: Math.max(this.store.size, 10),
      readUsagePercent: Math.min(100, Math.round((this.dailyReads / readLimit) * 10000) / 100),
      writeUsagePercent: Math.min(100, Math.round((this.dailyWrites / writeLimit) * 10000) / 100),
    };
  }
}

