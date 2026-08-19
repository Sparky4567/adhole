import { config } from "./config";
import { AdHoleDB } from "./db";
import { FilterEngine } from "./core/filter-engine";
import { ListManager } from "./core/list-manager";
import { DnsCache } from "./core/dns-cache";
import { UpstreamResolver } from "./core/upstream";
import { DnsServer } from "./core/dns-server";
import { ApiServer } from "./api/router";

export async function bootstrap() {
  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║                   🛡️  AdHole DNS Server                     ║
  ║           High-Performance Pi-hole Alternative in Bun        ║
  ╚══════════════════════════════════════════════════════════════╝
  `);

  // 1. Initialize DB
  const db = new AdHoleDB(config.dbPath);

  // 2. Load DB Settings overrides if present
  const savedUpstreams = db.getSetting("upstreams");
  let activeUpstreams = config.defaultUpstreams;
  if (savedUpstreams) {
    try {
      activeUpstreams = JSON.parse(savedUpstreams);
    } catch (e) {}
  }

  const savedMode = db.getSetting("blockingMode");
  if (savedMode) config.blockingMode = savedMode as any;

  const savedStrategy = db.getSetting("upstreamStrategy");
  if (savedStrategy) config.upstreamStrategy = savedStrategy as any;

  const savedGoogleSS = db.getSetting("safeSearchGoogle");
  if (savedGoogleSS) config.safeSearchGoogle = savedGoogleSS === "true";

  const savedBingSS = db.getSetting("safeSearchBing");
  if (savedBingSS) config.safeSearchBing = savedBingSS === "true";

  const savedYouTubeSS = db.getSetting("safeSearchYouTube");
  if (savedYouTubeSS) config.safeSearchYouTube = savedYouTubeSS === "true";

  const savedAnonIps = db.getSetting("anonymizeIps");
  if (savedAnonIps) config.anonymizeIps = savedAnonIps === "true";

  // 3. Initialize Core Engines
  const filterEngine = new FilterEngine();
  const listManager = new ListManager(db, filterEngine);
  const cache = new DnsCache();
  const upstream = new UpstreamResolver(activeUpstreams);
  const dnsServer = new DnsServer(db, filterEngine, cache, upstream);
  const apiServer = new ApiServer(
    db,
    filterEngine,
    listManager,
    cache,
    upstream,
    dnsServer
  );

  // 4. Load cached lists and rules
  const cachedDomainsCount = listManager.loadFromCache();
  if (cachedDomainsCount > 0) {
    console.log(
      `📦 Loaded ${cachedDomainsCount.toLocaleString()} blocked domains from cache.`
    );
  } else {
    console.log(
      `📦 Initializing Gravity list cache... Downloading default blocklists.`
    );
    // Background download on first start
    listManager
      .updateGravity((p) => {
        if (p.stage === "done" || p.stage === "error") {
          console.log(`[Gravity] ${p.message}`);
        }
      })
      .catch((err) => {
        console.warn(`[Gravity] Initial update warning:`, err.message);
      });
  }

  // 5. Start DNS Server
  const actualDnsPort = await dnsServer.start();
  console.log(`📡 DNS Server listening on port ${actualDnsPort} (UDP & TCP)`);

  // 6. Start Web UI & API Server
  apiServer.start();

  console.log(`
  ══════════════════════════════════════════════════════════════
  🚀 AdHole is ready!
  • Web Dashboard: http://localhost:${config.httpPort}
  • DNS Resolver:  127.0.0.1:${actualDnsPort}
  • Upstream DNS:  ${upstream.getUpstreams().join(", ")}
  • Blocking Mode: ${config.blockingMode}
  ══════════════════════════════════════════════════════════════
  `);

  // 7. Cleanup routine every 6 hours
  setInterval(() => {
    try {
      db.runRetentionCleanup();
    } catch (e) {}
  }, 6 * 60 * 60 * 1000);

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n🛑 Stopping AdHole...");
    dnsServer.stop();
    apiServer.stop();
    cache.close();
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return { db, filterEngine, listManager, cache, upstream, dnsServer, apiServer };
}

if (import.meta.main) {
  bootstrap().catch((err) => {
    console.error("Fatal error starting AdHole:", err);
    process.exit(1);
  });
}
