export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AdHole DNS - Pi-hole Alternative</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛡️</text></svg>">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg-base: #0b0f19;
      --bg-surface: #111827;
      --bg-card: #1f2937;
      --bg-card-hover: #374151;
      --border: #374151;
      --text-main: #f9fafb;
      --text-muted: #9ca3af;
      --accent-green: #10b981;
      --accent-red: #ef4444;
      --accent-blue: #3b82f6;
      --accent-purple: #8b5cf6;
      --accent-amber: #f59e0b;
      --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-sans);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar */
    aside {
      width: 260px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .brand {
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border);
    }
    .brand-icon {
      font-size: 28px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      padding: 6px 10px;
      border-radius: 12px;
    }
    .brand-text h1 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .brand-text span {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .nav-menu {
      padding: 16px 10px;
      list-style: none;
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      color: var(--text-muted);
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .nav-item:hover {
      background: var(--bg-card);
      color: var(--text-main);
    }
    .nav-item.active {
      background: #1e3a8a;
      color: #93c5fd;
      font-weight: 600;
    }
    .nav-item svg { width: 18px; height: 18px; stroke-width: 2; }

    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--accent-green);
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 0 8px var(--accent-green);
    }

    /* Main Content Area */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-base);
    }

    header {
      height: 64px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-surface);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
    }
    .header-title { font-size: 18px; font-weight: 600; }
    .header-actions { display: flex; align-items: center; gap: 12px; }

    .content-body {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    /* Tabs view logic */
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Grid & Cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    .card-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-main);
    }
    .card-subtext {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .card-border-green { border-top: 3px solid var(--accent-green); }
    .card-border-red { border-top: 3px solid var(--accent-red); }
    .card-border-blue { border-top: 3px solid var(--accent-blue); }
    .card-border-purple { border-top: 3px solid var(--accent-purple); }

    /* Chart & Top Lists row */
    .grid-2col {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    @media (max-width: 1024px) {
      .grid-2col { grid-template-columns: 1fr; }
    }

    .chart-container {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      height: 340px;
    }

    .top-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 12px;
    }
    .top-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      padding: 8px 12px;
      background: var(--bg-card);
      border-radius: 6px;
    }
    .top-domain {
      font-family: monospace;
      color: #e5e7eb;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 180px;
    }
    .top-count {
      font-weight: 600;
      color: var(--text-muted);
      background: rgba(255,255,255,0.05);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
    }

    /* Tables */
    .table-container {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .table-toolbar {
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }
    th {
      background: rgba(31, 41, 55, 0.6);
      padding: 12px 16px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(55, 65, 81, 0.4);
      color: #d1d5db;
    }
    tr:hover td { background: rgba(55, 65, 81, 0.2); }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-blocked { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-forwarded { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-cached { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .badge-local { background: rgba(139, 92, 246, 0.15); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.3); }

    /* Buttons & Inputs */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-success { background: #059669; color: white; }
    .btn-success:hover { background: #047857; }
    .btn-danger { background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.3); }
    .btn-secondary { background: var(--bg-card); color: var(--text-main); border-color: var(--border); }
    .btn-secondary:hover { background: var(--bg-card-hover); }
    .btn-sm { padding: 4px 10px; font-size: 11px; }

    input, select, textarea {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      outline: none;
    }
    input:focus, select:focus, textarea:focus { border-color: #3b82f6; ring: 1px solid #3b82f6; }

    .form-group {
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-group label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    /* Switch */
    .switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 22px;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--border);
      transition: .2s;
      border-radius: 22px;
    }
    .slider:before {
      position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px;
      background-color: white;
      transition: .2s;
      border-radius: 50%;
    }
    input:checked + .slider { background-color: #2563eb; }
    input:checked + .slider:before { transform: translateX(18px); }

    /* Console output */
    .console-box {
      background: #000;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #10b981;
      height: 220px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    /* Live indicator pulsing */
    .pulse-indicator {
      width: 8px; height: 8px; border-radius: 50%; background: #10b981;
      animation: pulse 1.5s infinite; display: inline-block;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    /* Modal */
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 999;
    }
    .modal {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      width: 500px;
      max-width: 90vw;
      padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .modal-header h3 { font-size: 16px; font-weight: 700; }
    .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 20px; }
  </style>
</head>
<body>

  <!-- Sidebar -->
  <aside>
    <div class="brand">
      <div class="brand-icon">🛡️</div>
      <div class="brand-text">
        <h1>AdHole DNS</h1>
        <span>Fast Pi-hole Alternative</span>
      </div>
    </div>

    <ul class="nav-menu">
      <li class="nav-item active" data-tab="dashboard">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
        Dashboard
      </li>
      <li class="nav-item" data-tab="queries">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        Query Log
      </li>
      <li class="nav-item" data-tab="gravity">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"></path></svg>
        Gravity & Lists
      </li>
      <li class="nav-item" data-tab="rules">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        Custom Rules
      </li>
      <li class="nav-item" data-tab="local-dns">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
        Local DNS
      </li>
      <li class="nav-item" data-tab="lookup">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        DNS Diagnostic
      </li>
      <li class="nav-item" data-tab="settings">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        Settings
      </li>
    </ul>

    <div class="sidebar-footer">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="status-dot"></span>
        <span>DNS Server Active</span>
      </div>
      <span id="dns-port-badge" style="font-family: monospace; font-size: 11px; background: #1e293b; padding: 2px 6px; border-radius: 4px;">:53</span>
    </div>
  </aside>

  <!-- Main View -->
  <main>
    <header>
      <div class="header-title" id="page-title">Dashboard Overview</div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" onclick="fetchDashboardStats()">
          <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          Refresh
        </button>
        <button class="btn btn-primary btn-sm" onclick="showTab('gravity'); triggerGravityUpdate();">
          ⚡ Update Gravity
        </button>
      </div>
    </header>

    <div class="content-body">
      <!-- 1. DASHBOARD TAB -->
      <section id="tab-dashboard" class="tab-content active">
        <!-- Stat Cards -->
        <div class="stats-grid">
          <div class="card card-border-blue">
            <div class="card-title">Total Queries (Today)</div>
            <div class="card-value" id="stat-total-queries">0</div>
            <div class="card-subtext"><span id="stat-active-clients">0</span> active clients</div>
          </div>
          <div class="card card-border-red">
            <div class="card-title">Queries Blocked</div>
            <div class="card-value" id="stat-blocked-queries" style="color: #f87171;">0</div>
            <div class="card-subtext"><span id="stat-percent-blocked">0%</span> of all traffic</div>
          </div>
          <div class="card card-border-green">
            <div class="card-title">Domains on Blocklist</div>
            <div class="card-value" id="stat-blocklist-count" style="color: #34d399;">0</div>
            <div class="card-subtext">Active gravity rules</div>
          </div>
          <div class="card card-border-purple">
            <div class="card-title">Cache Hit Ratio</div>
            <div class="card-value" id="stat-cache-hit">0%</div>
            <div class="card-subtext"><span id="stat-unique-domains">0</span> unique domains</div>
          </div>
        </div>

        <!-- 24h Activity Graph & Top Domains -->
        <div class="grid-2col">
          <div class="chart-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h3 style="font-size:14px; font-weight:600;">24-Hour Query Activity</h3>
              <div style="font-size:11px; color:var(--text-muted); display:flex; gap:12px;">
                <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px;height:10px;background:#3b82f6;border-radius:2px;display:inline-block;"></span> Permitted</span>
                <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px;height:10px;background:#ef4444;border-radius:2px;display:inline-block;"></span> Blocked</span>
              </div>
            </div>
            <div style="height:250px;">
              <canvas id="queriesChart"></canvas>
            </div>
          </div>

          <div class="card">
            <h3 style="font-size:14px; font-weight:600; margin-bottom: 8px;">Top Blocked Domains</h3>
            <div class="top-list" id="top-blocked-list">
              <div style="color:var(--text-muted); font-size:12px;">No blocked queries yet.</div>
            </div>
          </div>
        </div>

        <!-- Top Permitted & Top Clients -->
        <div class="grid-2col">
          <div class="card">
            <h3 style="font-size:14px; font-weight:600; margin-bottom: 8px;">Top Permitted Domains</h3>
            <div class="top-list" id="top-permitted-list">
              <div style="color:var(--text-muted); font-size:12px;">No permitted queries yet.</div>
            </div>
          </div>
          <div class="card">
            <h3 style="font-size:14px; font-weight:600; margin-bottom: 8px;">Top Clients</h3>
            <div class="top-list" id="top-clients-list">
              <div style="color:var(--text-muted); font-size:12px;">No client queries yet.</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. QUERY LOG TAB -->
      <section id="tab-queries" class="tab-content">
        <div class="table-container">
          <div class="table-toolbar">
            <div style="display: flex; gap: 12px; align-items: center; flex: 1;">
              <input type="text" id="query-search" placeholder="Search domain or client IP..." style="width: 280px;" oninput="debounceFetchQueries()">
              <select id="query-status-filter" onchange="fetchQueries()">
                <option value="all">All Queries</option>
                <option value="blocked">Blocked Only</option>
                <option value="forwarded">Permitted Only</option>
                <option value="cached">Cached Only</option>
                <option value="local">Local DNS</option>
              </select>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <span style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                <span class="pulse-indicator" id="live-stream-dot"></span> Live Stream
              </span>
              <button class="btn btn-secondary btn-sm" onclick="clearQueries()">Clear History</button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Domain</th>
                <th>Client</th>
                <th>Status</th>
                <th>Response</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="queries-table-body">
              <tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">Loading queries...</td></tr>
            </tbody>
          </table>
          <div style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted);">
            <div id="query-pagination-info">Showing 0 of 0</div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" id="btn-prev-page" onclick="changeQueryPage(-1)">Previous</button>
              <button class="btn btn-secondary btn-sm" id="btn-next-page" onclick="changeQueryPage(1)">Next</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. GRAVITY & LISTS TAB -->
      <section id="tab-gravity" class="tab-content">
        <div style="display: flex; gap: 20px; flex-direction: column;">
          <!-- Gravity Action Card -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <div>
                <h3 style="font-size: 16px; font-weight: 700;">AdHole Gravity</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  Gravity aggregates and compiles blocklists from trusted ad, malware, and tracker blocklists.
                </p>
              </div>
              <button class="btn btn-success" id="btn-update-gravity" onclick="triggerGravityUpdate()">
                🚀 Update Gravity Lists Now
              </button>
            </div>
            <!-- Live Progress / Console Output -->
            <div class="console-box" id="gravity-console">Ready to update blocklists. Click "Update Gravity Lists Now" above.</div>
          </div>

          <!-- Manage Blocklists Table -->
          <div class="table-container">
            <div class="table-toolbar">
              <h3 style="font-size: 14px; font-weight: 600;">Configured Blocklists</h3>
              <button class="btn btn-primary btn-sm" onclick="openAddListModal()">+ Add Blocklist</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>List Name</th>
                  <th>URL / Source</th>
                  <th>Domains</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="blocklists-table-body">
                <tr><td colspan="6" style="text-align:center; padding:20px;">Loading blocklists...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 4. CUSTOM RULES TAB -->
      <section id="tab-rules" class="tab-content">
        <div class="grid-2col">
          <!-- Add Rule Form -->
          <div class="card">
            <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 16px;">Add Custom Rule</h3>
            <form onsubmit="handleAddRule(event)">
              <div class="form-group">
                <label>Rule Type</label>
                <select id="rule-type">
                  <option value="blacklist">Blacklist (Block)</option>
                  <option value="whitelist">Whitelist (Allow)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Matching Kind</label>
                <select id="rule-kind">
                  <option value="exact">Exact Domain (e.g. tracking.example.com)</option>
                  <option value="wildcard">Wildcard (e.g. *.example.com)</option>
                  <option value="regex">Regex (e.g. ^ad.*\\.net$)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Domain / Pattern</label>
                <input type="text" id="rule-pattern" placeholder="e.g. analytics.tiktok.com or *.ads.com" required>
              </div>
              <div class="form-group">
                <label>Comment / Note (Optional)</label>
                <input type="text" id="rule-comment" placeholder="Why this rule was added">
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 8px;">
                Save Rule
              </button>
            </form>
          </div>

          <!-- Rules List -->
          <div class="table-container" style="align-self: start;">
            <div class="table-toolbar">
              <h3 style="font-size: 14px; font-weight: 600;">Active Custom Rules</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Pattern</th>
                  <th>Kind</th>
                  <th>Comment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="rules-table-body">
                <tr><td colspan="5" style="text-align:center; padding:20px;">No custom rules added.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 5. LOCAL DNS TAB -->
      <section id="tab-local-dns" class="tab-content">
        <div class="grid-2col">
          <div class="card">
            <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 16px;">Add Local DNS Record</h3>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
              Assign custom domain names to local network devices (e.g. NAS, home server, router).
            </p>
            <form onsubmit="handleAddLocalRecord(event)">
              <div class="form-group">
                <label>Domain Name</label>
                <input type="text" id="local-domain" placeholder="e.g. nas.home or myrouter.lan" required>
              </div>
              <div class="form-group">
                <label>IP Address</label>
                <input type="text" id="local-ip" placeholder="e.g. 192.168.1.100" required>
              </div>
              <div class="form-group">
                <label>Record Type</label>
                <select id="local-type">
                  <option value="A">A (IPv4)</option>
                  <option value="AAAA">AAAA (IPv6)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Comment</label>
                <input type="text" id="local-comment" placeholder="e.g. Synology NAS">
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 8px;">
                Save Local Record
              </button>
            </form>
          </div>

          <div class="table-container" style="align-self: start;">
            <div class="table-toolbar">
              <h3 style="font-size: 14px; font-weight: 600;">Custom DNS Mappings</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>IP Address</th>
                  <th>Type</th>
                  <th>Comment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="local-records-table-body">
                <tr><td colspan="5" style="text-align:center; padding:20px;">No local records configured.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 6. LOOKUP DIAGNOSTIC TAB -->
      <section id="tab-lookup" class="tab-content">
        <div class="card" style="max-width: 700px; margin: 0 auto;">
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">DNS Query Diagnostic Tool</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
            Test how AdHole classifies and resolves any domain name to verify your blocking rules.
          </p>

          <form onsubmit="handleTestLookup(event)" style="display: flex; gap: 10px; margin-bottom: 20px;">
            <input type="text" id="lookup-domain-input" placeholder="e.g. telemetry.microsoft.com or github.com" style="flex: 1;" required>
            <select id="lookup-type-select" style="width: 100px;">
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
            </select>
            <button type="submit" class="btn btn-primary">Test Lookup</button>
          </form>

          <div id="lookup-result-card" style="display: none; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div style="font-family: monospace; font-size: 15px; font-weight: 700;" id="lookup-res-domain">domain.com</div>
              <span class="badge" id="lookup-res-badge">BLOCKED</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
              <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Verdict Reason:</span> <span id="lookup-res-reason" style="font-weight:600;">-</span></div>
              <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Matched Rule/List:</span> <span id="lookup-res-rule" style="font-family:monospace;">-</span></div>
              <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Resolved IP:</span> <span id="lookup-res-ip" style="font-family:monospace; color:#60a5fa;">-</span></div>
              <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Response Time:</span> <span id="lookup-res-time">-</span></div>
            </div>
          </div>
        </div>
      </section>

      <!-- 7. SETTINGS TAB -->
      <section id="tab-settings" class="tab-content">
        <div style="max-width: 800px; display: flex; flex-direction: column; gap: 20px;">
          <!-- Upstream DNS Settings -->
          <div class="card">
            <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">Upstream DNS Resolvers</h3>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
              AdHole forwards non-blocked queries to these upstream recursive DNS servers.
            </p>
            <div class="form-group">
              <label>Upstream Servers (Comma-separated)</label>
              <input type="text" id="setting-upstreams" value="1.1.1.1, 1.0.0.1, 8.8.8.8, 9.9.9.9">
            </div>
            <div class="form-group">
              <label>Upstream Strategy</label>
              <select id="setting-strategy">
                <option value="race">Fastest Race (Queries all servers simultaneously, uses fastest response)</option>
                <option value="fallback">Sequential Fallback (Uses primary, fails over if timeout)</option>
              </select>
            </div>
          </div>

          <!-- Blocking Behavior -->
          <div class="card">
            <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">Blocking Behavior</h3>
            <div class="form-row">
              <div class="form-group">
                <label>Blocking Mode</label>
                <select id="setting-blocking-mode">
                  <option value="ZERO_IP">0.0.0.0 / :: (Null IP - Fastest & Standard)</option>
                  <option value="NXDOMAIN">NXDOMAIN (Domain Does Not Exist)</option>
                  <option value="REFUSED">REFUSED (Refuse Query)</option>
                  <option value="CUSTOM_IP">Custom IP Address</option>
                </select>
              </div>
              <div class="form-group">
                <label>Custom Block IP</label>
                <input type="text" id="setting-custom-ip" placeholder="0.0.0.0">
              </div>
            </div>
          </div>

          <!-- SafeSearch & Privacy -->
          <div class="card">
            <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 16px;">SafeSearch & Privacy</h3>
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 600;">Google SafeSearch</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Enforce strict SafeSearch for all Google searches</div>
                </div>
                <label class="switch"><input type="checkbox" id="setting-safesearch-google"><span class="slider"></span></label>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 600;">Bing SafeSearch</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Enforce strict SafeSearch for Bing</div>
                </div>
                <label class="switch"><input type="checkbox" id="setting-safesearch-bing"><span class="slider"></span></label>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 600;">YouTube Restricted Mode</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Enforce YouTube Moderate/Strict restriction</div>
                </div>
                <label class="switch"><input type="checkbox" id="setting-safesearch-youtube"><span class="slider"></span></label>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 600;">Anonymize Client IPs in Logs</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Mask the last octet of client IPv4 / IPv6 addresses</div>
                </div>
                <label class="switch"><input type="checkbox" id="setting-anonymize-ips"><span class="slider"></span></label>
              </div>
            </div>
          </div>

          <!-- Cache & Operations -->
          <div class="card">
            <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">DNS Cache & Database Actions</h3>
            <div style="display: flex; gap: 12px; margin-top: 12px;">
              <button class="btn btn-secondary" onclick="flushDnsCache()">🧹 Flush DNS Cache</button>
              <button class="btn btn-danger" onclick="clearQueries()">🗑️ Clear All Query Logs</button>
            </div>
          </div>

          <div>
            <button class="btn btn-primary" onclick="saveSettings()" style="padding: 10px 24px; font-size: 14px;">
              💾 Save All Settings
            </button>
          </div>
        </div>
      </section>
    </div>
  </main>

  <!-- Add List Modal -->
  <div class="modal-overlay" id="add-list-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>Add New Blocklist</h3>
        <button class="close-btn" onclick="closeAddListModal()">&times;</button>
      </div>
      <form onsubmit="handleAddBlocklist(event)">
        <div class="form-group">
          <label>List Name</label>
          <input type="text" id="modal-list-name" placeholder="e.g. OISD Big Blocklist" required>
        </div>
        <div class="form-group">
          <label>List URL</label>
          <input type="url" id="modal-list-url" placeholder="https://..." required>
        </div>
        <div class="form-group">
          <label>Format</label>
          <select id="modal-list-type">
            <option value="hosts">Hosts File format (0.0.0.0 domain.com)</option>
            <option value="domain">Plain Domain List (one domain per line)</option>
            <option value="adblock">Adblock Plus / ABP format (||domain.com^)</option>
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="closeAddListModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Blocklist</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    // State
    let currentTab = 'dashboard';
    let queriesChart = null;
    let queryPage = 1;
    let ws = null;
    let debounceTimer = null;

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      setupNavigation();
      initChart();
      initWebSocket();
      fetchDashboardStats();
      fetchBlocklists();
      fetchRules();
      fetchLocalRecords();
      fetchSettings();
      fetchQueries();

      // Periodic stats refresh
      setInterval(fetchDashboardStats, 10000);
    });

    // Navigation
    function setupNavigation() {
      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          const tab = item.getAttribute('data-tab');
          showTab(tab);
        });
      });
    }

    function showTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      const navEl = document.querySelector(\`.nav-item[data-tab="\${tab}"]\`);
      const tabEl = document.getElementById(\`tab-\${tab}\`);
      if (navEl) navEl.classList.add('active');
      if (tabEl) tabEl.classList.add('active');

      const titles = {
        'dashboard': 'Dashboard Overview',
        'queries': 'DNS Query Log',
        'gravity': 'Gravity & Blocklists',
        'rules': 'Custom Rules & Filters',
        'local-dns': 'Local DNS Records',
        'lookup': 'DNS Diagnostic Tool',
        'settings': 'Server & DNS Settings'
      };
      document.getElementById('page-title').textContent = titles[tab] || 'AdHole DNS';

      if (tab === 'queries') fetchQueries();
      if (tab === 'gravity') fetchBlocklists();
      if (tab === 'rules') fetchRules();
      if (tab === 'local-dns') fetchLocalRecords();
      if (tab === 'settings') fetchSettings();
    }

    // Chart.js setup
    function initChart() {
      const ctx = document.getElementById('queriesChart').getContext('2d');
      queriesChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Permitted',
              data: [],
              backgroundColor: '#3b82f6',
              borderRadius: 4,
              stack: 'queries'
            },
            {
              label: 'Blocked',
              data: [],
              backgroundColor: '#ef4444',
              borderRadius: 4,
              stack: 'queries'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              stacked: true,
              grid: { color: 'rgba(55, 65, 81, 0.3)' },
              ticks: { color: '#9ca3af', font: { size: 11 } }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { color: 'rgba(55, 65, 81, 0.3)' },
              ticks: { color: '#9ca3af', font: { size: 11 } }
            }
          }
        }
      });
    }

    // Live WebSocket connection for real-time DNS stream
    function initWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = \`\${protocol}//\${window.location.host}/ws/live\`;

      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          document.getElementById('live-stream-dot').style.background = '#10b981';
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'query') {
              handleLiveQuery(msg.data);
            } else if (msg.type === 'gravity-progress') {
              handleGravityProgress(msg.data);
            }
          } catch(e) {}
        };
        ws.onclose = () => {
          document.getElementById('live-stream-dot').style.background = '#ef4444';
          setTimeout(initWebSocket, 3000);
        };
      } catch(e) {}
    }

    function handleLiveQuery(query) {
      // If currently on Query Log page and page is 1, prepend to table
      if (currentTab === 'queries' && queryPage === 1) {
        const tbody = document.getElementById('queries-table-body');
        const row = createQueryTableRow(query);
        tbody.insertAdjacentHTML('afterbegin', row);
        if (tbody.children.length > 50) {
          tbody.removeChild(tbody.lastChild);
        }
      }

      // Increment total count in dashboard
      const totalEl = document.getElementById('stat-total-queries');
      if (totalEl) {
        const cur = parseInt(totalEl.textContent.replace(/,/g, ''), 10) || 0;
        totalEl.textContent = (cur + 1).toLocaleString();
      }
      if (query.status === 'blocked') {
        const blockEl = document.getElementById('stat-blocked-queries');
        if (blockEl) {
          const cur = parseInt(blockEl.textContent.replace(/,/g, ''), 10) || 0;
          blockEl.textContent = (cur + 1).toLocaleString();
        }
      }
    }

    // Fetch Stats
    async function fetchDashboardStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        document.getElementById('stat-total-queries').textContent = data.totalQueriesToday.toLocaleString();
        document.getElementById('stat-blocked-queries').textContent = data.blockedQueriesToday.toLocaleString();
        document.getElementById('stat-percent-blocked').textContent = data.percentBlockedToday + '%';
        document.getElementById('stat-blocklist-count').textContent = data.blocklistDomainCount.toLocaleString();
        document.getElementById('stat-active-clients').textContent = data.activeClientsToday;
        document.getElementById('stat-unique-domains').textContent = data.uniqueDomainsToday;
        document.getElementById('stat-cache-hit').textContent = data.cacheHitRatio + '%';

        // Update chart
        if (queriesChart && data.queriesOverTime) {
          const labels = data.queriesOverTime.map(d => d.hour);
          const permitted = data.queriesOverTime.map(d => Math.max(0, d.total - d.blocked));
          const blocked = data.queriesOverTime.map(d => d.blocked);

          queriesChart.data.labels = labels;
          queriesChart.data.datasets[0].data = permitted;
          queriesChart.data.datasets[1].data = blocked;
          queriesChart.update();
        }

        // Top Blocked
        const topBlockedEl = document.getElementById('top-blocked-list');
        if (data.topBlocked && data.topBlocked.length > 0) {
          topBlockedEl.innerHTML = data.topBlocked.map(item => \`
            <div class="top-item">
              <span class="top-domain" title="\${item.domain}">\${item.domain}</span>
              <span class="top-count" style="color:#f87171;">\${item.count.toLocaleString()}</span>
            </div>
          \`).join('');
        } else {
          topBlockedEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">No blocked queries yet.</div>';
        }

        // Top Permitted
        const topPermittedEl = document.getElementById('top-permitted-list');
        if (data.topPermitted && data.topPermitted.length > 0) {
          topPermittedEl.innerHTML = data.topPermitted.map(item => \`
            <div class="top-item">
              <span class="top-domain" title="\${item.domain}">\${item.domain}</span>
              <span class="top-count" style="color:#60a5fa;">\${item.count.toLocaleString()}</span>
            </div>
          \`).join('');
        } else {
          topPermittedEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">No permitted queries yet.</div>';
        }

        // Top Clients
        const topClientsEl = document.getElementById('top-clients-list');
        if (data.topClients && data.topClients.length > 0) {
          topClientsEl.innerHTML = data.topClients.map(item => \`
            <div class="top-item">
              <span class="top-domain">\${item.clientIp}</span>
              <span class="top-count">\${item.count.toLocaleString()}</span>
            </div>
          \`).join('');
        } else {
          topClientsEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">No client queries yet.</div>';
        }
      } catch(e) {
        console.error('Error fetching stats:', e);
      }
    }

    // Queries Table
    function debounceFetchQueries() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchQueries, 300);
    }

    async function fetchQueries() {
      const search = document.getElementById('query-search').value;
      const status = document.getElementById('query-status-filter').value;
      const tbody = document.getElementById('queries-table-body');

      try {
        const res = await fetch(\`/api/queries?page=\${queryPage}&limit=50&search=\${encodeURIComponent(search)}&status=\${status}\`);
        const data = await res.json();

        if (data.queries.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No DNS queries found matching filter.</td></tr>';
        } else {
          tbody.innerHTML = data.queries.map(q => createQueryTableRow(q)).join('');
        }

        document.getElementById('query-pagination-info').textContent = \`Page \${data.page} of \${data.totalPages} (\${data.total} total queries)\`;
        document.getElementById('btn-prev-page').disabled = data.page <= 1;
        document.getElementById('btn-next-page').disabled = data.page >= data.totalPages;
      } catch(e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#ef4444;">Failed to load queries.</td></tr>';
      }
    }

    function createQueryTableRow(q) {
      const date = new Date(q.timestamp);
      const timeStr = date.toLocaleTimeString([], { hour12: false });
      let badgeClass = 'badge-forwarded';
      let statusText = 'ALLOWED';

      if (q.status === 'blocked') { badgeClass = 'badge-blocked'; statusText = 'BLOCKED'; }
      else if (q.status === 'cached') { badgeClass = 'badge-cached'; statusText = 'CACHED'; }
      else if (q.status === 'local') { badgeClass = 'badge-local'; statusText = 'LOCAL'; }

      return \`
        <tr>
          <td style="color:var(--text-muted); font-size:12px;">\${timeStr}</td>
          <td><span style="font-family:monospace; background:rgba(255,255,255,0.06); padding:2px 5px; border-radius:4px; font-size:11px;">\${q.queryType || 'A'}</span></td>
          <td style="font-family:monospace; font-weight:500; max-width:280px; overflow:hidden; text-overflow:ellipsis;" title="\${q.domain}">\${q.domain}</td>
          <td style="color:var(--text-muted); font-size:12px;">\${q.clientIp}</td>
          <td><span class="badge \${badgeClass}">\${statusText}</span></td>
          <td style="font-size:11px; color:var(--text-muted);">\${q.responseTimeMs}ms <span style="opacity:0.7;">(\${q.upstreamServer || '-'})</span></td>
          <td>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-secondary btn-sm" onclick="quickRule('\${q.domain}', 'whitelist')" title="Whitelist Domain">🛡️ Allow</button>
              <button class="btn btn-danger btn-sm" onclick="quickRule('\${q.domain}', 'blacklist')" title="Blacklist Domain">🚫 Block</button>
            </div>
          </td>
        </tr>
      \`;
    }

    function changeQueryPage(delta) {
      queryPage = Math.max(1, queryPage + delta);
      fetchQueries();
    }

    async function clearQueries() {
      if (!confirm('Are you sure you want to clear all query logs?')) return;
      await fetch('/api/queries/clear', { method: 'POST' });
      fetchQueries();
      fetchDashboardStats();
    }

    async function quickRule(domain, type) {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: domain,
          type: type,
          ruleKind: 'exact',
          comment: 'Added from Query Log'
        })
      });
      if (res.ok) {
        alert(\`Domain \${domain} added to \${type} successfully!\`);
        fetchRules();
      }
    }

    // Gravity & Blocklists
    async function fetchBlocklists() {
      const tbody = document.getElementById('blocklists-table-body');
      try {
        const res = await fetch('/api/lists');
        const lists = await res.json();
        tbody.innerHTML = lists.map(l => \`
          <tr>
            <td>
              <label class="switch">
                <input type="checkbox" \${l.enabled ? 'checked' : ''} onchange="toggleBlocklist(\${l.id}, this.checked)">
                <span class="slider"></span>
              </label>
            </td>
            <td style="font-weight:600;">\${l.name}</td>
            <td style="font-family:monospace; font-size:11px; color:var(--text-muted); max-width:300px; overflow:hidden; text-overflow:ellipsis;" title="\${l.url}">\${l.url}</td>
            <td style="font-weight:600; color:#34d399;">\${(l.domainCount || 0).toLocaleString()}</td>
            <td style="font-size:12px; color:var(--text-muted);">\${l.lastUpdated ? new Date(l.lastUpdated).toLocaleDateString() : 'Never'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteBlocklist(\${l.id})">Delete</button>
            </td>
          </tr>
        \`).join('');
      } catch(e) {}
    }

    async function toggleBlocklist(id, enabled) {
      await fetch(\`/api/lists/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
    }

    async function deleteBlocklist(id) {
      if (!confirm('Delete this blocklist?')) return;
      await fetch(\`/api/lists/\${id}\`, { method: 'DELETE' });
      fetchBlocklists();
    }

    function openAddListModal() { document.getElementById('add-list-modal').style.display = 'flex'; }
    function closeAddListModal() { document.getElementById('add-list-modal').style.display = 'none'; }

    async function handleAddBlocklist(e) {
      e.preventDefault();
      const name = document.getElementById('modal-list-name').value;
      const url = document.getElementById('modal-list-url').value;
      const type = document.getElementById('modal-list-type').value;

      await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, type, enabled: true })
      });
      closeAddListModal();
      fetchBlocklists();
    }

    async function triggerGravityUpdate() {
      const consoleBox = document.getElementById('gravity-console');
      const btn = document.getElementById('btn-update-gravity');
      btn.disabled = true;
      btn.textContent = 'Updating...';
      consoleBox.textContent = '>>> Starting Gravity compilation...\\n';

      try {
        const res = await fetch('/api/gravity/update', { method: 'POST' });
        const data = await res.json();
        consoleBox.textContent += \`\\n>>> Success! Loaded \${data.totalUniqueDomains.toLocaleString()} unique domains into memory.\\n\`;
        if (data.errors && data.errors.length > 0) {
          consoleBox.textContent += \`>>> Warnings:\\n\${data.errors.join('\\n')}\\n\`;
        }
        fetchBlocklists();
        fetchDashboardStats();
      } catch(e) {
        consoleBox.textContent += \`\\n>>> Error: \${e.message}\\n\`;
      } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Update Gravity Lists Now';
      }
    }

    function handleGravityProgress(progress) {
      const consoleBox = document.getElementById('gravity-console');
      if (consoleBox) {
        consoleBox.textContent += \`[\${progress.stage}] \${progress.message}\\n\`;
        consoleBox.scrollTop = consoleBox.scrollHeight;
      }
    }

    // Custom Rules
    async function fetchRules() {
      const tbody = document.getElementById('rules-table-body');
      try {
        const res = await fetch('/api/rules');
        const rules = await res.json();
        if (rules.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No custom rules defined.</td></tr>';
          return;
        }
        tbody.innerHTML = rules.map(r => \`
          <tr>
            <td><span class="badge \${r.type === 'blacklist' ? 'badge-blocked' : 'badge-forwarded'}">\${r.type}</span></td>
            <td style="font-family:monospace; font-weight:600;">\${r.pattern}</td>
            <td style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">\${r.ruleKind}</td>
            <td style="font-size:12px; color:var(--text-muted);">\${r.comment || '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteRule(\${r.id})">Delete</button>
            </td>
          </tr>
        \`).join('');
      } catch(e) {}
    }

    async function handleAddRule(e) {
      e.preventDefault();
      const type = document.getElementById('rule-type').value;
      const ruleKind = document.getElementById('rule-kind').value;
      const pattern = document.getElementById('rule-pattern').value;
      const comment = document.getElementById('rule-comment').value;

      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ruleKind, pattern, comment, enabled: true })
      });
      document.getElementById('rule-pattern').value = '';
      document.getElementById('rule-comment').value = '';
      fetchRules();
    }

    async function deleteRule(id) {
      await fetch(\`/api/rules/\${id}\`, { method: 'DELETE' });
      fetchRules();
    }

    // Local DNS Records
    async function fetchLocalRecords() {
      const tbody = document.getElementById('local-records-table-body');
      try {
        const res = await fetch('/api/records');
        const records = await res.json();
        if (records.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No local records configured.</td></tr>';
          return;
        }
        tbody.innerHTML = records.map(r => \`
          <tr>
            <td style="font-family:monospace; font-weight:600;">\${r.domain}</td>
            <td style="font-family:monospace; color:#60a5fa;">\${r.ipAddress}</td>
            <td><span style="background:rgba(255,255,255,0.06); padding:2px 5px; border-radius:4px; font-size:11px;">\${r.recordType}</span></td>
            <td style="font-size:12px; color:var(--text-muted);">\${r.comment || '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteLocalRecord(\${r.id})">Delete</button>
            </td>
          </tr>
        \`).join('');
      } catch(e) {}
    }

    async function handleAddLocalRecord(e) {
      e.preventDefault();
      const domain = document.getElementById('local-domain').value;
      const ipAddress = document.getElementById('local-ip').value;
      const recordType = document.getElementById('local-type').value;
      const comment = document.getElementById('local-comment').value;

      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, ipAddress, recordType, comment, enabled: true })
      });
      document.getElementById('local-domain').value = '';
      document.getElementById('local-ip').value = '';
      document.getElementById('local-comment').value = '';
      fetchLocalRecords();
    }

    async function deleteLocalRecord(id) {
      await fetch(\`/api/records/\${id}\`, { method: 'DELETE' });
      fetchLocalRecords();
    }

    // Lookup Tool
    async function handleTestLookup(e) {
      e.preventDefault();
      const domain = document.getElementById('lookup-domain-input').value.trim();
      const type = document.getElementById('lookup-type-select').value;
      const card = document.getElementById('lookup-result-card');

      try {
        const res = await fetch(\`/api/lookup?domain=\${encodeURIComponent(domain)}&type=\${type}\`);
        const data = await res.json();

        card.style.display = 'block';
        document.getElementById('lookup-res-domain').textContent = data.domain;

        const badge = document.getElementById('lookup-res-badge');
        if (data.blocked) {
          badge.className = 'badge badge-blocked';
          badge.textContent = 'BLOCKED';
        } else if (data.status === 'local') {
          badge.className = 'badge badge-local';
          badge.textContent = 'LOCAL DNS';
        } else if (data.status === 'cached') {
          badge.className = 'badge badge-cached';
          badge.textContent = 'CACHED';
        } else {
          badge.className = 'badge badge-forwarded';
          badge.textContent = 'PERMITTED';
        }

        document.getElementById('lookup-res-reason').textContent = data.reason || (data.blocked ? 'Matched Blocklist' : 'Allowed / Forwarded');
        document.getElementById('lookup-res-rule').textContent = data.matchedRule || data.matchedList || 'None';
        document.getElementById('lookup-res-ip').textContent = data.resolvedIp || 'N/A';
        document.getElementById('lookup-res-time').textContent = data.responseTimeMs + ' ms';
      } catch(e) {
        alert('Failed to lookup domain');
      }
    }

    // Settings
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings');
        const s = await res.json();

        document.getElementById('dns-port-badge').textContent = ':' + s.dnsPort;
        document.getElementById('setting-upstreams').value = s.upstreams ? s.upstreams.join(', ') : '1.1.1.1, 8.8.8.8';
        document.getElementById('setting-strategy').value = s.upstreamStrategy || 'race';
        document.getElementById('setting-blocking-mode').value = s.blockingMode || 'ZERO_IP';
        document.getElementById('setting-custom-ip').value = s.customBlockIp || '0.0.0.0';
        document.getElementById('setting-safesearch-google').checked = !!s.safeSearchGoogle;
        document.getElementById('setting-safesearch-bing').checked = !!s.safeSearchBing;
        document.getElementById('setting-safesearch-youtube').checked = !!s.safeSearchYouTube;
        document.getElementById('setting-anonymize-ips').checked = !!s.anonymizeIps;
      } catch(e) {}
    }

    async function saveSettings() {
      const upstreams = document.getElementById('setting-upstreams').value.split(',').map(s => s.trim()).filter(Boolean);
      const upstreamStrategy = document.getElementById('setting-strategy').value;
      const blockingMode = document.getElementById('setting-blocking-mode').value;
      const customBlockIp = document.getElementById('setting-custom-ip').value;
      const safeSearchGoogle = document.getElementById('setting-safesearch-google').checked;
      const safeSearchBing = document.getElementById('setting-safesearch-bing').checked;
      const safeSearchYouTube = document.getElementById('setting-safesearch-youtube').checked;
      const anonymizeIps = document.getElementById('setting-anonymize-ips').checked;

      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upstreams,
          upstreamStrategy,
          blockingMode,
          customBlockIp,
          safeSearchGoogle,
          safeSearchBing,
          safeSearchYouTube,
          anonymizeIps
        })
      });
      alert('Settings saved successfully!');
    }

    async function flushDnsCache() {
      await fetch('/api/cache/flush', { method: 'POST' });
      alert('DNS Cache flushed successfully!');
      fetchDashboardStats();
    }
  </script>
</body>
</html>
`;
}
