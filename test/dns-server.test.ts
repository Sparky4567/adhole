import { describe, expect, test } from "bun:test";
import dnsPacket from "dns-packet";
import { FilterEngine } from "../src/core/filter-engine";
import { DnsCache } from "../src/core/dns-cache";
import { UpstreamResolver } from "../src/core/upstream";
import { DnsServer } from "../src/core/dns-server";
import { AdHoleDB } from "../src/db";

describe("DnsServer Packet Resolution", () => {
  const db = new AdHoleDB(":memory:");
  const filter = new FilterEngine();
  const cache = new DnsCache();
  const upstream = new UpstreamResolver(["1.1.1.1:53"]);
  const server = new DnsServer(db, filter, cache, upstream);

  test("should return 0.0.0.0 for blocked A record query", async () => {
    const map = new Map<string, string>();
    map.set("ad.tracker.com", "Test Blocklist");
    filter.setBlocklistDomains(map);

    const queryPacket: dnsPacket.Packet = {
      type: "query",
      id: 1001,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{ type: "A", name: "ad.tracker.com" }],
    };

    const response = await server.handleQuery(queryPacket, "192.168.1.50");
    expect(response).not.toBeNull();
    expect(response?.id).toBe(1001);
    expect(response?.answers?.length).toBe(1);
    expect(response?.answers?.[0].data).toBe("0.0.0.0");
  });

  test("should return local IP for local DNS records", async () => {
    filter.setLocalRecords([
      {
        id: 1,
        domain: "router.lan",
        ipAddress: "192.168.1.1",
        recordType: "A",
        comment: "",
        enabled: true,
        createdAt: Date.now(),
      },
    ]);

    const queryPacket: dnsPacket.Packet = {
      type: "query",
      id: 1002,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{ type: "A", name: "router.lan" }],
    };

    const response = await server.handleQuery(queryPacket, "192.168.1.50");
    expect(response?.answers?.length).toBe(1);
    expect(response?.answers?.[0].data).toBe("192.168.1.1");
  });

  test("should serve from cache on repeated allowed query", async () => {
    cache.set("cached-example.org", "A", [
      { name: "cached-example.org", type: "A", ttl: 300, data: "99.88.77.66" },
    ]);

    const queryPacket: dnsPacket.Packet = {
      type: "query",
      id: 1003,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{ type: "A", name: "cached-example.org" }],
    };

    const response = await server.handleQuery(queryPacket, "192.168.1.50");
    expect(response?.answers?.length).toBe(1);
    expect(response?.answers?.[0].data).toBe("99.88.77.66");
  });
});
