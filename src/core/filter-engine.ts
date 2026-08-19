import { config } from "../config";
import type { CustomRule, FilterResult, LocalRecord } from "./types";

const SAFESEARCH_IPS = {
  google: "216.239.38.120", // forcesafesearch.google.com
  bing: "204.79.197.220", // strict.bing.com
  duckduckgo: "52.142.124.215", // safe.duckduckgo.com
  youtube: "216.239.38.119", // restrict.youtube.com
};

export class FilterEngine {
  // Blocklist exact domains & source tracking
  private blockedDomains = new Set<string>();
  private domainSourceMap = new Map<string, string>(); // domain -> list name

  // Custom Exact Rules
  private exactBlacklist = new Set<string>();
  private exactWhitelist = new Set<string>();

  // Custom Wildcard & Regex Rules
  private wildcardBlacklist: { pattern: string; regex: RegExp }[] = [];
  private wildcardWhitelist: { pattern: string; regex: RegExp }[] = [];
  private regexBlacklist: { pattern: string; regex: RegExp }[] = [];
  private regexWhitelist: { pattern: string; regex: RegExp }[] = [];

  // Local DNS Records: domain -> { ipAddress, recordType }
  private localRecords = new Map<string, { ipAddress: string; recordType: "A" | "AAAA" }>();

  constructor() {}

  // Set local DNS records
  public setLocalRecords(records: LocalRecord[]) {
    this.localRecords.clear();
    for (const rec of records) {
      if (rec.enabled) {
        this.localRecords.set(rec.domain.toLowerCase(), {
          ipAddress: rec.ipAddress,
          recordType: rec.recordType,
        });
      }
    }
  }

