import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config";
import type { AdHoleDB } from "../db";
import type { FilterEngine } from "./filter-engine";
import type { Blocklist } from "./types";

export interface UpdateProgressCallback {
  (progress: {
    listId?: number;
    listName?: string;
    stage: "fetching" | "parsing" | "saving" | "done" | "error";
    current: number;
    total: number;
    message: string;
    domainsCount?: number;
  }): void;
}

export class ListManager {
  private db: AdHoleDB;
  private filterEngine: FilterEngine;
  private isUpdating = false;

  constructor(db: AdHoleDB, filterEngine: FilterEngine) {
    this.db = db;
    this.filterEngine = filterEngine;
  }

  // Parse a text content from hosts file, domain list, or ABP format
  public parseListContent(content: string, defaultType: "hosts" | "domain" | "adblock" = "hosts"): Set<string> {
    const domains = new Set<string>();
    const lines = content.split(/\r?\n/);

    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith("!")) {
        continue; // Skip comments and empty lines
      }

      // Remove inline comments (# or !)
      const commentIdx = line.search(/[#!]/);
      if (commentIdx > 0) {
        line = line.substring(0, commentIdx).trim();
      }
      if (!line) continue;

      // Handle ABP / Adblock syntax: ||example.com^
      if (line.startsWith("||")) {
        let clean = line.substring(2);
        // Remove ^ and options like $third-party
        const optIdx = clean.search(/[\^\$]/);
        if (optIdx > 0) {
          clean = clean.substring(0, optIdx);
        } else if (clean.endsWith("^")) {
          clean = clean.slice(0, -1);
        }
        clean = clean.trim().toLowerCase();
        if (this.isValidDomain(clean)) {
          domains.add(clean);
        }
        continue;
      }

      // Skip ABP exception/element hiding rules
      if (line.startsWith("@@") || line.includes("##") || line.includes("#@#")) {
        continue;
      }

      // Handle standard hosts file format: 0.0.0.0 domain.com or 127.0.0.1 domain.com
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const first = parts[0];
        if (
          first === "0.0.0.0" ||
          first === "127.0.0.1" ||
          first === "::" ||
          first === "::1" ||
          first === "localhost"
        ) {
          // All following parts may be hostnames
          for (let i = 1; i < parts.length; i++) {
            const host = parts[i].trim().toLowerCase();
            if (
              host &&
              host !== "localhost" &&
              host !== "localhost.localdomain" &&
              host !== "broadcasthost" &&
              host !== "0.0.0.0" &&
              this.isValidDomain(host)
            ) {
              domains.add(host);
            }
          }
          continue;
        }
      }

      // Handle plain domain on single line
      if (parts.length === 1) {
        const host = parts[0].trim().toLowerCase();
        if (this.isValidDomain(host)) {
          domains.add(host);
        }
      }
    }

