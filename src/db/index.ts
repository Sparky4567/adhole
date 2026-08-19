import { Database } from "bun:sqlite";
import { config } from "../config";
import { CREATE_TABLES_SQL, DEFAULT_BLOCKLISTS } from "./schema";
import type {
  Blocklist,
  CustomRule,
  DashboardStats,
  DnsLogEntry,
  LocalRecord,
} from "../core/types";

export class AdHoleDB {
  private db: Database;
  private insertQueryStmt: any;
  private logBuffer: DnsLogEntry[] = [];
  private flushTimer: any = null;

  constructor(dbPath: string = config.dbPath) {
    this.db = new Database(dbPath);
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA synchronous = NORMAL;");
    this.db.run("PRAGMA foreign_keys = ON;");
    this.init();
  }

  private init() {
    this.db.exec(CREATE_TABLES_SQL);

    // Check if blocklists table is empty, if so seed defaults
    const count = this.db
      .query("SELECT COUNT(*) as count FROM blocklists")
      .get() as { count: number };

    if (count.count === 0) {
      const insert = this.db.prepare(
        "INSERT INTO blocklists (name, url, type, enabled) VALUES ($name, $url, $type, $enabled)"
      );
      for (const list of DEFAULT_BLOCKLISTS) {
        insert.run({
          $name: list.name,
          $url: list.url,
          $type: list.type,
          $enabled: list.enabled,
        });
      }
    }

    this.insertQueryStmt = this.db.prepare(`
      INSERT INTO queries (timestamp, client_ip, domain, query_type, status, upstream_server, response_time_ms, matched_rule, matched_list)
      VALUES ($timestamp, $client_ip, $domain, $query_type, $status, $upstream_server, $response_time_ms, $matched_rule, $matched_list)
    `);

    // Setup periodic flush every 300ms for buffered queries
    this.flushTimer = setInterval(() => {
      this.flushQueryBuffer();
    }, 300);
  }