  // Set custom user rules (whitelist / blacklist)
  public setCustomRules(rules: CustomRule[]) {
    this.exactBlacklist.clear();
    this.exactWhitelist.clear();
    this.wildcardBlacklist = [];
    this.wildcardWhitelist = [];
    this.regexBlacklist = [];
    this.regexWhitelist = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;
      const pattern = rule.pattern.toLowerCase().trim();

      if (rule.type === "whitelist") {
        if (rule.ruleKind === "exact") {
          this.exactWhitelist.add(pattern);
        } else if (rule.ruleKind === "wildcard") {
          const regex = this.wildcardToRegex(pattern);
          this.wildcardWhitelist.push({ pattern, regex });
        } else if (rule.ruleKind === "regex") {
          try {
            const regex = new RegExp(pattern, "i");
            this.regexWhitelist.push({ pattern, regex });
          } catch (e) {
            console.error(`Invalid whitelist regex pattern: ${pattern}`, e);
          }
        }
      } else if (rule.type === "blacklist") {
        if (rule.ruleKind === "exact") {
          this.exactBlacklist.add(pattern);
        } else if (rule.ruleKind === "wildcard") {
          const regex = this.wildcardToRegex(pattern);
          this.wildcardBlacklist.push({ pattern, regex });
        } else if (rule.ruleKind === "regex") {
          try {
            const regex = new RegExp(pattern, "i");
            this.regexBlacklist.push({ pattern, regex });
          } catch (e) {
            console.error(`Invalid blacklist regex pattern: ${pattern}`, e);
          }
        }
      }
    }
  }

  // Load downloaded blocklists domains into in-memory Set
  public setBlocklistDomains(
    domainsMap: Map<string, string> // domain -> source list name
  ) {
    this.blockedDomains = new Set(domainsMap.keys());
    this.domainSourceMap = domainsMap;
  }

  public getBlockedDomainCount(): number {
    return this.blockedDomains.size;
  }

  // Convert wildcard domain (e.g. *.example.com or *analytics*) to RegExp
  private wildcardToRegex(wildcard: string): RegExp {
    const escaped = wildcard
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i");
  }

  // Check if a domain is whitelisted
  public isWhitelisted(domain: string): { whitelisted: boolean; rule?: string } {
    const d = domain.toLowerCase();

    // 1. Exact Whitelist
    if (this.exactWhitelist.has(d)) {
      return { whitelisted: true, rule: `Whitelist (Exact: ${d})` };
    }

    // Check parent domains for exact whitelist (e.g., if example.com is whitelisted, sub.example.com is whitelisted)
    const parts = d.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join(".");
      if (this.exactWhitelist.has(parent)) {
        return { whitelisted: true, rule: `Whitelist (Parent: ${parent})` };
      }
    }

    // 2. Wildcard Whitelist
    for (const item of this.wildcardWhitelist) {
      if (item.regex.test(d)) {
        return { whitelisted: true, rule: `Whitelist (Wildcard: ${item.pattern})` };
      }
    }

    // 3. Regex Whitelist
    for (const item of this.regexWhitelist) {
      if (item.regex.test(d)) {
        return { whitelisted: true, rule: `Whitelist (Regex: ${item.pattern})` };
      }
    }

    return { whitelisted: false };
  }

  // Check SafeSearch rewrites
  private checkSafeSearch(domain: string, queryType: string): string | null {
    if (queryType !== "A") return null;
    const d = domain.toLowerCase();

    if (config.safeSearchGoogle && (d === "google.com" || d.endsWith(".google.com") || d.includes("google."))) {
      if (!d.startsWith("forcesafesearch.")) {
        return SAFESEARCH_IPS.google;
      }
    }

    if (config.safeSearchBing && (d === "bing.com" || d.endsWith(".bing.com"))) {
      return SAFESEARCH_IPS.bing;
    }

    if (config.safeSearchDuckDuckGo && (d === "duckduckgo.com" || d.endsWith(".duckduckgo.com"))) {
      return SAFESEARCH_IPS.duckduckgo;
    }

    if (
      config.safeSearchYouTube &&
      (d === "youtube.com" || d.endsWith(".youtube.com") || d.endsWith(".googlevideo.com") || d.endsWith(".googleapis.com"))
    ) {
      if (d.includes("youtube") || d.includes("googlevideo")) {
        return SAFESEARCH_IPS.youtube;
      }
    }

    return null;
  }

  // Core filter decision: evaluate a domain query
  public evaluate(domain: string, queryType: string = "A"): FilterResult {
    const d = domain.toLowerCase().replace(/\.$/, "");

    // 1. Check Local DNS Records
    const local = this.localRecords.get(d);
    if (local) {
      if (queryType === "A" && local.recordType === "A") {
        return {
          blocked: false,
          status: "local",
          localIp: local.ipAddress,
          reason: "Local DNS Record",
        };
      }
      if (queryType === "AAAA" && local.recordType === "AAAA") {
        return {
          blocked: false,
          status: "local",
          localIp: local.ipAddress,
          reason: "Local DNS Record",
        };
      }
      if (local.ipAddress) {
        return {
          blocked: false,
          status: "local",
          localIp: local.ipAddress,
          reason: "Local DNS Record",
        };
      }
    }

    // 2. SafeSearch Override
    const safeSearchIp = this.checkSafeSearch(d, queryType);
    if (safeSearchIp) {
      return {
        blocked: false,
        status: "local",
        localIp: safeSearchIp,
        reason: "SafeSearch Enforcement",
      };
    }

    // 3. Whitelist check (Takes precedence over all blocklists and blacklist rules)
    const whitelistCheck = this.isWhitelisted(d);
    if (whitelistCheck.whitelisted) {
      return {
        blocked: false,
        status: "forwarded",
        reason: whitelistCheck.rule,
      };
    }

    // 4. Custom Blacklist Exact
    if (this.exactBlacklist.has(d)) {
      return {
        blocked: true,
        status: "blocked",
        matchedRule: `Blacklist (Exact: ${d})`,
        reason: "User Custom Blacklist",
      };
    }

    // Check parent domains for custom exact blacklist
    const parts = d.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join(".");
      if (this.exactBlacklist.has(parent)) {
        return {
          blocked: true,
          status: "blocked",
          matchedRule: `Blacklist (Parent: ${parent})`,
          reason: "User Custom Blacklist",
        };
      }
    }

    // 5. Custom Blacklist Wildcard
    for (const item of this.wildcardBlacklist) {
      if (item.regex.test(d)) {
        return {
          blocked: true,
          status: "blocked",
          matchedRule: `Blacklist (Wildcard: ${item.pattern})`,
          reason: "User Wildcard Blacklist",
        };
      }
    }

    // 6. Custom Blacklist Regex
    for (const item of this.regexBlacklist) {
      if (item.regex.test(d)) {
        return {
          blocked: true,
          status: "blocked",
          matchedRule: `Blacklist (Regex: ${item.pattern})`,
          reason: "User Regex Blacklist",
        };
      }
    }

    // 7. Gravity Blocklists (Exact & Subdomain check)
    // Check exact domain
    if (this.blockedDomains.has(d)) {
      const source = this.domainSourceMap.get(d) || "Blocklist";
      return {
        blocked: true,
        status: "blocked",
        matchedRule: d,
        matchedList: source,
        reason: `Blocked by ${source}`,
      };
    }

    // Check parent domains against blocklists
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join(".");
      if (this.blockedDomains.has(parent)) {
        const source = this.domainSourceMap.get(parent) || "Blocklist";
        return {
          blocked: true,
          status: "blocked",
          matchedRule: `*.${parent}`,
          matchedList: source,
          reason: `Blocked by ${source} (${parent})`,
        };
      }
    }

    // Allowed (Forward to Upstream / Cache)
    return {
      blocked: false,
      status: "forwarded",
    };
  }
}