    return domains;
  }

  private isValidDomain(domain: string): boolean {
    if (!domain || domain.length > 253) return false;
    // Remove wildcard prefix if any for validation
    let d = domain;
    if (d.startsWith("*.")) d = d.substring(2);

    // Basic domain validation regex
    const domainRegex =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(d);
  }

  // Load from local cache files on startup (no network required)
  public loadFromCache(): number {
    const lists = this.db.getEnabledBlocklists();
    const domainsMap = new Map<string, string>(); // domain -> listName

    for (const list of lists) {
      const cachePath = join(config.listsCacheDir, `list_${list.id}.txt`);
      if (existsSync(cachePath)) {
        try {
          const content = readFileSync(cachePath, "utf-8");
          const parsed = this.parseListContent(content, list.type);
          for (const d of parsed) {
            if (!domainsMap.has(d)) {
              domainsMap.set(d, list.name);
            }
          }
        } catch (e) {
          console.error(`AdHole: Error reading cached list ${list.name}`, e);
        }
      }
    }

    this.filterEngine.setBlocklistDomains(domainsMap);
    // Also load local records and custom rules
    this.reloadRulesAndRecords();

    return domainsMap.size;
  }

  public reloadRulesAndRecords() {
    const rules = this.db.getRules();
    this.filterEngine.setCustomRules(rules);
    const records = this.db.getLocalRecords();
    this.filterEngine.setLocalRecords(records);
  }

  // Update Gravity: download all enabled lists, parse, cache, and update filter engine
  public async updateGravity(onProgress?: UpdateProgressCallback): Promise<{
    totalUniqueDomains: number;
    listsUpdated: number;
    errors: string[];
  }> {
    if (this.isUpdating) {
      throw new Error("Gravity update already in progress");
    }

    this.isUpdating = true;
    const lists = this.db.getEnabledBlocklists();
    const domainsMap = new Map<string, string>();
    const errors: string[] = [];
    let updatedCount = 0;

    onProgress?.({
      stage: "fetching",
      current: 0,
      total: lists.length,
      message: `Starting Gravity update for ${lists.length} lists...`,
    });

    for (let i = 0; i < lists.length; i++) {
      const list = lists[i];
      onProgress?.({
        listId: list.id,
        listName: list.name,
        stage: "fetching",
        current: i + 1,
        total: lists.length,
        message: `Downloading [${i + 1}/${lists.length}] ${list.name}...`,
      });

      try {
        let content = "";
        // If list url is a local file or http url
        if (list.url.startsWith("http://") || list.url.startsWith("https://")) {
          const response = await fetch(list.url, {
            headers: { "User-Agent": "AdHole-DNS/1.0" },
            signal: AbortSignal.timeout(15000), // 15s timeout
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          content = await response.text();
        } else if (existsSync(list.url)) {
          content = readFileSync(list.url, "utf-8");
        } else {
          throw new Error(`Invalid URL or local file path: ${list.url}`);
        }

        onProgress?.({
          listId: list.id,
          listName: list.name,
          stage: "parsing",
          current: i + 1,
          total: lists.length,
          message: `Parsing [${i + 1}/${lists.length}] ${list.name}...`,
        });

        const parsedDomains = this.parseListContent(content, list.type);

        // Save to local cache file
        const cachePath = join(config.listsCacheDir, `list_${list.id}.txt`);
        writeFileSync(cachePath, content, "utf-8");

        // Add to map
        for (const d of parsedDomains) {
          if (!domainsMap.has(d)) {
            domainsMap.set(d, list.name);
          }
        }

        // Update database record for this list
        this.db.updateBlocklist(list.id, {
          domainCount: parsedDomains.size,
          lastUpdated: Date.now(),
          lastStatus: "Success",
        });

        updatedCount++;
        onProgress?.({
          listId: list.id,
          listName: list.name,
          stage: "parsing",
          current: i + 1,
          total: lists.length,
          domainsCount: parsedDomains.size,
          message: `Successfully loaded ${parsedDomains.size.toLocaleString()} domains from ${list.name}`,
        });
      } catch (err: any) {
        const errorMsg = `Failed to download ${list.name}: ${err.message || err}`;
        errors.push(errorMsg);
        console.error(`AdHole Gravity Error: ${errorMsg}`);

        // Update list status with error in DB
        this.db.updateBlocklist(list.id, {
          lastStatus: `Error: ${err.message || err}`,
        });

        // Try to load cached version if available
        const cachePath = join(config.listsCacheDir, `list_${list.id}.txt`);
        if (existsSync(cachePath)) {
          try {
            const cachedContent = readFileSync(cachePath, "utf-8");
            const cachedParsed = this.parseListContent(cachedContent, list.type);
            for (const d of cachedParsed) {
              if (!domainsMap.has(d)) {
                domainsMap.set(d, list.name);
              }
            }
          } catch (e) {}
        }
      }
    }

    onProgress?.({
      stage: "saving",
      current: lists.length,
      total: lists.length,
      message: `Compiling ${domainsMap.size.toLocaleString()} unique domains into memory...`,
    });

    // Update FilterEngine in memory
    this.filterEngine.setBlocklistDomains(domainsMap);
    this.reloadRulesAndRecords();

    this.isUpdating = false;

    onProgress?.({
      stage: "done",
      current: lists.length,
      total: lists.length,
      domainsCount: domainsMap.size,
      message: `Gravity update complete! Active blocked domains: ${domainsMap.size.toLocaleString()}`,
    });

    return {
      totalUniqueDomains: domainsMap.size,
      listsUpdated: updatedCount,
      errors,
    };
  }
}
