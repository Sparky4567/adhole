import * as dgram from "node:dgram";
import * as net from "node:net";
import dnsPacket from "dns-packet";
import { config } from "../config";
import type { AdHoleDB } from "../db";
import type { DnsCache } from "./dns-cache";
import type { FilterEngine } from "./filter-engine";
import type { UpstreamResolver } from "./upstream";
import type { DnsLogEntry } from "./types";

export type QueryListener = (entry: DnsLogEntry) => void;

export class DnsServer {
  private udpSocket: dgram.Socket | null = null;
  private tcpServer: net.Server | null = null;
  private db: AdHoleDB;
  private filterEngine: FilterEngine;
  private cache: DnsCache;
  private upstream: UpstreamResolver;
  private queryListeners: Set<QueryListener> = new Set();
  public actualDnsPort: number = config.dnsPort;

  constructor(
    db: AdHoleDB,
    filterEngine: FilterEngine,
    cache: DnsCache,
    upstream: UpstreamResolver
  ) {
    this.db = db;
    this.filterEngine = filterEngine;
    this.cache = cache;
    this.upstream = upstream;
  }

  public addQueryListener(listener: QueryListener) {
    this.queryListeners.add(listener);
    return () => this.queryListeners.delete(listener);
  }

  private notifyQuery(entry: DnsLogEntry) {
    this.db.logQuery(entry);
    for (const listener of this.queryListeners) {
      try {
        listener(entry);
      } catch (e) {}
    }
  }

  // Start DNS Server
  public async start(): Promise<number> {
    const port = config.dnsPort;
    const host = config.dnsHost;

    try {
      await this.bindUdp(port, host);
      this.actualDnsPort = port;
      this.startTcp(port, host);
      return port;
    } catch (err: any) {
      if (
        (err.code === "EACCES" || err.code === "EADDRINUSE") &&
        port === 53
      ) {
        console.warn(
          `\n⚠️  Notice: Cannot bind to privileged port 53 (${err.code}).`
        );
        console.warn(
          `   Falling back to DNS Port 5353. (Run with sudo or setcap to use port 53)\n`
        );
        const fallbackPort = 5353;
        await this.bindUdp(fallbackPort, host);
        this.actualDnsPort = fallbackPort;
        this.startTcp(fallbackPort, host);
        return fallbackPort;
      } else {
        throw err;
      }
    }
  }

