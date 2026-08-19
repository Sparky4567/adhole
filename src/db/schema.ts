export const DEFAULT_BLOCKLISTS = [
  {
    name: "Steven Black Unified Hosts",
    url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
    type: "hosts",
    enabled: 1,
  },
  {
    name: "AdGuard DNS Filter",
    url: "https://v.firebog.net/hosts/AdguardDNS.txt",
    type: "hosts",
    enabled: 1,
  },
  {
    name: "Peter Lowe's Ad Server List",
    url: "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext",
    type: "hosts",
    enabled: 1,
  },
  {
    name: "EasyPrivacy",
    url: "https://v.firebog.net/hosts/Easyprivacy.txt",
    type: "hosts",
    enabled: 1,
  },
];

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  client_ip TEXT NOT NULL,
  domain TEXT NOT NULL,
  query_type TEXT NOT NULL,
  status TEXT NOT NULL,
  upstream_server TEXT,
  response_time_ms REAL NOT NULL,
  matched_rule TEXT,
  matched_list TEXT
);

CREATE INDEX IF NOT EXISTS idx_queries_timestamp ON queries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_queries_domain ON queries(domain);
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);
CREATE INDEX IF NOT EXISTS idx_queries_client_ip ON queries(client_ip);

CREATE TABLE IF NOT EXISTS blocklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'hosts',
  domain_count INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER,
  last_status TEXT
);

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  type TEXT NOT NULL, -- 'whitelist' or 'blacklist'
  rule_kind TEXT NOT NULL DEFAULT 'exact', -- 'exact', 'wildcard', 'regex'
  comment TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS local_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'A', -- 'A' or 'AAAA'
  comment TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
