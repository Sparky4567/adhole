import { config } from "../config";
import type { CachedResponse } from "./types";

export class DnsCache {
  private cache = new Map<string, CachedResponse>();
  private hits = 0;
  private misses = 0;
  private cleanupTimer: any = null;

  constructor() {
    // Run cleanup every 60 seconds
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }

  private getKey(domain: string, type: string): string {
    return `${type.toUpperCase()}:${domain.toLowerCase().replace(/\.$/, "")}`;
  }

  // Get cached response if still valid
  public get(domain: string, type: string): any[] | null {
    if (!config.cacheEnabled) return null;

    const key = this.getKey(domain, type);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (now >= entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    entry.hitCount++;

    // Calculate remaining TTL in seconds
    const remainingTtl = Math.max(
      1,
      Math.round((entry.expiresAt - now) / 1000)
    );

    // Deep clone answers and adjust TTL to remaining
    const answers = entry.answers.map((ans) => ({
      ...ans,
      ttl: remainingTtl,
    }));

    return answers;
  }

  // Store response answers in cache
  public set(domain: string, type: string, answers: any[], authorities: any[] = [], additionals: any[] = []) {
    if (!config.cacheEnabled || !answers || answers.length === 0) return;

    // Find the lowest TTL in answers
    let minRecordTtl = Infinity;
    for (const ans of answers) {
      if (typeof ans.ttl === "number" && ans.ttl > 0) {
        if (ans.ttl < minRecordTtl) {
          minRecordTtl = ans.ttl;
        }
      }
    }

    if (minRecordTtl === Infinity) {
      minRecordTtl = 300; // default 5 minutes
    }

    // Clamp TTL to configured min and max
    const effectiveTtl = Math.min(
      config.cacheMaxTtl,
      Math.max(config.cacheMinTtl, minRecordTtl)
    );

    const key = this.getKey(domain, type);
    const now = Date.now();

    this.cache.set(key, {
      answers,
      authorities,
      additionals,
      expiresAt: now + effectiveTtl * 1000,
      created: now,
      hitCount: 0,
    });
  }

  // Flush all entries
  public flush() {
    this.cache.clear();
  }

  // Cleanup expired items
  public cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  public getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio:
        this.hits + this.misses > 0
          ? Math.round((this.hits / (this.hits + this.misses)) * 1000) / 10
          : 0,
    };
  }

  public close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
