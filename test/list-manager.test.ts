import { describe, expect, test } from "bun:test";
import { ListManager } from "../src/core/list-manager";
import { FilterEngine } from "../src/core/filter-engine";
import { AdHoleDB } from "../src/db";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ListManager", () => {
  const db = new AdHoleDB(":memory:");
  const filterEngine = new FilterEngine();
  const listManager = new ListManager(db, filterEngine);

  test("should parse hosts file format correctly", () => {
    const hostsContent = `
# This is a comment
127.0.0.1 localhost
::1 localhost
0.0.0.0 adserver.com
0.0.0.0 tracker.analytics.com # inline comment
127.0.0.1 malicious-site.org evil-domain.net
`;
    const domains = listManager.parseListContent(hostsContent, "hosts");
    expect(domains.has("adserver.com")).toBe(true);
    expect(domains.has("tracker.analytics.com")).toBe(true);
    expect(domains.has("malicious-site.org")).toBe(true);
    expect(domains.has("evil-domain.net")).toBe(true);
    expect(domains.has("localhost")).toBe(false);
  });

  test("should parse plain domain lists correctly", () => {
    const plainContent = `
# Comment
telemetry.google.com
tracking.facebook.com
invalid domain name with spaces
`;
    const domains = listManager.parseListContent(plainContent, "domain");
    expect(domains.has("telemetry.google.com")).toBe(true);
    expect(domains.has("tracking.facebook.com")).toBe(true);
    expect(domains.size).toBe(2);
  });

  test("should parse Adblock Plus (ABP) format rules", () => {
    const abpContent = `
! Title: EasyList Filter
||doubleclick.net^
||ads.twitter.com^$third-party
@@||whitelisted.com^
###banner-ad
`;
    const domains = listManager.parseListContent(abpContent, "adblock");
    expect(domains.has("doubleclick.net")).toBe(true);
    expect(domains.has("ads.twitter.com")).toBe(true);
    expect(domains.has("whitelisted.com")).toBe(false);
    expect(domains.size).toBe(2);
  });
});
