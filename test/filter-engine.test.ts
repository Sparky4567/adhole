import { describe, expect, test } from "bun:test";
import { FilterEngine } from "../src/core/filter-engine";

describe("FilterEngine", () => {
  test("should block exact domains from blocklist", () => {
    const engine = new FilterEngine();
    const map = new Map<string, string>();
    map.set("ads.example.com", "Default Blocklist");
    map.set("tracking.net", "Default Blocklist");
    engine.setBlocklistDomains(map);

    const res1 = engine.evaluate("ads.example.com", "A");
    expect(res1.blocked).toBe(true);
    expect(res1.status).toBe("blocked");
    expect(res1.matchedList).toBe("Default Blocklist");

    const res2 = engine.evaluate("safe.example.com", "A");
    expect(res2.blocked).toBe(false);
    expect(res2.status).toBe("forwarded");
  });

  test("should block subdomains of blocked parent domains", () => {
    const engine = new FilterEngine();
    const map = new Map<string, string>();
    map.set("doubleclick.net", "Ad Blocklist");
    engine.setBlocklistDomains(map);

    const res = engine.evaluate("stats.doubleclick.net", "A");
    expect(res.blocked).toBe(true);
    expect(res.status).toBe("blocked");

    const resNested = engine.evaluate("a.b.c.doubleclick.net", "A");
    expect(resNested.blocked).toBe(true);
  });

  test("should prioritize whitelist over blocklist", () => {
    const engine = new FilterEngine();
    const map = new Map<string, string>();
    map.set("telemetry.company.com", "Blocklist");
    engine.setBlocklistDomains(map);

    // Whitelist the domain
    engine.setCustomRules([
      {
        id: 1,
        pattern: "telemetry.company.com",
        type: "whitelist",
        ruleKind: "exact",
        comment: "Allowed telemetry",
        enabled: true,
        createdAt: Date.now(),
      },
    ]);

    const res = engine.evaluate("telemetry.company.com", "A");
    expect(res.blocked).toBe(false);
    expect(res.status).toBe("forwarded");
    expect(res.reason).toContain("Whitelist");
  });

  test("should handle wildcard blacklist and whitelist", () => {
    const engine = new FilterEngine();
    engine.setCustomRules([
      {
        id: 1,
        pattern: "*.badtracker.com",
        type: "blacklist",
        ruleKind: "wildcard",
        comment: "",
        enabled: true,
        createdAt: Date.now(),
      },
    ]);

    expect(engine.evaluate("api.badtracker.com", "A").blocked).toBe(true);
    expect(engine.evaluate("badtracker.com", "A").blocked).toBe(false); // wildcard *.
    expect(engine.evaluate("goodtracker.com", "A").blocked).toBe(false);
  });

  test("should handle regex rules", () => {
    const engine = new FilterEngine();
    engine.setCustomRules([
      {
        id: 1,
        pattern: "^ad[0-9]+\\.track\\.com$",
        type: "blacklist",
        ruleKind: "regex",
        comment: "",
        enabled: true,
        createdAt: Date.now(),
      },
    ]);

    expect(engine.evaluate("ad123.track.com", "A").blocked).toBe(true);
    expect(engine.evaluate("adabc.track.com", "A").blocked).toBe(false);
  });

  test("should resolve local DNS records", () => {
    const engine = new FilterEngine();
    engine.setLocalRecords([
      {
        id: 1,
        domain: "nas.home",
        ipAddress: "192.168.1.150",
        recordType: "A",
        comment: "Home NAS",
        enabled: true,
        createdAt: Date.now(),
      },
    ]);

    const res = engine.evaluate("nas.home", "A");
    expect(res.blocked).toBe(false);
    expect(res.status).toBe("local");
    expect(res.localIp).toBe("192.168.1.150");
  });
});
