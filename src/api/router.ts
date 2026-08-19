import type { ServerWebSocket } from "bun";
import { config } from "../config";
import type { AdHoleDB } from "../db";
import type { DnsCache } from "../core/dns-cache";
import type { DnsServer } from "../core/dns-server";
import type { FilterEngine } from "../core/filter-engine";
import type { ListManager } from "../core/list-manager";
import type { UpstreamResolver } from "../core/upstream";
import { getDashboardHtml } from "../web/ui";
import dnsPacket from "dns-packet";

export class ApiServer {
  private db: AdHoleDB;
  private filterEngine: FilterEngine;
  private listManager: ListManager;
  private cache: DnsCache;
  private upstream: UpstreamResolver;
  private dnsServer: DnsServer;
  private server: any = null;
  private activeWs = new Set<ServerWebSocket<any>>();

  constructor(
    db: AdHoleDB,
    filterEngine: FilterEngine,
    listManager: ListManager,
    cache: DnsCache,
    upstream: UpstreamResolver,
    dnsServer: DnsServer
  ) {
    this.db = db;
    this.filterEngine = filterEngine;
    this.listManager = listManager;
    this.cache = cache;
    this.upstream = upstream;
    this.dnsServer = dnsServer;

    // Listen to live DNS queries and broadcast to WebSockets
    this.dnsServer.addQueryListener((entry) => {
      this.broadcastWs({
        type: "query",
        data: entry,
      });
    });
  }

  private broadcastWs(data: any) {
    const payload = JSON.stringify(data);
    for (const ws of this.activeWs) {
      try {
        ws.send(payload);
      } catch (e) {}
    }
  }

