import * as dgram from "node:dgram";
import dnsPacket from "dns-packet";
import { config } from "../config";

export interface UpstreamResponse {
  packet: dnsPacket.Packet;
  upstreamServer: string;
  responseTimeMs: number;
}

export class UpstreamResolver {
  private upstreams: { host: string; port: number }[] = [];

  constructor(servers: string[] = config.defaultUpstreams) {
    this.setUpstreams(servers);
  }

  public setUpstreams(servers: string[]) {
    this.upstreams = servers.map((s) => {
      const parts = s.split(":");
      return {
        host: parts[0].trim(),
        port: parts[1] ? parseInt(parts[1], 10) : 53,
      };
    });
  }

  public getUpstreams(): string[] {
    return this.upstreams.map((u) => `${u.host}:${u.port}`);
  }

  // Resolve a DNS query packet by forwarding to upstreams
  public async resolve(
    queryPacket: dnsPacket.Packet,
    strategy: "race" | "fallback" = config.upstreamStrategy
  ): Promise<UpstreamResponse> {
    if (this.upstreams.length === 0) {
      throw new Error("No upstream DNS servers configured");
    }

    if (strategy === "race" && this.upstreams.length > 1) {
      return this.resolveRace(queryPacket);
    } else {
      return this.resolveFallback(queryPacket);
    }
  }

  // Race all upstreams concurrently, return first successful response
  private resolveRace(queryPacket: dnsPacket.Packet): Promise<UpstreamResponse> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      let resolved = false;
      let errorCount = 0;
      const total = this.upstreams.length;
      const sockets: dgram.Socket[] = [];

      const cleanup = () => {
        for (const sock of sockets) {
          try {
            sock.close();
          } catch (e) {}
        }
      };

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error(`DNS query timed out after ${config.upstreamTimeoutMs}ms`));
        }
      }, config.upstreamTimeoutMs);

      // Encode packet for wire
      const rawPacket = dnsPacket.encode(queryPacket);

      for (const upstream of this.upstreams) {
        const socket = dgram.createSocket("udp4");
        sockets.push(socket);

        socket.on("message", (msg) => {
          if (!resolved) {
            try {
              const decoded = dnsPacket.decode(msg);
              resolved = true;
              clearTimeout(timer);
              cleanup();
              const responseTimeMs = Math.round((performance.now() - startTime) * 10) / 10;
              resolve({
                packet: decoded,
                upstreamServer: `${upstream.host}:${upstream.port}`,
                responseTimeMs,
              });
            } catch (err) {
              // Ignore decode error for one upstream if others might succeed
            }
          }
        });

        socket.on("error", (err) => {
          errorCount++;
          if (errorCount >= total && !resolved) {
            resolved = true;
            clearTimeout(timer);
            cleanup();
            reject(new Error(`All upstreams failed: ${err.message}`));
          }
        });

        try {
          socket.send(rawPacket, upstream.port, upstream.host);
        } catch (err: any) {
          errorCount++;
          if (errorCount >= total && !resolved) {
            resolved = true;
            clearTimeout(timer);
            cleanup();
            reject(new Error(`Failed to send to upstream: ${err.message}`));
          }
        }
      }
    });
  }

  // Fallback sequential resolution
  private async resolveFallback(queryPacket: dnsPacket.Packet): Promise<UpstreamResponse> {
    let lastError: any = null;

    for (const upstream of this.upstreams) {
      try {
        const res = await this.querySingle(queryPacket, upstream.host, upstream.port);
        return res;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("All upstream servers failed");
  }

  private querySingle(
    queryPacket: dnsPacket.Packet,
    host: string,
    port: number
  ): Promise<UpstreamResponse> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const socket = dgram.createSocket("udp4");
      const rawPacket = dnsPacket.encode(queryPacket);

      const timer = setTimeout(() => {
        try {
          socket.close();
        } catch (e) {}
        reject(new Error(`Timeout querying ${host}:${port}`));
      }, config.upstreamTimeoutMs);

      socket.on("message", (msg) => {
        clearTimeout(timer);
        try {
          socket.close();
        } catch (e) {}
        try {
          const decoded = dnsPacket.decode(msg);
          const responseTimeMs = Math.round((performance.now() - startTime) * 10) / 10;
          resolve({
            packet: decoded,
            upstreamServer: `${host}:${port}`,
            responseTimeMs,
          });
        } catch (err) {
          reject(err);
        }
      });

      socket.on("error", (err) => {
        clearTimeout(timer);
        try {
          socket.close();
        } catch (e) {}
        reject(err);
      });

      socket.send(rawPacket, port, host, (err) => {
        if (err) {
          clearTimeout(timer);
          try {
            socket.close();
          } catch (e) {}
          reject(err);
        }
      });
    });
  }
}