  private bindUdp(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket("udp4");
      this.udpSocket = socket;

      socket.on("error", (err) => {
        reject(err);
      });

      socket.on("message", async (msg, rinfo) => {
        try {
          const queryPacket = dnsPacket.decode(msg);
          const responsePacket = await this.handleQuery(
            queryPacket,
            rinfo.address
          );
          if (responsePacket) {
            const responseBuf = dnsPacket.encode(responsePacket);
            socket.send(responseBuf, rinfo.port, rinfo.address);
          }
        } catch (e) {
          // Ignore invalid or malformed incoming packets
        }
      });

      socket.bind(port, host, () => {
        resolve();
      });
    });
  }

  private startTcp(port: number, host: string) {
    try {
      this.tcpServer = net.createServer((socket) => {
        let buffer = Buffer.alloc(0);
        let expectedLength = 0;

        socket.on("data", async (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);

          // DNS over TCP prefixes packets with 2-byte length
          if (expectedLength === 0 && buffer.length >= 2) {
            expectedLength = buffer.readUInt16BE(0);
          }

          if (expectedLength > 0 && buffer.length >= expectedLength + 2) {
            const dnsData = buffer.subarray(2, expectedLength + 2);
            buffer = buffer.subarray(expectedLength + 2);
            expectedLength = 0;

            try {
              const queryPacket = dnsPacket.decode(dnsData);
              const clientIp = socket.remoteAddress || "127.0.0.1";
              const responsePacket = await this.handleQuery(
                queryPacket,
                clientIp
              );
              if (responsePacket) {
                const responseBuf = dnsPacket.encode(responsePacket);
                const lenBuf = Buffer.alloc(2);
                lenBuf.writeUInt16BE(responseBuf.length, 0);
                socket.write(Buffer.concat([lenBuf, responseBuf]));
              }
            } catch (e) {}
          }
        });
      });

      this.tcpServer.on("error", (e) => {
        // TCP is secondary, don't crash if TCP fails
        console.warn("AdHole TCP DNS Server notice:", e.message);
      });

      this.tcpServer.listen(port, host);
    } catch (e) {}
  }

  // Core query resolution pipeline
  public async handleQuery(
    queryPacket: dnsPacket.Packet,
    clientIp: string
  ): Promise<dnsPacket.Packet | null> {
    const startTime = performance.now();
    const question = queryPacket.questions?.[0];

    if (!question) {
      // Malformed or empty questions query
      return {
        type: "response",
        id: queryPacket.id,
        flags: dnsPacket.RECURSION_AVAILABLE | 1, // FORMERR (rcode 1)
        questions: [],
        answers: [],
      };
    }

    const domain = question.name.toLowerCase().replace(/\.$/, "");
    const queryType = (question.type || "A").toUpperCase();
    const effectiveClientIp = config.anonymizeIps
      ? this.anonymizeIp(clientIp)
      : clientIp;

    // 1. Evaluate filter engine
    const filterRes = this.filterEngine.evaluate(domain, queryType);

    // Case A: Local DNS Record or SafeSearch
    if (filterRes.status === "local" && filterRes.localIp) {
      const responseTimeMs =
        Math.round((performance.now() - startTime) * 10) / 10;
      const isIpv6 = filterRes.localIp.includes(":");
      const targetType = isIpv6 ? "AAAA" : "A";

      const answers =
        queryType === targetType || queryType === "ANY"
          ? [
              {
                name: question.name,
                type: targetType as any,
                class: "IN" as const,
                ttl: 300,
                data: filterRes.localIp,
              },
            ]
          : [];

      const logEntry: DnsLogEntry = {
        timestamp: Date.now(),
        clientIp: effectiveClientIp,
        domain,
        queryType,
        status: "local",
        upstreamServer: "local-dns",
        responseTimeMs,
        matchedRule: filterRes.reason,
      };
      this.notifyQuery(logEntry);

      return {
        type: "response",
        id: queryPacket.id,
        flags: dnsPacket.RECURSION_AVAILABLE | dnsPacket.RECURSION_DESIRED,
        questions: queryPacket.questions,
        answers,
        authorities: [],
        additionals: [],
      };
    }

    // Case B: Blocked domain
    if (filterRes.blocked) {
      const responseTimeMs =
        Math.round((performance.now() - startTime) * 10) / 10;

      const logEntry: DnsLogEntry = {
        timestamp: Date.now(),
        clientIp: effectiveClientIp,
        domain,
        queryType,
        status: "blocked",
        upstreamServer: "blocked",
        responseTimeMs,
        matchedRule: filterRes.matchedRule,
        matchedList: filterRes.matchedList,
      };
      this.notifyQuery(logEntry);

      if (config.blockingMode === "NXDOMAIN") {
        return {
          type: "response",
          id: queryPacket.id,
          flags:
            dnsPacket.RECURSION_AVAILABLE |
            dnsPacket.RECURSION_DESIRED |
            3, // RCODE 3 = NXDOMAIN
          questions: queryPacket.questions,
          answers: [],
          authorities: [],
          additionals: [],
        };
      }

      if (config.blockingMode === "REFUSED") {
        return {
          type: "response",
          id: queryPacket.id,
          flags:
            dnsPacket.RECURSION_AVAILABLE |
            dnsPacket.RECURSION_DESIRED |
            5, // RCODE 5 = REFUSED
          questions: queryPacket.questions,
          answers: [],
          authorities: [],
          additionals: [],
        };
      }

      // Default ZERO_IP or CUSTOM_IP
      let blockedIp =
        config.blockingMode === "CUSTOM_IP"
          ? config.customBlockIp
          : queryType === "AAAA"
          ? "::"
          : "0.0.0.0";

      let answers: any[] = [];
      if (queryType === "A" || queryType === "AAAA") {
        answers = [
          {
            name: question.name,
            type: queryType as any,
            class: "IN" as const,
            ttl: 300,
            data: blockedIp,
          },
        ];
      }

      return {
        type: "response",
        id: queryPacket.id,
        flags: dnsPacket.RECURSION_AVAILABLE | dnsPacket.RECURSION_DESIRED,
        questions: queryPacket.questions,
        answers,
        authorities: [],
        additionals: [],
      };
    }

    // Case C: DNS Cache Hit
    const cachedAnswers = this.cache.get(domain, queryType);
    if (cachedAnswers && cachedAnswers.length > 0) {
      const responseTimeMs =
        Math.round((performance.now() - startTime) * 10) / 10;

      const logEntry: DnsLogEntry = {
        timestamp: Date.now(),
        clientIp: effectiveClientIp,
        domain,
        queryType,
        status: "cached",
        upstreamServer: "cache",
        responseTimeMs,
        matchedRule: filterRes.reason,
      };
      this.notifyQuery(logEntry);

      return {
        type: "response",
        id: queryPacket.id,
        flags: dnsPacket.RECURSION_AVAILABLE | dnsPacket.RECURSION_DESIRED,
        questions: queryPacket.questions,
        answers: cachedAnswers,
        authorities: [],
        additionals: [],
      };
    }

    // Case D: Forward to Upstream DNS
    try {
      const upstreamRes = await this.upstream.resolve(queryPacket);
      const totalTimeMs =
        Math.round((performance.now() - startTime) * 10) / 10;

      // Save to cache if has answers
      if (upstreamRes.packet.answers && upstreamRes.packet.answers.length > 0) {
        this.cache.set(
          domain,
          queryType,
          upstreamRes.packet.answers,
          upstreamRes.packet.authorities,
          upstreamRes.packet.additionals
        );
      }

      const logEntry: DnsLogEntry = {
        timestamp: Date.now(),
        clientIp: effectiveClientIp,
        domain,
        queryType,
        status: "forwarded",
        upstreamServer: upstreamRes.upstreamServer,
        responseTimeMs: totalTimeMs,
        matchedRule: filterRes.reason,
      };
      this.notifyQuery(logEntry);

      return {
        ...upstreamRes.packet,
        id: queryPacket.id, // Ensure original query ID is maintained
      };
    } catch (err: any) {
      const totalTimeMs =
        Math.round((performance.now() - startTime) * 10) / 10;

      const logEntry: DnsLogEntry = {
        timestamp: Date.now(),
        clientIp: effectiveClientIp,
        domain,
        queryType,
        status: "forwarded",
        upstreamServer: "SERVFAIL",
        responseTimeMs: totalTimeMs,
        matchedRule: `Error: ${err.message || err}`,
      };
      this.notifyQuery(logEntry);

      return {
        type: "response",
        id: queryPacket.id,
        flags:
          dnsPacket.RECURSION_AVAILABLE |
          dnsPacket.RECURSION_DESIRED |
          2, // RCODE 2 = SERVFAIL
        questions: queryPacket.questions,
        answers: [],
        authorities: [],
        additionals: [],
      };
    }
  }

  private anonymizeIp(ip: string): string {
    if (ip.includes(".")) {
      const parts = ip.split(".");
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    } else if (ip.includes(":")) {
      const parts = ip.split(":");
      return `${parts.slice(0, 3).join(":")}::`;
    }
    return ip;
  }

  // Stop server
  public stop() {
    if (this.udpSocket) {
      try {
        this.udpSocket.close();
      } catch (e) {}
      this.udpSocket = null;
    }
    if (this.tcpServer) {
      try {
        this.tcpServer.close();
      } catch (e) {}
      this.tcpServer = null;
    }
  }
}