  public start() {
    const self = this;

    this.server = Bun.serve({
      port: config.httpPort,
      hostname: config.httpHost,
      websocket: {
        open(ws) {
          self.activeWs.add(ws);
        },
        close(ws) {
          self.activeWs.delete(ws);
        },
        message(ws, msg) {},
      },
      async fetch(req, server) {
        const url = new URL(req.url);
        const path = url.pathname;
        const method = req.method;

        // WebSocket upgrade
        if (path === "/ws/live" || path === "/ws") {
          if (server.upgrade(req)) {
            return;
          }
          return new Response("Upgrade failed", { status: 400 });
        }

        // Web Dashboard HTML
        if (path === "/" || path === "/index.html" || path === "/dashboard") {
          return new Response(getDashboardHtml(), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        // Helper JSON responses
        const json = (data: any, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });

        if (method === "OPTIONS") {
          return new Response(null, {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });
        }

        // REST API Routes
        try {
          // 1. Stats
          if (path === "/api/stats" && method === "GET") {
            const stats = self.db.getDashboardStats();
            // Also override total blocked domain count with in-memory loaded domains count
            stats.blocklistDomainCount = self.filterEngine.getBlockedDomainCount();
            return json(stats);
          }

          // 2. Queries Log
          if (path === "/api/queries" && method === "GET") {
            const page = parseInt(url.searchParams.get("page") || "1", 10);
            const limit = parseInt(url.searchParams.get("limit") || "50", 10);
            const status = url.searchParams.get("status") || "all";
            const search = url.searchParams.get("search") || "";
            const client = url.searchParams.get("client") || "";

            const result = self.db.getQueries({
              page,
              limit,
              status,
              search,
              client,
            });
            return json(result);
          }

          if (path === "/api/queries/clear" && method === "POST") {
            self.db.clearQueryLogs();
            return json({ success: true, message: "Query logs cleared" });
          }

          // 3. Blocklists / Gravity
          if (path === "/api/lists" && method === "GET") {
            const lists = self.db.getBlocklists();
            return json(lists);
          }

          if (path === "/api/lists" && method === "POST") {
            const body = await req.json();
            if (!body.url || !body.name) {
              return json({ error: "Name and URL are required" }, 400);
            }
            const newList = self.db.addBlocklist(body);
            return json(newList, 201);
          }

          if (path.startsWith("/api/lists/") && method === "PUT") {
            const id = parseInt(path.split("/")[3], 10);
            const body = await req.json();
            const updated = self.db.updateBlocklist(id, body);
            if (!updated) return json({ error: "List not found" }, 404);
            return json(updated);
          }

          if (path.startsWith("/api/lists/") && method === "DELETE") {
            const id = parseInt(path.split("/")[3], 10);
            const deleted = self.db.deleteBlocklist(id);
            return json({ success: deleted });
          }

          // Update Gravity
          if (path === "/api/gravity/update" && method === "POST") {
            const result = await self.listManager.updateGravity((progress) => {
              self.broadcastWs({
                type: "gravity-progress",
                data: progress,
              });
            });
            return json(result);
          }

          // 4. Custom Rules
          if (path === "/api/rules" && method === "GET") {
            const type = url.searchParams.get("type") as any;
            const rules = self.db.getRules(type);
            return json(rules);
          }

          if (path === "/api/rules" && method === "POST") {
            const body = await req.json();
            if (!body.pattern || !body.type) {
              return json({ error: "Pattern and Type are required" }, 400);
            }
            const newRule = self.db.addRule(body);
            self.listManager.reloadRulesAndRecords();
            return json(newRule, 201);
          }

          if (path.startsWith("/api/rules/") && method === "PUT") {
            const id = parseInt(path.split("/")[3], 10);
            const body = await req.json();
            const updated = self.db.updateRule(id, body);
            if (!updated) return json({ error: "Rule not found" }, 404);
            self.listManager.reloadRulesAndRecords();
            return json(updated);
          }

          if (path.startsWith("/api/rules/") && method === "DELETE") {
            const id = parseInt(path.split("/")[3], 10);
            const deleted = self.db.deleteRule(id);
            self.listManager.reloadRulesAndRecords();
            return json({ success: deleted });
          }

          // 5. Local DNS Records
          if (path === "/api/records" && method === "GET") {
            const records = self.db.getLocalRecords();
            return json(records);
          }

          if (path === "/api/records" && method === "POST") {
            const body = await req.json();
            if (!body.domain || !body.ipAddress) {
              return json({ error: "Domain and IP Address are required" }, 400);
            }
            const newRec = self.db.addLocalRecord(body);
            self.listManager.reloadRulesAndRecords();
            return json(newRec, 201);
          }

          if (path.startsWith("/api/records/") && method === "DELETE") {
            const id = parseInt(path.split("/")[3], 10);
            const deleted = self.db.deleteLocalRecord(id);
            self.listManager.reloadRulesAndRecords();
            return json({ success: deleted });
          }

          // 6. Settings
          if (path === "/api/settings" && method === "GET") {
            return json({
              dnsPort: self.dnsServer.actualDnsPort,
              httpPort: config.httpPort,
              upstreams: self.upstream.getUpstreams(),
              upstreamStrategy: config.upstreamStrategy,
              blockingMode: config.blockingMode,
              customBlockIp: config.customBlockIp,
              cacheEnabled: config.cacheEnabled,
              cacheMinTtl: config.cacheMinTtl,
              cacheMaxTtl: config.cacheMaxTtl,
              anonymizeIps: config.anonymizeIps,
              safeSearchGoogle: config.safeSearchGoogle,
              safeSearchBing: config.safeSearchBing,
              safeSearchDuckDuckGo: config.safeSearchDuckDuckGo,
              safeSearchYouTube: config.safeSearchYouTube,
            });
          }

          if (path === "/api/settings" && method === "POST") {
            const body = await req.json();
            if (Array.isArray(body.upstreams)) {
              self.upstream.setUpstreams(body.upstreams);
              self.db.setSetting("upstreams", JSON.stringify(body.upstreams));
            }
            if (body.upstreamStrategy) {
              config.upstreamStrategy = body.upstreamStrategy;
              self.db.setSetting("upstreamStrategy", body.upstreamStrategy);
            }
            if (body.blockingMode) {
              config.blockingMode = body.blockingMode;
              self.db.setSetting("blockingMode", body.blockingMode);
            }
            if (body.customBlockIp !== undefined) {
              config.customBlockIp = body.customBlockIp;
              self.db.setSetting("customBlockIp", body.customBlockIp);
            }
            if (body.safeSearchGoogle !== undefined) {
              config.safeSearchGoogle = Boolean(body.safeSearchGoogle);
              self.db.setSetting("safeSearchGoogle", String(body.safeSearchGoogle));
            }
            if (body.safeSearchBing !== undefined) {
              config.safeSearchBing = Boolean(body.safeSearchBing);
              self.db.setSetting("safeSearchBing", String(body.safeSearchBing));
            }
            if (body.safeSearchYouTube !== undefined) {
              config.safeSearchYouTube = Boolean(body.safeSearchYouTube);
              self.db.setSetting("safeSearchYouTube", String(body.safeSearchYouTube));
            }
            if (body.anonymizeIps !== undefined) {
              config.anonymizeIps = Boolean(body.anonymizeIps);
              self.db.setSetting("anonymizeIps", String(body.anonymizeIps));
            }

            return json({ success: true, message: "Settings saved" });
          }

          // 7. Flush DNS Cache
          if (path === "/api/cache/flush" && method === "POST") {
            self.cache.flush();
            return json({ success: true, message: "DNS cache flushed" });
          }

          // 8. DNS Diagnostic Lookup
          if (path === "/api/lookup" && method === "GET") {
            const domain = (url.searchParams.get("domain") || "").trim().toLowerCase();
            const queryType = (url.searchParams.get("type") || "A").toUpperCase();

            if (!domain) {
              return json({ error: "Domain parameter is required" }, 400);
            }

            const startTime = performance.now();
            const filterRes = self.filterEngine.evaluate(domain, queryType);

            let resolvedIp: string | null = null;
            let responseTimeMs = 0;

            if (filterRes.status === "local" && filterRes.localIp) {
              resolvedIp = filterRes.localIp;
              responseTimeMs = Math.round((performance.now() - startTime) * 10) / 10;
            } else if (filterRes.blocked) {
              resolvedIp = config.blockingMode === "CUSTOM_IP" ? config.customBlockIp : "0.0.0.0";
              responseTimeMs = Math.round((performance.now() - startTime) * 10) / 10;
            } else {
              // Test upstream query
              try {
                const queryPacket: dnsPacket.Packet = {
                  type: "query",
                  id: Math.floor(Math.random() * 65535),
                  flags: dnsPacket.RECURSION_DESIRED,
                  questions: [{ type: queryType as any, name: domain }],
                };
                const upstreamRes = await self.upstream.resolve(queryPacket);
                responseTimeMs = upstreamRes.responseTimeMs;
                if (upstreamRes.packet.answers && upstreamRes.packet.answers.length > 0) {
                  const firstAns = upstreamRes.packet.answers[0];
                  resolvedIp = firstAns.data || firstAns.name || JSON.stringify(firstAns);
                }
              } catch (e: any) {
                resolvedIp = `Error: ${e.message}`;
              }
            }

            return json({
              domain,
              queryType,
              blocked: filterRes.blocked,
              status: filterRes.status,
              reason: filterRes.reason,
              matchedRule: filterRes.matchedRule,
              matchedList: filterRes.matchedList,
              resolvedIp,
              responseTimeMs,
            });
          }

          // 9. System status
          if (path === "/api/system" && method === "GET") {
            return json({
              version: "1.0.0",
              bunVersion: Bun.version,
              memory: process.memoryUsage(),
              uptime: process.uptime(),
              dnsPort: self.dnsServer.actualDnsPort,
              httpPort: config.httpPort,
              cacheStats: self.cache.getStats(),
            });
          }

          return json({ error: "Endpoint not found" }, 404);
        } catch (err: any) {
          console.error("API error:", err);
          return json({ error: err.message || "Internal server error" }, 500);
        }
      },
    });

    console.log(
      `🌐 AdHole Web Dashboard & API running at http://${config.httpHost === "0.0.0.0" ? "localhost" : config.httpHost}:${config.httpPort}`
    );
  }

  public stop() {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }
}
