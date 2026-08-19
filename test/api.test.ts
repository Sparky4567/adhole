import { describe, expect, test } from "bun:test";
import { AdHoleDB } from "../src/db";
import { FilterEngine } from "../src/core/filter-engine";
import { ListManager } from "../src/core/list-manager";
import { DnsCache } from "../src/core/dns-cache";
import { UpstreamResolver } from "../src/core/upstream";
import { DnsServer } from "../src/core/dns-server";
import { ApiServer } from "../src/api/router";

describe("AdHole DB and API operations", () => {
  const db = new AdHoleDB(":memory:");
  const filter = new FilterEngine();
  const listManager = new ListManager(db, filter);
  const cache = new DnsCache();
  const upstream = new UpstreamResolver(["1.1.1.1:53"]);
  const dnsServer = new DnsServer(db, filter, cache, upstream);

  test("should seed default blocklists", () => {
    const lists = db.getBlocklists();
    expect(lists.length).toBeGreaterThanOrEqual(4);
    expect(lists[0].name).toContain("Steven Black");
  });

  test("should add, get and delete custom rules", () => {
    const rule = db.addRule({
      pattern: "analytics.tracker.com",
      type: "blacklist",
      ruleKind: "exact",
      comment: "Block analytics",
      enabled: true,
    });
    expect(rule.id).toBeDefined();
    expect(rule.pattern).toBe("analytics.tracker.com");

    const rules = db.getRules("blacklist");
    expect(rules.some((r) => r.pattern === "analytics.tracker.com")).toBe(true);

    const deleted = db.deleteRule(rule.id);
    expect(deleted).toBe(true);
  });

  test("should add, get and delete local DNS records", () => {
    const record = db.addLocalRecord({
      domain: "myhome.local",
      ipAddress: "192.168.1.25",
      recordType: "A",
      comment: "Raspberry Pi",
      enabled: true,
    });
    expect(record.id).toBeDefined();
    expect(record.domain).toBe("myhome.local");

    const records = db.getLocalRecords();
    expect(records.some((r) => r.domain === "myhome.local")).toBe(true);

    const deleted = db.deleteLocalRecord(record.id);
    expect(deleted).toBe(true);
  });

  test("should log and retrieve queries with pagination", () => {
    db.logQuery({
      timestamp: Date.now(),
      clientIp: "192.168.1.10",
      domain: "example.com",
      queryType: "A",
      status: "forwarded",
      responseTimeMs: 12.5,
    });
    db.logQuery({
      timestamp: Date.now(),
      clientIp: "192.168.1.10",
      domain: "ad.doubleclick.net",
      queryType: "A",
      status: "blocked",
      responseTimeMs: 0.2,
    });

    db.flushQueryBuffer();

    const result = db.getQueries({ limit: 10 });
    expect(result.total).toBe(2);
    expect(result.queries.length).toBe(2);

    const stats = db.getDashboardStats();
    expect(stats.totalQueriesToday).toBe(2);
    expect(stats.blockedQueriesToday).toBe(1);
    expect(stats.percentBlockedToday).toBe(50);
  });
});
