/// <reference types="@cloudflare/workers-types" />
import { CacheAdapter } from '../../core/types';

export class CloudflareKVAdapter implements CacheAdapter {
  constructor(private kv?: KVNamespace) {}

  private checkBinding() {
    if (!this.kv) {
      throw new Error("Cloudflare KV namespace binding 'CACHE' is not configured. Please bind your KV namespace with variable name 'CACHE' in Cloudflare Pages / Workers settings or wrangler.toml.");
    }
  }

  async get(key: string): Promise<any> {
    this.checkBinding();
    const val = await this.kv!.get(key, 'json');
    return val;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    this.checkBinding();
    const options: KVNamespacePutOptions = {};
    if (ttlSeconds) {
      options.expirationTtl = ttlSeconds;
    }
    await this.kv!.put(key, JSON.stringify(value), options);
  }

  async delete(key: string): Promise<void> {
    this.checkBinding();
    await this.kv!.delete(key);
  }
}
