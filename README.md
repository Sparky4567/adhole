<div align="center">

# 🛡️ AdHole DNS

**A high-performance, modern, and lightweight Pi-hole alternative built with TypeScript & Bun.**

[![Bun](https://img.shields.io/badge/Bun-1.3+-black?style=flat&logo=bun)](https://bun.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen?style=flat)](#-testing)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker)](https://www.docker.com/)

[Quick Start](#-quick-start) • [Configuration & Usage Guide](#-quick-configuration--usage-guide-3-minutes) • [ChromeOS Setup](#-chromeos-debian-bookworm-setup) • [Docker Deployment](#-docker-deployment) • [Features](#-features) • [REST API](#-rest-api) • [Router Setup](#-pointing-devices-to-adhole)

</div>

---

## 📖 Overview

**AdHole** is a network-wide ad blocker and privacy-protecting DNS server. It sinks ad networks, tracking domains, malware, and telemetry at the DNS level before they ever reach your devices, accelerating web browsing and shielding your home network.

Built natively on **Bun** with `bun:sqlite`, AdHole delivers **sub-millisecond (< 0.1ms) filtering latency**, races multiple upstream DNS providers simultaneously, and provides a modern, responsive web dashboard with live WebSocket query streaming.

---

## 🚀 Quick Start

### 1. Run with Bun

```bash
# Clone the repository
git clone https://github.com/Sparky4567/adhole.git
cd adhole

# Install dependencies
bun install

# Start AdHole
bun run start
```

Open your browser at **[http://localhost:3000](http://localhost:3000)** to access the dashboard.

> [!TIP]
> **Binding Port 53 without Root**:
> On Linux, binding port `53` requires network capability. If run without privileges, AdHole automatically falls back to port `5353`.
> To grant Bun permission to bind port `53` without `sudo`:
> ```bash
> sudo setcap 'cap_net_bind_service=+ep' $(which bun)
> ```

---

## ⚡ Quick Configuration & Usage Guide (3 Minutes)

Get up and running with AdHole in under 3 minutes by following these simple steps:

### Step 1: Start AdHole
Start the server using Docker or Bun as shown above. AdHole automatically binds:
- **DNS Server**: UDP/TCP port `53` (or `5353` if unprivileged fallback)
- **Web Dashboard**: `http://localhost:3000`

### Step 2: Test DNS Resolution (Verification)
Verify that AdHole is actively filtering queries using your terminal:

```bash
# Test an ad domain (Should resolve to 0.0.0.0 / Blocked)
dig @127.0.0.1 -p 53 doubleclick.net +short
# Output: 0.0.0.0

# Test a regular domain (Should resolve to real IP)
dig @127.0.0.1 -p 53 google.com +short
# Output: 142.250.190.46
```
*(If running on fallback port `5353`, use `-p 5353`)*

---

### Step 3: Configure Your Device / OS

#### 🐧 Linux (systemd-resolved / NetworkManager)
```bash
# Using resolvectl
sudo resolvectl dns $(ip route show default | awk '{print $5}') 127.0.0.1

# Or edit /etc/resolv.conf
echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf
```

#### 🍏 macOS
```bash
# Set primary DNS on Wi-Fi interface
sudo networksetup -setdnsservers Wi-Fi 127.0.0.1
```

#### 🪟 Windows (PowerShell as Admin)
```powershell
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses "127.0.0.1"
```

#### 🏠 Network-Wide (Router Setup)
1. Open your router portal (e.g. `192.168.1.1`).
2. Navigate to **DHCP / LAN Settings** -> **DNS Server**.
3. Set Primary DNS to the local IP of your machine running AdHole (e.g. `192.168.1.50`).
4. Save and restart the router. All connected home devices (TVs, phones, PCs, consoles) are now automatically ad-free!

---

### Step 4: Common Configuration Recipes in the Dashboard

Open **`http://localhost:3000`** in your browser:

#### 1. Add Blocklists & Update Gravity
- Go to the **Gravity & Lists** tab.
- Click **+ Add Blocklist** and enter any hosts or domain list URL (e.g. OISD, Firebog, StevenBlack).
- Click **🚀 Update Gravity Lists Now** to download and compile the lists into memory.

#### 2. Whitelist or Blacklist a Domain
- **From Query Log**: Go to **Query Log**, find the domain, and click **🛡️ Allow** (Whitelist) or **🚫 Block** (Blacklist).
- **Custom Patterns**: Go to **Custom Rules** -> Add exact domain, wildcard (`*.analytics.tiktok.com`), or regex (`^ad[0-9]+\.badsite\.com$`).

#### 3. Map Internal Home Network Devices (Local DNS)
- Go to the **Local DNS** tab.
- Add your custom hostnames:
  - `nas.home` &rarr; `192.168.1.100`
  - `router.lan` &rarr; `192.168.1.1`
  - `proxmox.local` &rarr; `192.168.1.200`
- Access your servers by domain name without memorizing IPs!

#### 4. Configure Upstream DNS & SafeSearch
- Go to the **Settings** tab:
  - **Upstream Resolvers**: Set your favorite upstream DNS (Cloudflare `1.1.1.1`, Google `8.8.8.8`, Quad9 `9.9.9.9`).
  - **Upstream Strategy**: Choose **Fastest Race** to race all providers simultaneously for minimum response time.
  - **SafeSearch**: Enable the switches for Google, Bing, DuckDuckGo, or YouTube to enforce family-friendly search filtering.

---

## 💻 ChromeOS (Debian Bookworm / Crostini) Setup

In ChromeOS, Linux (Crostini) runs inside a VM container with its own virtual IP (typically `100.115.92.x`). ChromeOS bridges localhost from the container, allowing you to access the dashboard and route all Chromebook DNS queries through AdHole.

### 1. Grant Bun Port 53 Permission
```bash
sudo setcap 'cap_net_bind_service=+ep' $(which bun)
```

### 2. Start AdHole
```bash
DNS_PORT=53 HTTP_PORT=3000 bun run src/index.ts
```
Open **[http://localhost:3000](http://localhost:3000)** (or `http://penguin.linux.test:3000`) in Chrome on your Chromebook to access the web dashboard.

### 3. Find Your Linux Container IP
```bash
hostname -I | awk '{print $1}'
```
*(Example output: `100.115.92.26`)*

### 4. Point ChromeOS to AdHole DNS
1. Open **ChromeOS Settings** (Chromebook gear icon).
2. Go to **Network** &rarr; click your connected **Wi-Fi** or **Ethernet**.
3. Expand the **Network** subsection.
4. Under **Name servers**, select **Custom name servers**.
5. Enter your Linux container IP (e.g. `100.115.92.26`).
6. *(Optional fallback)* In the second slot, enter `1.1.1.1`.

### 5. Disable "Secure DNS" in Chrome Browser
To prevent Chrome from bypassing local DNS through DNS-over-HTTPS (DoH):
1. Navigate to **`chrome://settings/security`** in Chrome.
2. Toggle **Use secure DNS** to **OFF** (or select "With your current service provider").

### 6. (Optional) Auto-Start on Linux Boot via Systemd
Create a systemd service so AdHole runs in the background automatically:

```bash
sudo tee /etc/systemd/system/adhole.service << 'EOF'
[Unit]
Description=AdHole DNS Server
After=network.target

[Service]
Type=simple
User=shelly
WorkingDirectory=/home/shelly/github/runnable/adhole
Environment="DNS_PORT=53"
Environment="HTTP_PORT=3000"
ExecStart=/home/shelly/.bun/bin/bun run src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now adhole
```

---

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

Create or use the provided `docker-compose.yml`:

```yaml
services:
  adhole:
    image: oven/bun:1-alpine
    container_name: adhole
    restart: unless-stopped
    build: .
    ports:
      - "53:53/udp"
      - "53:53/tcp"
      - "3000:3000/tcp"
    environment:
      - DNS_PORT=53
      - HTTP_PORT=3000
      - UPSTREAM_DNS=1.1.1.1,1.0.0.1,8.8.8.8,9.9.9.9
      - BLOCKING_MODE=ZERO_IP
    volumes:
      - ./data:/app/data
```

Run:
```bash
docker compose up -d
```

---

## ✨ Features

- ⚡ **Ultra-Fast In-Memory Engine**:
  - Sub-millisecond domain matching via Trie and Hash Set algorithms.
  - Zero bloated external dependencies; uses Bun's high-speed native runtime.
- 🛑 **Comprehensive Ad & Tracker Filtering**:
  - **Standard Hosts format** (`0.0.0.0 ad.doubleclick.net`, `127.0.0.1 tracker.com`).
  - **Adblock Plus (ABP) syntax** (`||adservice.google.com^`).
  - **Plain domain lists** (`telemetry.domain.com`).
  - **Wildcard & Regex custom rules** (`*.telemetry.com`, `/^ad[0-9]+\.domain\.net$/`).
  - **Automatic Subdomain Sinking**: Blocking `doubleclick.net` automatically protects all subdomains (`stats.doubleclick.net`, etc.).
  - **Whitelist Priority**: Whitelisted domains always take precedence over blocklists.
- 🚀 **Upstream DNS Racing & Fallback**:
  - Concurrently queries multiple upstream DNS resolvers (Cloudflare `1.1.1.1`, Google `8.8.8.8`, Quad9 `9.9.9.9`, AdGuard DNS) and returns the fastest response.
- 💾 **Intelligent Decaying TTL DNS Cache**:
  - In-memory cache respecting record TTL with configurable min/max TTL limits.
- 🌐 **Modern Single-Page Dashboard & REST API**:
  - **Live DNS Query Log** with real-time WebSocket streaming.
  - **One-Click Quick Actions**: Allow or Block domains instantly from the query table.
  - **Interactive 24-Hour Activity Graph**: Permitted vs. Blocked query volume over time.
  - **Top Lists**: Top Permitted Domains, Top Blocked Domains, and Top Client IPs.
  - **Gravity Manager**: Add, toggle, and auto-update blocklist feeds with live terminal progress logs.
  - **Local DNS Records**: Custom internal domain mappings (e.g., `nas.lan -> 192.168.1.50`, `router.home -> 192.168.1.1`).
  - **DNS Diagnostic Tool**: Test domain verdicts and inspect matched rules interactively.
  - **SafeSearch Enforcement**: One-toggle strict SafeSearch for Google, Bing, DuckDuckGo, and YouTube.
- 🔒 **Privacy First**:
  - Optional IP anonymization (masks client IP octets in logs).
  - All logs and settings remain strictly local in your SQLite database.
- 🐳 **Docker & Bare Metal Ready**: Runs on Linux, macOS, Raspberry Pi (ARM/x86), and containers.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    Client["Client Device (PC / Phone / IoT)"] -->|DNS Query :53| Server["AdHole DNS Server (UDP/TCP)"]
    
    subgraph AdHole Core Pipeline
        Server --> LocalCheck{"1. Local DNS Record?"}
        LocalCheck -->|Yes| LocalAnswer["Return Local IP Address"]
        LocalCheck -->|No| SafeCheck{"2. SafeSearch Override?"}
        
        SafeCheck -->|Yes| SafeAnswer["Return SafeSearch IP"]
        SafeCheck -->|No| WhitelistCheck{"3. Whitelisted?"}
        
        WhitelistCheck -->|Yes| CacheCheck
        WhitelistCheck -->|No| BlockCheck{"4. Blocklist / Blacklist Match?"}
        
        BlockCheck -->|Yes| BlockResponse["Return 0.0.0.0 / NXDOMAIN / ::"]
        BlockCheck -->|No| CacheCheck{"5. In Memory DNS Cache?"}
        
        CacheCheck -->|Cache Hit| ReturnCached["Return Cached Response"]
        CacheCheck -->|Cache Miss| UpstreamRace["6. Race Upstream DNS (Cloudflare / Google / Quad9)"]
        
        UpstreamRace --> CacheStore["Save to DNS Cache"]
    end

    BlockResponse --> LogStream["Log to SQLite & Broadcast via WebSocket"]
    LocalAnswer --> LogStream
    SafeAnswer --> LogStream
    ReturnCached --> LogStream
    CacheStore --> LogStream

    LogStream --> WebUI["AdHole Web Dashboard (:3000)"]
```

---

## ⚙️ Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DNS_PORT` | `53` | Port for the DNS server (falls back to `5353` if unprivileged) |
| `DNS_HOST` | `0.0.0.0` | IP interface to bind the DNS server |
| `HTTP_PORT` | `3000` | Port for Web Dashboard & REST API |
| `HTTP_HOST` | `0.0.0.0` | IP interface to bind Web Dashboard |
| `DATA_DIR` | `./data` | Directory for SQLite DB and cached lists |
| `UPSTREAM_DNS` | `1.1.1.1,1.0.0.1,8.8.8.8,9.9.9.9` | Comma-separated upstream DNS servers |
| `UPSTREAM_STRATEGY`| `race` | `race` (fastest response) or `fallback` (sequential) |
| `BLOCKING_MODE` | `ZERO_IP` | `ZERO_IP` (0.0.0.0), `NXDOMAIN`, `REFUSED`, or `CUSTOM_IP` |
| `CUSTOM_BLOCK_IP` | `0.0.0.0` | Custom IP returned when `BLOCKING_MODE=CUSTOM_IP` |
| `CACHE_ENABLED` | `true` | Enable/disable in-memory DNS caching |
| `CACHE_MIN_TTL` | `60` | Minimum TTL in seconds for cached records |
| `CACHE_MAX_TTL` | `86400` | Maximum TTL in seconds for cached records |
| `ANONYMIZE_IPS` | `false` | Mask client IP addresses in query logs |
| `SAFE_SEARCH_GOOGLE` | `false` | Enforce Google SafeSearch |
| `SAFE_SEARCH_BING` | `false` | Enforce Bing SafeSearch |
| `SAFE_SEARCH_YOUTUBE` | `false` | Enforce YouTube Restricted Mode |

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/stats` | `GET` | Overall dashboard metrics, cache hit ratio, hourly query history, top lists |
| `/api/queries` | `GET` | Paginated query log (`?page=1&limit=50&status=blocked&search=domain`) |
| `/api/queries/clear` | `POST` | Clear query log history |
| `/api/lists` | `GET`, `POST` | List and add blocklist URLs |
| `/api/lists/:id` | `PUT`, `DELETE` | Toggle, update, or delete a blocklist |
| `/api/gravity/update`| `POST` | Trigger Gravity download & compilation of all active lists |
| `/api/rules` | `GET`, `POST` | View and add custom whitelist / blacklist rules |
| `/api/rules/:id` | `PUT`, `DELETE` | Update or delete custom rules |
| `/api/records` | `GET`, `POST` | View and add local custom DNS mappings |
| `/api/records/:id` | `DELETE` | Delete a local DNS record |
| `/api/lookup` | `GET` | Test lookup domain verdict diagnostic (`?domain=example.com`) |
| `/api/cache/flush` | `POST` | Flush in-memory DNS cache |
| `/api/settings` | `GET`, `POST` | Get and update runtime server configuration |
| `/api/system` | `GET` | System resource usage, uptime, memory, Bun version |
| `/ws/live` | `WS` | WebSocket endpoint for live query and progress streaming |

---

## 🧪 Testing

AdHole comes with a comprehensive test suite covering DNS packet decoding/encoding, filter priority rules, TTL caching, hosts parser, and API integrations:

```bash
bun test
```

```
test/filter-engine.test.ts: 6 passed
test/dns-cache.test.ts:     4 passed
test/list-manager.test.ts:   3 passed
test/dns-server.test.ts:    3 passed
test/api.test.ts:           4 passed

Total: 20 passed (100% pass rate)
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