  // Close database cleanly
  public close() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushQueryBuffer();
    this.db.close();
  }

  // Buffered query logging for high throughput
  public logQuery(entry: DnsLogEntry) {
    if (!config.queryLogEnabled) return;
    this.logBuffer.push(entry);
    if (this.logBuffer.length >= 100) {
      this.flushQueryBuffer();
    }
  }

  public flushQueryBuffer() {
    if (this.logBuffer.length === 0) return;
    const entries = this.logBuffer;
    this.logBuffer = [];

    const transaction = this.db.transaction((items: DnsLogEntry[]) => {
      for (const item of items) {
        this.insertQueryStmt.run({
          $timestamp: item.timestamp,
          $client_ip: item.clientIp,
          $domain: item.domain,
          $query_type: item.queryType,
          $status: item.status,
          $upstream_server: item.upstreamServer || null,
          $response_time_ms: item.responseTimeMs,
          $matched_rule: item.matchedRule || null,
          $matched_list: item.matchedList || null,
        });
      }
    });

    try {
      transaction(entries);
    } catch (e) {
      console.error("AdHole: Error flushing query log buffer to DB", e);
    }
  }

  // Get recent queries with pagination & filtering
  public getQueries(options: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    client?: string;
    since?: number;
  }) {
    this.flushQueryBuffer();
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(500, Math.max(1, options.limit || 50));
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    const params: Record<string, any> = {};

    if (options.status && options.status !== "all") {
      whereClauses.push("status = $status");
      params.$status = options.status;
    }
    if (options.search) {
      whereClauses.push("domain LIKE $search");
      params.$search = `%${options.search}%`;
    }
    if (options.client) {
      whereClauses.push("client_ip = $client");
      params.$client = options.client;
    }
    if (options.since) {
      whereClauses.push("timestamp >= $since");
      params.$since = options.since;
    }

    const whereSql =
      whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    const totalRow = this.db
      .query(`SELECT COUNT(*) as total FROM queries ${whereSql}`)
      .get(params) as { total: number };

    const rows = this.db
      .query(
        `SELECT id, timestamp, client_ip as clientIp, domain, query_type as queryType, 
                status, upstream_server as upstreamServer, response_time_ms as responseTimeMs, 
                matched_rule as matchedRule, matched_list as matchedList
         FROM queries ${whereSql}
         ORDER BY timestamp DESC
         LIMIT $limit OFFSET $offset`
      )
      .all({ ...params, $limit: limit, $offset: offset }) as DnsLogEntry[];

    return {
      total: totalRow.total,
      page,
      limit,
      totalPages: Math.ceil(totalRow.total / limit) || 1,
      queries: rows,
    };
  }

  // Clear query log history
  public clearQueryLogs() {
    this.logBuffer = [];
    this.db.run("DELETE FROM queries");
    this.db.run("VACUUM");
  }

  // Retention cleanup
  public runRetentionCleanup() {
    const cutoff =
      Date.now() - config.queryLogRetentionDays * 24 * 60 * 60 * 1000;
    this.db.run("DELETE FROM queries WHERE timestamp < ?", [cutoff]);

    // Also limit max rows if exceeding
    const countRow = this.db
      .query("SELECT COUNT(*) as count FROM queries")
      .get() as { count: number };
    if (countRow.count > config.queryLogMaxRows) {
      const excess = countRow.count - config.queryLogMaxRows;
      this.db.run(
        `DELETE FROM queries WHERE id IN (SELECT id FROM queries ORDER BY timestamp ASC LIMIT ?)`,
        [excess]
      );
    }
  }

  // Blocklists CRUD
  public getBlocklists(): Blocklist[] {
    return this.db
      .query(
        `SELECT id, name, url, enabled, type, domain_count as domainCount, last_updated as lastUpdated, last_status as lastStatus
         FROM blocklists ORDER BY id ASC`
      )
      .all()
      .map((row: any) => ({
        ...row,
        enabled: Boolean(row.enabled),
      }));
  }

  public getEnabledBlocklists(): Blocklist[] {
    return this.getBlocklists().filter((b) => b.enabled);
  }

  public addBlocklist(list: {
    name: string;
    url: string;
    type?: "hosts" | "domain" | "adblock";
    enabled?: boolean;
  }): Blocklist {
    const stmt = this.db.prepare(`
      INSERT INTO blocklists (name, url, type, enabled, domain_count)
      VALUES ($name, $url, $type, $enabled, 0)
      RETURNING id, name, url, enabled, type, domain_count as domainCount, last_updated as lastUpdated, last_status as lastStatus
    `);
    const row: any = stmt.get({
      $name: list.name,
      $url: list.url,
      $type: list.type || "hosts",
      $enabled: list.enabled !== false ? 1 : 0,
    });
    return { ...row, enabled: Boolean(row.enabled) };
  }

  public updateBlocklist(
    id: number,
    updates: Partial<Blocklist>
  ): Blocklist | null {
    const current = this.db
      .query("SELECT * FROM blocklists WHERE id = ?")
      .get(id) as any;
    if (!current) return null;

    const name = updates.name !== undefined ? updates.name : current.name;
    const url = updates.url !== undefined ? updates.url : current.url;
    const enabled =
      updates.enabled !== undefined
        ? updates.enabled
          ? 1
          : 0
        : current.enabled;
    const type = updates.type !== undefined ? updates.type : current.type;
    const domainCount =
      updates.domainCount !== undefined
        ? updates.domainCount
        : current.domain_count;
    const lastUpdated =
      updates.lastUpdated !== undefined
        ? updates.lastUpdated
        : current.last_updated;
    const lastStatus =
      updates.lastStatus !== undefined
        ? updates.lastStatus
        : current.last_status;

    this.db.run(
      `UPDATE blocklists 
       SET name = ?, url = ?, enabled = ?, type = ?, domain_count = ?, last_updated = ?, last_status = ?
       WHERE id = ?`,
      [name, url, enabled, type, domainCount, lastUpdated, lastStatus, id]
    );

    return {
      id,
      name,
      url,
      enabled: Boolean(enabled),
      type,
      domainCount,
      lastUpdated,
      lastStatus,
    };
  }

  public deleteBlocklist(id: number): boolean {
    const res = this.db.run("DELETE FROM blocklists WHERE id = ?", [id]);
    return res.changes > 0;
  }

  // Custom Rules CRUD (Whitelist & Blacklist)
  public getRules(type?: "whitelist" | "blacklist"): CustomRule[] {
    let sql = `SELECT id, pattern, type, rule_kind as ruleKind, comment, enabled, created_at as createdAt FROM rules`;
    let params: any[] = [];
    if (type) {
      sql += ` WHERE type = ?`;
      params.push(type);
    }
    sql += ` ORDER BY created_at DESC`;

    return this.db
      .query(sql)
      .all(...params)
      .map((row: any) => ({
        ...row,
        enabled: Boolean(row.enabled),
      }));
  }

  public addRule(rule: {
    pattern: string;
    type: "whitelist" | "blacklist";
    ruleKind?: "exact" | "wildcard" | "regex";
    comment?: string;
    enabled?: boolean;
  }): CustomRule {
    const pattern = rule.pattern.trim().toLowerCase();
    const ruleKind = rule.ruleKind || (pattern.includes("*") ? "wildcard" : "exact");
    const stmt = this.db.prepare(`
      INSERT INTO rules (pattern, type, rule_kind, comment, enabled, created_at)
      VALUES ($pattern, $type, $rule_kind, $comment, $enabled, $created_at)
      RETURNING id, pattern, type, rule_kind as ruleKind, comment, enabled, created_at as createdAt
    `);
    const row: any = stmt.get({
      $pattern: pattern,
      $type: rule.type,
      $rule_kind: ruleKind,
      $comment: rule.comment || "",
      $enabled: rule.enabled !== false ? 1 : 0,
      $created_at: Date.now(),
    });
    return { ...row, enabled: Boolean(row.enabled) };
  }

  public updateRule(id: number, updates: Partial<CustomRule>): CustomRule | null {
    const current = this.db
      .query("SELECT * FROM rules WHERE id = ?")
      .get(id) as any;
    if (!current) return null;

    const pattern = updates.pattern || current.pattern;
    const type = updates.type || current.type;
    const ruleKind = updates.ruleKind || current.rule_kind;
    const comment =
      updates.comment !== undefined ? updates.comment : current.comment;
    const enabled =
      updates.enabled !== undefined
        ? updates.enabled
          ? 1
          : 0
        : current.enabled;

    this.db.run(
      `UPDATE rules SET pattern = ?, type = ?, rule_kind = ?, comment = ?, enabled = ? WHERE id = ?`,
      [pattern, type, ruleKind, comment, enabled, id]
    );

    return {
      id,
      pattern,
      type,
      ruleKind,
      comment,
      enabled: Boolean(enabled),
      createdAt: current.created_at,
    };
  }

  public deleteRule(id: number): boolean {
    const res = this.db.run("DELETE FROM rules WHERE id = ?", [id]);
    return res.changes > 0;
  }

  // Local Records CRUD
  public getLocalRecords(): LocalRecord[] {
    return this.db
      .query(
        `SELECT id, domain, ip_address as ipAddress, record_type as recordType, comment, enabled, created_at as createdAt 
         FROM local_records ORDER BY domain ASC`
      )
      .all()
      .map((row: any) => ({
        ...row,
        enabled: Boolean(row.enabled),
      }));
  }

  public addLocalRecord(record: {
    domain: string;
    ipAddress: string;
    recordType?: "A" | "AAAA";
    comment?: string;
    enabled?: boolean;
  }): LocalRecord {
    const stmt = this.db.prepare(`
      INSERT INTO local_records (domain, ip_address, record_type, comment, enabled, created_at)
      VALUES ($domain, $ip_address, $record_type, $comment, $enabled, $created_at)
      RETURNING id, domain, ip_address as ipAddress, record_type as recordType, comment, enabled, created_at as createdAt
    `);
    const row: any = stmt.get({
      $domain: record.domain.trim().toLowerCase(),
      $ip_address: record.ipAddress.trim(),
      $record_type: record.recordType || (record.ipAddress.includes(":") ? "AAAA" : "A"),
      $comment: record.comment || "",
      $enabled: record.enabled !== false ? 1 : 0,
      $created_at: Date.now(),
    });
    return { ...row, enabled: Boolean(row.enabled) };
  }

  public deleteLocalRecord(id: number): boolean {
    const res = this.db.run("DELETE FROM local_records WHERE id = ?", [id]);
    return res.changes > 0;
  }

  // Settings
  public getSetting(key: string, defaultValue: string = ""): string {
    const row = this.db
      .query("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | null;
    return row ? row.value : defaultValue;
  }

  public setSetting(key: string, value: string) {
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value]
    );
  }

  public getAllSettings(): Record<string, string> {
    const rows = this.db.query("SELECT key, value FROM settings").all() as {
      key: string;
      value: string;
    }[];
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return map;
  }

  // Dashboard Stats Aggregation
  public getDashboardStats(): DashboardStats {
    this.flushQueryBuffer();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTs = startOfToday.getTime();

    // Today query totals
    const todayCounts = this.db
      .query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
           SUM(CASE WHEN status = 'cached' THEN 1 ELSE 0 END) as cached,
           COUNT(DISTINCT domain) as unique_domains,
           COUNT(DISTINCT client_ip) as active_clients
         FROM queries WHERE timestamp >= ?`
      )
      .get(todayTs) as any;

    const totalToday = todayCounts?.total || 0;
    const blockedToday = todayCounts?.blocked || 0;
    const cachedToday = todayCounts?.cached || 0;
    const uniqueDomainsToday = todayCounts?.unique_domains || 0;
    const activeClientsToday = todayCounts?.active_clients || 0;

    const percentBlocked =
      totalToday > 0 ? Math.round((blockedToday / totalToday) * 1000) / 10 : 0;
    const cacheHitRatio =
      totalToday > 0 ? Math.round((cachedToday / totalToday) * 1000) / 10 : 0;

    // Blocklist total domain count
    const listCountRow = this.db
      .query(
        `SELECT SUM(domain_count) as total_domains FROM blocklists WHERE enabled = 1`
      )
      .get() as any;
    const blocklistDomainCount = listCountRow?.total_domains || 0;

    // Queries over the last 24 hours (grouped by hour)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const hourlyRows = this.db
      .query(
        `SELECT 
           strftime('%H:00', datetime(timestamp / 1000, 'unixepoch', 'localtime')) as hour,
           COUNT(*) as total,
           SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
         FROM queries
         WHERE timestamp >= ?
         GROUP BY strftime('%Y-%m-%d %H', datetime(timestamp / 1000, 'unixepoch', 'localtime'))
         ORDER BY timestamp ASC`
      )
      .all(twentyFourHoursAgo) as { hour: string; total: number; blocked: number }[];

    // Top 10 Blocked domains (last 24 hours)
    const topBlocked = this.db
      .query(
        `SELECT domain, COUNT(*) as count
         FROM queries
         WHERE status = 'blocked' AND timestamp >= ?
         GROUP BY domain
         ORDER BY count DESC
         LIMIT 10`
      )
      .all(twentyFourHoursAgo) as { domain: string; count: number }[];

    // Top 10 Permitted domains (last 24 hours)
    const topPermitted = this.db
      .query(
        `SELECT domain, COUNT(*) as count
         FROM queries
         WHERE status != 'blocked' AND timestamp >= ?
         GROUP BY domain
         ORDER BY count DESC
         LIMIT 10`
      )
      .all(twentyFourHoursAgo) as { domain: string; count: number }[];

    // Top 10 Clients (last 24 hours)
    const topClients = this.db
      .query(
        `SELECT client_ip as clientIp, COUNT(*) as count
         FROM queries
         WHERE timestamp >= ?
         GROUP BY client_ip
         ORDER BY count DESC
         LIMIT 10`
      )
      .all(twentyFourHoursAgo) as { clientIp: string; count: number }[];

    return {
      totalQueriesToday: totalToday,
      blockedQueriesToday: blockedToday,
      percentBlockedToday: percentBlocked,
      uniqueDomainsToday,
      activeClientsToday,
      blocklistDomainCount,
      cacheHitRatio,
      queriesOverTime: hourlyRows,
      topBlocked,
      topPermitted,
      topClients,
    };
  }
}
