export type QueryStatus = "blocked" | "forwarded" | "cached" | "local";

export type BlockingMode = "ZERO_IP" | "NXDOMAIN" | "REFUSED" | "CUSTOM_IP";

export interface DnsLogEntry {
  id?: number;
  timestamp: number; // UNIX epoch timestamp in ms
  clientIp: string;
  domain: string;
  queryType: string; // 'A', 'AAAA', 'CNAME', 'PTR', etc.
  status: QueryStatus;
  upstreamServer?: string | null;
  responseTimeMs: number;
  matchedRule?: string | null;
  matchedList?: string | null;
}

export interface Blocklist {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  type: "hosts" | "domain" | "adblock";
  domainCount: number;
  lastUpdated: number | null;
  lastStatus: string | null;
}

export interface CustomRule {
  id: number;
  pattern: string;
  type: "whitelist" | "blacklist";
  ruleKind: "exact" | "wildcard" | "regex";
  comment: string;
  enabled: boolean;
  createdAt: number;
}

export interface LocalRecord {
  id: number;
  domain: string;
  ipAddress: string;
  recordType: "A" | "AAAA";
  comment: string;
  enabled: boolean;
  createdAt: number;
}

export interface FilterResult {
  blocked: boolean;
  status: QueryStatus;
  matchedRule?: string;
  matchedList?: string;
  localIp?: string;
  reason?: string;
}

export interface CachedResponse {
  answers: any[];
  authorities?: any[];
  additionals?: any[];
  expiresAt: number; // timestamp in ms
  created: number;
  hitCount: number;
}

export interface DashboardStats {
  totalQueriesToday: number;
  blockedQueriesToday: number;
  percentBlockedToday: number;
  uniqueDomainsToday: number;
  activeClientsToday: number;
  blocklistDomainCount: number;
  cacheHitRatio: number;
  queriesOverTime: {
    hour: string;
    total: number;
    blocked: number;
  }[];
  topBlocked: { domain: string; count: number }[];
  topPermitted: { domain: string; count: number }[];
  topClients: { clientIp: string; count: number }[];
}

export interface LiveQueryEvent {
  type: "query";
  data: DnsLogEntry;
}

export interface LiveStatsEvent {
  type: "stats";
  data: Partial<DashboardStats>;
}
