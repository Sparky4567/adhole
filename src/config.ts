import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export interface AppConfig {
  dnsPort: number;
  dnsHost: string;
  httpPort: number;
  httpHost: string;
  dataDir: string;
  dbPath: string;
  listsCacheDir: string;
  defaultUpstreams: string[];
  blockingMode: "ZERO_IP" | "NXDOMAIN" | "REFUSED" | "CUSTOM_IP";
  customBlockIp: string;
  cacheEnabled: boolean;
  cacheMinTtl: number;
  cacheMaxTtl: number;
  queryLogEnabled: boolean;
  queryLogMaxRows: number;
  queryLogRetentionDays: number;
  upstreamTimeoutMs: number;
  upstreamStrategy: "race" | "fallback";
  anonymizeIps: boolean;
  safeSearchGoogle: boolean;
  safeSearchBing: boolean;
  safeSearchDuckDuckGo: boolean;
  safeSearchYouTube: boolean;
}

const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const listsCacheDir = join(dataDir, "lists_cache");
if (!existsSync(listsCacheDir)) {
  mkdirSync(listsCacheDir, { recursive: true });
}

export const config: AppConfig = {
  dnsPort: parseInt(process.env.DNS_PORT || "53", 10),
  dnsHost: process.env.DNS_HOST || "0.0.0.0",
  httpPort: parseInt(process.env.HTTP_PORT || process.env.PORT || "3000", 10),
  httpHost: process.env.HTTP_HOST || "0.0.0.0",
  dataDir,
  dbPath: process.env.DB_PATH || join(dataDir, "adhole.sqlite"),
  listsCacheDir,
  defaultUpstreams: (process.env.UPSTREAM_DNS || "1.1.1.1,1.0.0.1,8.8.8.8,9.9.9.9")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  blockingMode: (process.env.BLOCKING_MODE as any) || "ZERO_IP",
  customBlockIp: process.env.CUSTOM_BLOCK_IP || "0.0.0.0",
  cacheEnabled: process.env.CACHE_ENABLED !== "false",
  cacheMinTtl: parseInt(process.env.CACHE_MIN_TTL || "60", 10),
  cacheMaxTtl: parseInt(process.env.CACHE_MAX_TTL || "86400", 10),
  queryLogEnabled: process.env.QUERY_LOG_ENABLED !== "false",
  queryLogMaxRows: parseInt(process.env.QUERY_LOG_MAX_ROWS || "250000", 10),
  queryLogRetentionDays: parseInt(process.env.QUERY_LOG_RETENTION_DAYS || "30", 10),
  upstreamTimeoutMs: parseInt(process.env.UPSTREAM_TIMEOUT_MS || "2000", 10),
  upstreamStrategy: (process.env.UPSTREAM_STRATEGY as any) || "race",
  anonymizeIps: process.env.ANONYMIZE_IPS === "true",
  safeSearchGoogle: process.env.SAFE_SEARCH_GOOGLE === "true",
  safeSearchBing: process.env.SAFE_SEARCH_BING === "true",
  safeSearchDuckDuckGo: process.env.SAFE_SEARCH_DUCKDUCKGO === "true",
  safeSearchYouTube: process.env.SAFE_SEARCH_YOUTUBE === "true",
};
