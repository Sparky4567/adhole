import { describe, expect, test } from "bun:test";
import { DnsCache } from "../src/core/dns-cache";

describe("DnsCache", () => {
  test("should store and retrieve cached DNS answers", () => {
    const cache = new DnsCache();
    const answers = [
      {
        name: "example.com",
        type: "A",
        ttl: 300,
        class: "IN",
        data: "93.184.216.34",
      },
    ];

    cache.set("example.com", "A", answers);

    const retrieved = cache.get("example.com", "A");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.length).toBe(1);
    expect(retrieved?.[0].data).toBe("93.184.216.34");
    expect(retrieved?.[0].ttl).toBeGreaterThan(0);

    cache.close();
  });

  test("should return null on cache miss", () => {
    const cache = new DnsCache();
    const retrieved = cache.get("nonexistent.com", "A");
    expect(retrieved).toBeNull();
    cache.close();
  });

  test("should flush cache correctly", () => {
    const cache = new DnsCache();
    cache.set("example.com", "A", [{ name: "example.com", type: "A", ttl: 300, data: "1.2.3.4" }]);
    expect(cache.get("example.com", "A")).not.toBeNull();

    cache.flush();
    expect(cache.get("example.com", "A")).toBeNull();
    cache.close();
  });

  test("should report accurate hit and miss stats", () => {
    const cache = new DnsCache();
    cache.set("test.org", "A", [{ name: "test.org", type: "A", ttl: 300, data: "1.1.1.1" }]);

    cache.get("test.org", "A"); // Hit
    cache.get("test.org", "A"); // Hit
    cache.get("miss.org", "A"); // Miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRatio).toBe(66.7);
    cache.close();
  });
});
