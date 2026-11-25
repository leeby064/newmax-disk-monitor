/**
 * IsoDiskKernel — 2.5D Isometric Wireframe Disk Figure Kernel
 * Built upon the `iso-figure` (MrBongoC/ai-iso-skill) 15-line SVG matrix projection kernel.
 * Zero external dependencies. Supports both the 252x160 info-card inline view and the full window view.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'disk_wireframe_monitor_state_v2';
  const PREFS_KEY = 'disk_wireframe_user_prefs_v1';
  const METRICS_FILE = 'live-metrics.json';
  const CLEANUP_FILE = 'cleanup-report.json';
  const PREFS_FILE = 'user-prefs.json';
  const TRIGGER_FILE = 'scan-trigger.json';
  const CONNECTION_FILE = 'connection.json';
  const DEFAULT_SCAN_ROOTS = ['~/Documents/GitHub', '~/Downloads', '~/Library/Logs'];

  // Baseline APFS snapshot (used only before first async load or if kv is empty)
  const DEFAULT_SNAPSHOT = {
    containerName: 'disk3 · Macintosh HD',
    filesystem: 'APFS (Case-insensitive, FileVault)',
    totalGB: 994.6,
    usedGB: 751.6,
    freeGB: 243.0,
    usedPct: 75.6,
    thresholdPct: 80,
    activeLayer: 'all',
    autoIntervalSec: 5,
    autoRunning: true,
    scanCount: 1,
    lastUpdated: '2026-11-17 18:00:00',
    layers: [
      {
        id: 'all',
        code: 'ALL',
        label: '整盘总览',
        shortLabel: '总览',
        mount: '/ (Container disk3)',
        role: 'APFS Container',
        usedGB: 751.6,
        totalGB: 994.6,
        freeGB: 243.0,
        pct: 75.6,
        iops: '495 MB/s',
        desc: 'APFS 容器总空间（含数据卷、系统封存快照、VM 交换及恢复分区）'
      },
      {
        id: 'data',
        code: 'DAT',
        label: 'Data 数据卷',
        shortLabel: '数据',
        mount: '/System/Volumes/Data',
        role: 'disk3s5 · Data',
        usedGB: 721.0,
        totalGB: 994.6,
        freeGB: 243.0,
        pct: 72.5,
        iops: '353 MB/s',
        desc: '用户主目录、应用与本地工作区数据（FileVault 已加密解锁）'
      },
      {
        id: 'system',
        code: 'SYS',
        label: 'System 系统与交换',
        shortLabel: '系统',
        mount: '/ + /System/Volumes/VM',
        role: 'disk3s1/s2/s6 · System+VM',
        usedGB: 28.9,
        totalGB: 994.6,
        freeGB: 243.0,
        pct: 2.9,
        iops: '175 MB/s',
        desc: '只读签名系统快照 + VM 虚拟内存 + Preboot/Recovery'
      },
      {
        id: 'sim',
        code: 'SIM',
        label: 'Simulator 镜像卷',
        shortLabel: '模拟器',
        mount: '/Library/Developer/CoreSimulator',
        role: 'disk5 + disk9 · Runtime',
        usedGB: 35.6,
        totalGB: 36.6,
        freeGB: 1.0,
        pct: 97.3,
        iops: '94 MB/s',
        desc: 'iOS Simulator 独立挂载容器（固定只读镜像卷）'
      }
    ],
    directories: [
      { id: 'dir-apps', name: '/Applications', category: '系统应用', sizeGB: 41.4, path: '/Applications' },
      { id: 'dir-downloads', name: '~/Downloads', category: '下载目录', sizeGB: 31.6, path: '/Users/jaylee/Downloads' },
      { id: 'dir-caches', name: '~/Library/Caches', category: '用户缓存', sizeGB: 19.5, path: '/Users/jaylee/Library/Caches' },
      { id: 'dir-sim', name: 'CoreSimulator Volumes', category: '开发镜像', sizeGB: 35.6, path: '/Library/Developer/CoreSimulator' },
      { id: 'dir-system', name: 'System & VM Swap', category: '系统内核', sizeGB: 28.9, path: '/System/Volumes/VM' }
    ]
  };

  function cloneDefault() {
    return JSON.parse(JSON.stringify(DEFAULT_SNAPSHOT));
  }

  function escapeXml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Recalculate totals ONLY when user explicitly runs a manual simulation override.
   * Real APFS disk metrics come directly from `df -k` via disk_daemon.py and must NOT be overwritten.
   */
  function recalcTotals(state) {
    const dataLayer = state.layers.find((l) => l.id === 'data');
    const sysLayer = state.layers.find((l) => l.id === 'system');
    const allLayer = state.layers.find((l) => l.id === 'all');
    if (dataLayer && sysLayer && allLayer) {
      const total = Math.max(100, Number(allLayer.totalGB) || 994.6);
      const used = Number((Number(dataLayer.usedGB) + Number(sysLayer.usedGB)).toFixed(1));
      const free = Math.max(0, Number((total - used).toFixed(1)));
      const pct = Math.min(100, Math.max(0, Number(((used / total) * 100).toFixed(1))));

      state.totalGB = total;
      state.usedGB = used;
      state.freeGB = free;
      state.usedPct = pct;

      allLayer.totalGB = total;
      allLayer.usedGB = used;
      allLayer.freeGB = free;
      allLayer.pct = pct;

      dataLayer.totalGB = total;
      dataLayer.freeGB = free;
      dataLayer.pct = Number(((dataLayer.usedGB / total) * 100).toFixed(1));

      sysLayer.totalGB = total;
      sysLayer.freeGB = free;
      sysLayer.pct = Number(((sysLayer.usedGB / total) * 100).toFixed(1));
    }
    return state;
  }

  function syncDerivedFields(state) {
    if (!state || !Array.isArray(state.layers)) return state;
    const simLayer = state.layers.find((l) => l.id === 'sim');
    const sysLayer = state.layers.find((l) => l.id === 'system');
    if (Array.isArray(state.directories)) {
      state.directories.forEach((d) => {
        if (d.id === 'dir-sim' && simLayer && Number.isFinite(Number(simLayer.usedGB))) {
          d.sizeGB = Number(simLayer.usedGB);
        }
        if (d.id === 'dir-system' && sysLayer && Number.isFinite(Number(sysLayer.usedGB))) {
          d.sizeGB = Number(sysLayer.usedGB);
        }
      });
    }
    // Ensure every layer has fallback iops label
    state.layers.forEach((l) => {
      if (!l.iops) {
        const def = DEFAULT_SNAPSHOT.layers.find((dl) => dl.id === l.id);
        l.iops = def ? def.iops : '120 MB/s';
      }
    });
    return state;
  }

  function isDaemonFresh(state, maxAgeSec) {
    const threshold = Number(maxAgeSec) || 60;
    if (!state || !state.lastUpdated) return false;
    const isoLike = String(state.lastUpdated).replace(' ', 'T');
    const ts = Date.parse(isoLike);
    if (!Number.isFinite(ts)) return false;
    return Math.abs(Date.now() - ts) <= threshold * 1000;
  }

  /**
   * Build the 2.5D Isometric Wireframe SVG using `iso-figure` kernel:
   * P, D, plane, TOP, FRONT, SIDE, rect, box
   */
  function buildIsoDiskSvg(state, options) {
    const opts = options || {};
    const compact = Boolean(opts.compact);
    const activeId = state.activeLayer || 'all';
    const activeLayer = state.layers.find((l) => l.id === activeId) || state.layers[0];
    const threshold = Number(state.thresholdPct) || 80;
    const isWarn = activeLayer.pct >= threshold || state.usedPct >= threshold;

    const dataLayer = state.layers.find((l) => l.id === 'data') || { usedGB: 721.0, pct: 72.5 };
    const sysLayer = state.layers.find((l) => l.id === 'system') || { usedGB: 28.9, pct: 2.9 };
    const simLayer = state.layers.find((l) => l.id === 'sim') || { usedGB: 35.6, pct: 97.3 };

    // === iso-figure 15-line projection kernel (verbatim mathematical foundation) ===
    const C = Math.cos(Math.PI / 6);
    const S = Math.sin(Math.PI / 6);
    const OX = 205;
    const OY = 162;
    const P = (x, y, z) => [(x - y) * C + OX, (x + y) * S - z + OY];
    const D = (x, y, z) => [(x - y) * C, (x + y) * S - z];
    const plane = (O, U, V) => {
      const o = P(...O);
      const u = D(...U);
      const v = D(...V);
      return `matrix(${u[0].toFixed(4)} ${u[1].toFixed(4)} ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`;
    };
    const TOP = (x, y, z) => plane([x, y, z], [1, 0, 0], [0, 1, 0]);
    const FRONT = (x, y, z) => plane([x, y, z], [1, 0, 0], [0, 0, -1]);
    const SIDE = (x, y, z) => plane([x, y, z], [0, -1, 0], [0, 0, -1]);
    const rect = (t, w, h, r = 0, cls = 'face') =>
      `<g transform="${t}"><rect class="${cls}" width="${w}" height="${h}" rx="${r}"/></g>`;
    const box = (x, y, z, w, d, h, r = 0, extraCls = '') =>
      rect(SIDE(x + w, y + d, z + h), d, h, Math.min(r, h / 4), `face side ${extraCls}`.trim()) +
      rect(FRONT(x, y + d, z + h), w, h, Math.min(r, h / 4), `face front ${extraCls}`.trim()) +
      rect(TOP(x, y, z + h), w, d, r, `face top ${extraCls}`.trim());

    let svg = '';

    if (compact) {
      // === Compact 2.5D Isometric Wireframe for 252x160 Info-Card ===
      svg += `<g class="iso-chassis">`;
      svg += box(12, 6, 4, 132, 128, 12, 5);
      svg += `<g transform="${FRONT(12, 134, 16)}">`;
      svg += `<circle class="led-dot ${isWarn ? 'warn' : 'ok'}" cx="14" cy="6" r="2.2"/>`;
      svg += `<line class="detail" x1="24" y1="6" x2="118" y2="6"/>`;
      svg += `</g>`;
      svg += `</g>`;

      const compactSlabs = [
        {
          id: 'sim',
          z: 18,
          h: 13,
          code: 'SIM',
          fillRatio: Math.max(0.08, Math.min(1, Number(simLayer.pct) / 100))
        },
        {
          id: 'system',
          z: 35,
          h: 13,
          code: 'SYS',
          fillRatio: Math.max(0.12, Math.min(1, Number(sysLayer.pct) / 25))
        },
        {
          id: 'data',
          z: 52,
          h: 16,
          code: 'DAT',
          fillRatio: Math.max(0.1, Math.min(1, Number(dataLayer.pct) / 100))
        }
      ];

      const csx = 24;
      const csy = 16;
      const csw = 108;
      const csd = 104;

      compactSlabs.forEach((slab, idx) => {
        const isSelected = activeId === slab.id || (activeId === 'all' && slab.id === 'data');
        const isDirectActive = activeId === slab.id;
        const topZ = slab.z + slab.h;
        const usedW = Math.round((csw - 20) * slab.fillRatio);

        svg += `<g class="press iso-part ${isDirectActive ? 'active' : ''} ${isSelected ? 'selected-slab' : ''}" data-layer="${slab.id}" role="button" tabindex="-1" aria-label="${slab.code}">`;
        svg += box(csx, csy, slab.z, csw, csd, slab.h, 4, isSelected ? 'live-box' : '');

        svg += `<g transform="${FRONT(csx, csy + csd, topZ)}">`;
        svg += `<rect class="detail" x="10" y="${Math.max(2, (slab.h - 4) / 2).toFixed(1)}" width="${csw - 20}" height="4" rx="1"/>`;
        svg += `<rect class="meter-fill ${isSelected ? 'live-fill' : ''}" x="10" y="${Math.max(2, (slab.h - 4) / 2).toFixed(1)}" width="${usedW}" height="4" rx="1"/>`;
        svg += `</g>`;

        svg += `<g transform="${TOP(csx, csy, topZ)}">`;
        if (idx === compactSlabs.length - 1) {
          const cx = 54;
          const cy = 52;
          svg += `<circle class="detail ${isSelected ? 'live-line' : ''}" cx="${cx}" cy="${cy}" r="31"/>`;
          svg += `<circle class="face ${isSelected ? 'live-box' : ''}" cx="${cx}" cy="${cy}" r="6"/>`;

          const pctAngle = Math.min(359.9, Math.max(14, activeLayer.pct * 3.6));
          const rad = ((pctAngle - 90) * Math.PI) / 180;
          const ax = (cx + 31 * Math.cos(rad)).toFixed(2);
          const ay = (cy + 31 * Math.sin(rad)).toFixed(2);
          const largeArc = pctAngle > 180 ? 1 : 0;
          svg += `<path class="arc-live" d="M ${cx} ${cy - 31} A 31 31 0 ${largeArc} 1 ${ax} ${ay}"/>`;
        }
        svg += `<text class="iso-slab-label ${isSelected ? 'live-text' : ''}" x="10" y="94" font-size="8.5">${escapeXml(slab.code)}</text>`;
        svg += `</g>`;
        svg += `</g>`;
      });

      svg += `<g class="press iso-part" data-action="scan" role="button" tabindex="-1" aria-label="磁头扫描校准">`;
      svg += box(26, 20, 68, 16, 16, 8, 2, activeId === 'all' ? 'live-box' : '');
      svg += `<g transform="${TOP(26, 20, 76)}">`;
      svg += `<line class="detail live-line" x1="14" y1="12" x2="46" y2="38"/>`;
      svg += `<circle class="led-dot ok" cx="46" cy="38" r="2.2"/>`;
      svg += `</g>`;
      svg += `</g>`;

      return `<svg class="iso-svg" viewBox="90 100 240 205" role="img" tabindex="0" aria-label="2.5D 等距线框磁盘监控图，点击盘片切换分卷">${svg}</svg>`;
    }

    // 1. Outer Drive Enclosure Base Tray
    svg += `<g class="iso-chassis">`;
    svg += box(0, 0, 0, 156, 144, 16, 6);

    svg += `<g transform="${TOP(0, 0, 16)}">`;
    svg += `<rect class="detail-recess" x="8" y="8" width="140" height="128" rx="4"/>`;
    for (let gx = 18; gx <= 138; gx += 15) {
      svg += `<line class="detail" x1="${gx}" y1="8" x2="${gx}" y2="12"/>`;
      svg += `<line class="detail" x1="${gx}" y1="132" x2="${gx}" y2="136"/>`;
    }
    svg += `<text class="iso-plate-label" x="14" y="131" font-size="7.5">APFS · ${escapeXml(state.totalGB.toFixed(1))}G</text>`;
    svg += `</g>`;

    svg += `<g transform="${SIDE(156, 144, 16)}">`;
    for (let vx = 16; vx <= 124; vx += 9) {
      svg += `<line class="detail" x1="${vx}" y1="4" x2="${vx}" y2="12"/>`;
    }
    svg += `</g>`;

    svg += `<g transform="${FRONT(0, 144, 16)}">`;
    svg += `<rect class="detail" x="10" y="4" width="28" height="8" rx="1.5"/>`;
    svg += `<circle class="led-dot ${isWarn ? 'warn' : 'ok'}" cx="16" cy="8" r="2.2"/>`;
    svg += `<line class="detail" x1="46" y1="8" x2="108" y2="8"/>`;
    svg += `<text class="iso-plate-label" x="114" y="10.5" font-size="6.8">NVMe.0</text>`;
    svg += `</g>`;
    svg += `</g>`;

    // 2. Back-left Controller & I/O Bus Module
    const allSelected = activeId === 'all';
    svg += `<g class="press iso-part ${allSelected ? 'active' : ''}" data-layer="all" role="button" tabindex="-1" aria-label="整盘总览 ${state.usedPct}%">`;
    svg += box(10, 10, 16, 30, 92, 32, 3, allSelected ? 'live-box' : '');
    svg += `<g transform="${TOP(10, 10, 48)}">`;
    svg += `<rect class="detail" x="5" y="6" width="20" height="24" rx="1.5"/>`;
    for (let ry = 36; ry <= 74; ry += 6) {
      svg += `<line class="detail ${allSelected ? 'live-line' : ''}" x1="5" y1="${ry}" x2="25" y2="${ry}"/>`;
    }
    svg += `<text class="iso-chip-text ${allSelected ? 'live-text' : ''}" x="7" y="20" font-size="7.5">ALL</text>`;
    svg += `</g>`;
    svg += `</g>`;

    // 3. Stacked 2.5D Storage Volume Slabs (dynamic labels & bars from real layers)
    const slabDefinitions = [
      {
        id: 'sim',
        z: 16,
        h: 14,
        code: `SIM · ${Math.round(simLayer.pct)}%`,
        fillRatio: Math.max(0.08, Math.min(1, Number(simLayer.pct) / 100)),
        sub: `${Number(simLayer.usedGB).toFixed(1)}G`
      },
      {
        id: 'system',
        z: 33,
        h: 14,
        code: `SYS · ${Number(sysLayer.pct).toFixed(1)}%`,
        fillRatio: Math.max(0.12, Math.min(1, Number(sysLayer.pct) / 25)),
        sub: `${Number(sysLayer.usedGB).toFixed(1)}G`
      },
      {
        id: 'data',
        z: 50,
        h: 18,
        code: `DATA · ${Math.round(dataLayer.pct)}%`,
        fillRatio: Math.max(0.1, Math.min(1, Number(dataLayer.pct) / 100)),
        sub: `${Number(dataLayer.usedGB).toFixed(1)}G`
      }
    ];

    const sx = 48;
    const sy = 12;
    const sw = 96;
    const sd = 94;

    slabDefinitions.forEach((slab, idx) => {
      const isSelected = activeId === slab.id || (activeId === 'all' && slab.id === 'data');
      const isDirectActive = activeId === slab.id;
      const topZ = slab.z + slab.h;
      const usedW = Math.round((sw - 16) * slab.fillRatio);

      svg += `<g class="press iso-part ${isDirectActive ? 'active' : ''} ${activeId === 'all' ? 'all-mode' : ''}" data-layer="${slab.id}" role="button" tabindex="-1" aria-label="${slab.code}">`;
      svg += box(sx, sy, slab.z, sw, sd, slab.h, 4, isSelected ? 'live-box' : '');

      svg += `<g transform="${FRONT(sx, sy + sd, topZ)}">`;
      svg += `<rect class="detail" x="8" y="${Math.max(2, (slab.h - 5) / 2).toFixed(1)}" width="${sw - 16}" height="5" rx="1"/>`;
      svg += `<rect class="meter-fill ${isSelected ? 'live-fill' : ''}" x="8" y="${Math.max(2, (slab.h - 5) / 2).toFixed(1)}" width="${usedW}" height="5" rx="1"/>`;
      svg += `</g>`;

      svg += `<g transform="${SIDE(sx + sw, sy + sd, topZ)}">`;
      svg += `<line class="detail ${isSelected ? 'live-line' : ''}" x1="10" y1="${(slab.h / 2).toFixed(1)}" x2="${sd - 10}" y2="${(slab.h / 2).toFixed(1)}" stroke-dasharray="4 3"/>`;
      svg += `</g>`;

      svg += `<g transform="${TOP(sx, sy, topZ)}">`;
      svg += `<rect class="detail" x="8" y="8" width="${sw - 16}" height="8" rx="1.5"/>`;
      svg += `<rect class="sector-bar ${isSelected ? 'live-fill' : ''}" x="8" y="8" width="${usedW}" height="8" rx="1.5"/>`;

      const cx = 48;
      const cy = 52;
      svg += `<circle class="detail ${isSelected ? 'live-line' : ''}" cx="${cx}" cy="${cy}" r="31"/>`;
      svg += `<circle class="detail" cx="${cx}" cy="${cy}" r="22" stroke-dasharray="6 3"/>`;
      svg += `<circle class="detail ${isSelected ? 'live-line' : ''}" cx="${cx}" cy="${cy}" r="12"/>`;
      svg += `<circle class="face" cx="${cx}" cy="${cy}" r="4.5"/>`;
      svg += `<line class="detail" x1="${cx - 31}" y1="${cy}" x2="${cx - 13}" y2="${cy}"/>`;
      svg += `<line class="detail" x1="${cx + 13}" y1="${cy}" x2="${cx + 31}" y2="${cy}"/>`;
      svg += `<line class="detail" x1="${cx}" y1="${cy - 31}" x2="${cx}" y2="${cy - 13}"/>`;
      svg += `<line class="detail" x1="${cx}" y1="${cy + 13}" x2="${cx}" y2="${cy + 31}"/>`;

      const pctAngle = Math.min(359.9, Math.max(12, activeLayer.pct * 3.6));
      const rad = ((pctAngle - 90) * Math.PI) / 180;
      const ax = (cx + 26 * Math.cos(rad)).toFixed(2);
      const ay = (cy + 26 * Math.sin(rad)).toFixed(2);
      const largeArc = pctAngle > 180 ? 1 : 0;
      svg += `<path class="arc-live" d="M ${cx} ${cy - 26} A 26 26 0 ${largeArc} 1 ${ax} ${ay}"/>`;

      svg += `<text class="iso-slab-label ${isSelected ? 'live-text' : ''}" x="8" y="88" font-size="7.5">${escapeXml(slab.code)}</text>`;
      if (!compact) {
        svg += `<text class="iso-slab-sub" x="62" y="88" font-size="7">${escapeXml(slab.sub)}</text>`;
      }
      svg += `</g>`;
      svg += `</g>`;

      if (idx === slabDefinitions.length - 1) {
        const cageZ = topZ + 2;
        const cageH = 12;
        svg += `<g class="iso-free-cage" pointer-events="none">`;
        svg += `<g transform="${TOP(sx, sy, cageZ + cageH)}">`;
        svg += `<rect class="cage-wire" x="2" y="2" width="${sw - 4}" height="${sd - 4}" rx="3"/>`;
        svg += `<text class="iso-cage-label" x="8" y="13" font-size="6.8">FREE ${escapeXml(state.freeGB.toFixed(1))}G</text>`;
        svg += `</g>`;
        svg += `</g>`;
      }
    });

    // 4. Read/Write Actuator Arm Post
    svg += `<g class="press iso-part" data-action="scan" role="button" tabindex="-1" aria-label="磁头扫描校准">`;
    svg += box(14, 74, 48, 20, 22, 24, 3);
    svg += `<g transform="${TOP(14, 52, 72)}">`;
    svg += `<path class="face top live-line" d="M 10 28 L 76 10 L 80 15 L 14 36 Z"/>`;
    svg += `<circle class="face live-line" cx="12" cy="31" r="4"/>`;
    svg += `<circle class="led-dot ok" cx="77" cy="12.5" r="2.2"/>`;
    svg += `</g>`;
    svg += `</g>`;

    // 5. Front-most interactive Volume Selector Keys
    const keyItems = [
      { id: 'all', label: 'ALL', x: 10, w: 30 },
      { id: 'data', label: 'DAT', x: 44, w: 30 },
      { id: 'system', label: 'SYS', x: 78, w: 30 },
      { id: 'sim', label: 'SIM', x: 112, w: 32 }
    ];

    keyItems.forEach((k) => {
      const isKeyActive = activeId === k.id;
      svg += `<g class="press iso-part iso-key ${isKeyActive ? 'active' : ''}" data-layer="${k.id}" role="button" tabindex="-1" aria-label="切换 ${k.label}">`;
      svg += box(k.x, 112, 16, k.w, 24, isKeyActive ? 9 : 12, 2.5, isKeyActive ? 'live-box key-active' : '');
      svg += `<g transform="${TOP(k.x, 112, isKeyActive ? 25 : 28)}">`;
      svg += `<text class="iso-key-text ${isKeyActive ? 'live-text' : ''}" x="${(k.w / 2).toFixed(1)}" y="15" text-anchor="middle" font-size="7.8">${k.label}</text>`;
      svg += `</g>`;
      svg += `</g>`;
    });

    const viewBox = compact ? '54 74 298 242' : '46 66 314 256';
    return `<svg class="iso-svg" viewBox="${viewBox}" role="img" tabindex="0" aria-label="2.5D 等距线框磁盘监控图，点击盘片或按键切换分卷">${svg}</svg>`;
  }

  function formatReadout(state) {
    const active = state.layers.find((l) => l.id === state.activeLayer) || state.layers[0];
    const statusWord = active.pct >= state.thresholdPct ? 'warn' : 'ok';
    return `${statusWord} · ${active.code.toLowerCase()} ${active.usedGB.toFixed(1)}g/${active.totalGB.toFixed(1)}g · ${active.pct.toFixed(1)}%`;
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
    return `${n} B`;
  }

  function formatSizeMB(mb) {
    const n = Number(mb) || 0;
    if (n >= 1000) return `${(n / 1000).toFixed(2)} GB`;
    return `${n.toFixed(1)} MB`;
  }

  function normalizeScanRoots(roots) {
    if (!Array.isArray(roots)) return DEFAULT_SCAN_ROOTS.slice();
    const cleaned = roots
      .map((s) => String(s || '').trim())
      .filter((s) => s.length > 0);
    return cleaned.length > 0 ? Array.from(new Set(cleaned)) : DEFAULT_SCAN_ROOTS.slice();
  }

  function extractPrefs(state) {
    return {
      activeLayer: state.activeLayer || 'all',
      thresholdPct: Number(state.thresholdPct) || 80,
      autoIntervalSec: state.autoIntervalSec != null ? Number(state.autoIntervalSec) : 5,
      autoRunning: state.autoRunning !== false,
      keepLatestVersions: Math.max(1, Math.min(5, Number(state.keepLatestVersions) || 1)),
      minSizeMB: Math.max(1, Math.min(500, Number(state.minSizeMB) || 1)),
      includeAppCaches: state.includeAppCaches !== false,
      includeDownloadLargeFiles: state.includeDownloadLargeFiles !== false,
      largeFileMB: Math.max(10, Math.min(2000, Number(state.largeFileMB) || 50)),
      scanRoots: normalizeScanRoots(state.scanRoots)
    };
  }

  function applyManualOverride(merged, override) {
    if (!override || !override.targetId || !Number.isFinite(Number(override.usedGB))) {
      merged.isSimulated = false;
      return merged;
    }
    const targetId = override.targetId;
    const rawUsed = Number(override.usedGB);
    const layer = merged.layers.find((l) => l.id === targetId);
    if (layer && rawUsed > 0) {
      layer.usedGB = Number(rawUsed.toFixed(1));
      if (targetId === 'sim') {
        layer.totalGB = Math.max(layer.totalGB, Number((layer.usedGB + 0.9).toFixed(1)));
        layer.freeGB = Math.max(0.1, Number((layer.totalGB - layer.usedGB).toFixed(2)));
        layer.pct = Math.min(100, Number(((layer.usedGB / layer.totalGB) * 100).toFixed(1)));
      }
      recalcTotals(merged);
      merged.isSimulated = true;
      if (override.updatedAt) {
        merged.lastUpdated = override.updatedAt;
      }
    }
    return merged;
  }

  async function readJsonFile(relativePath) {
    try {
      const sdk = global.newmaxApp;
      if (sdk && sdk.files && typeof sdk.files.readText === 'function') {
        const text = await sdk.files.readText(relativePath);
        if (typeof text === 'string' && text.trim()) {
          return JSON.parse(text);
        }
      }
    } catch (_) {
      // Missing or invalid file
    }
    return null;
  }

  async function writeJsonFile(relativePath, value) {
    try {
      const sdk = global.newmaxApp;
      if (sdk && sdk.files && typeof sdk.files.writeText === 'function') {
        await sdk.files.writeText(relativePath, JSON.stringify(value, null, 2) + '\n');
        return true;
      }
    } catch (_) {
      // Ignore write errors
    }
    return false;
  }

  async function loadPrefs() {
    // Prefer sdk.data (fast KV), fallback to user-prefs.json
    try {
      const sdk = global.newmaxApp;
      if (sdk && sdk.data && typeof sdk.data.get === 'function') {
        const prefs = await sdk.data.get(PREFS_KEY);
        if (prefs && typeof prefs === 'object') {
          return prefs;
        }
      }
    } catch (_) {
      // Ignore read errors
    }
    const filePrefs = await readJsonFile(PREFS_FILE);
    if (filePrefs && typeof filePrefs === 'object') {
      return filePrefs;
    }
    return null;
  }

  async function savePrefs(state) {
    const prefs = extractPrefs(state);
    try {
      const sdk = global.newmaxApp;
      if (sdk && sdk.data && typeof sdk.data.set === 'function') {
        await sdk.data.set(PREFS_KEY, prefs);
      }
      // Also persist to user-prefs.json so the backend collector immediately picks up interval changes
      await writeJsonFile(PREFS_FILE, prefs);
      await updateBadge(state);
    } catch (_) {
      // Ignore write/badge errors
    }
    return prefs;
  }

  async function updateBadge(state) {
    try {
      const sdk = global.newmaxApp;
      if (sdk && sdk.surfaces && typeof sdk.surfaces.setBadge === 'function') {
        const badgeText = `${Math.round(state.usedPct)}%`;
        await sdk.surfaces.setBadge('main-launcher', badgeText);
      }
    } catch (_) {
      // Ignore badge errors
    }
  }

  function mergeLiveAndPrefs(savedLive, savedPrefs) {
    const fallback = cloneDefault();
    const merged =
      savedLive && typeof savedLive === 'object' && Array.isArray(savedLive.layers)
        ? Object.assign({}, fallback, savedLive)
        : fallback;

    if (savedPrefs && typeof savedPrefs === 'object') {
      if (savedPrefs.activeLayer) merged.activeLayer = savedPrefs.activeLayer;
      if (Number.isFinite(Number(savedPrefs.thresholdPct))) {
        merged.thresholdPct = Number(savedPrefs.thresholdPct);
      }
      if (savedPrefs.autoIntervalSec != null) {
        merged.autoIntervalSec = Number(savedPrefs.autoIntervalSec);
      }
      if (typeof savedPrefs.autoRunning === 'boolean') {
        merged.autoRunning = savedPrefs.autoRunning;
      }
      merged.keepLatestVersions = Math.max(1, Math.min(5, Number(savedPrefs.keepLatestVersions) || 1));
      merged.minSizeMB = Math.max(1, Math.min(500, Number(savedPrefs.minSizeMB) || 1));
      merged.includeAppCaches = savedPrefs.includeAppCaches !== false;
      merged.includeDownloadLargeFiles = savedPrefs.includeDownloadLargeFiles !== false;
      merged.largeFileMB = Math.max(10, Math.min(2000, Number(savedPrefs.largeFileMB) || 50));
      merged.scanRoots = normalizeScanRoots(savedPrefs.scanRoots);
    } else {
      merged.autoIntervalSec = 5;
      merged.autoRunning = true;
      merged.keepLatestVersions = 1;
      merged.minSizeMB = 1;
      merged.includeAppCaches = true;
      merged.includeDownloadLargeFiles = true;
      merged.largeFileMB = 50;
      merged.scanRoots = DEFAULT_SCAN_ROOTS.slice();
    }

    return syncDerivedFields(merged);
  }

  /**
   * Read the latest live disk metrics:
   * 1. Prefer live-metrics.json written by the host-managed backend service (disk_service.py).
   * 2. Fall back to kv.json (STORAGE_KEY) if live-metrics.json does not exist yet.
   * 3. Merge user preferences (activeLayer, thresholdPct, autoIntervalSec, autoRunning, manualOverride).
   */
  async function loadState() {
    try {
      const [fileLive, savedPrefs] = await Promise.all([
        readJsonFile(METRICS_FILE),
        loadPrefs()
      ]);

      if (fileLive && Array.isArray(fileLive.layers)) {
        return mergeLiveAndPrefs(fileLive, savedPrefs);
      }

      const sdk = global.newmaxApp;
      const kvLive =
        sdk && sdk.data && typeof sdk.data.get === 'function'
          ? await sdk.data.get(STORAGE_KEY).catch(() => null)
          : null;

      return mergeLiveAndPrefs(kvLive, savedPrefs);
    } catch (_) {
      // Ignore storage read errors in restricted environments
    }
    return syncDerivedFields(cloneDefault());
  }

  async function fetchServiceJson(path, method, bodyObj, timeoutMs) {
    const conn = await readJsonFile(CONNECTION_FILE);
    if (!conn || !conn.baseUrl || !conn.token) return null;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 1500) : null;
    try {
      const resp = await fetch(`${conn.baseUrl}${path}`, {
        method: method || 'GET',
        headers: {
          Authorization: `Bearer ${conn.token}`,
          'Content-Type': 'application/json'
        },
        body: bodyObj ? JSON.stringify(bodyObj) : undefined,
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      if (json && json.ok) return json.data;
    } catch (_) {
      // Isolated surface views block fetch; callers fall back to trigger file.
    } finally {
      if (timer) clearTimeout(timer);
    }
    return null;
  }

  /**
   * Trigger an immediate real `df -k` collection via scan-trigger.json (works in isolated surfaces).
   * Returns { state, scanned: boolean, via: 'trigger'|'cache' }.
   */
  async function triggerLiveScan() {
    const reqId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const before = await readJsonFile(METRICS_FILE);
    const beforeCount = before ? Number(before.scanCount || 0) : 0;
    const wrote = await writeJsonFile(TRIGGER_FILE, {
      requestId: reqId,
      action: 'scan_disk',
      requestedAt: Date.now()
    });

    if (wrote) {
      const deadline = Date.now() + 2800;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 120));
        const cur = await readJsonFile(METRICS_FILE);
        if (cur && Array.isArray(cur.layers)) {
          if (cur.triggerId === reqId || Number(cur.scanCount || 0) > beforeCount) {
            const prefs = await loadPrefs();
            const merged = mergeLiveAndPrefs(cur, prefs);
            return { state: merged, scanned: true, via: 'trigger' };
          }
        }
      }
    }

    const latest = await loadState();
    return { state: latest, scanned: false, via: 'cache' };
  }

  async function loadCleanupReport() {
    const rep = await readJsonFile(CLEANUP_FILE);
    if (rep && typeof rep === 'object' && Array.isArray(rep.items)) {
      return rep;
    }
    return null;
  }

  async function triggerCleanupScan() {
    const reqId = `clnscan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const wrote = await writeJsonFile(TRIGGER_FILE, {
      requestId: reqId,
      action: 'scan_cleanup',
      requestedAt: Date.now()
    });
    if (wrote) {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 180));
        const cur = await readJsonFile(CLEANUP_FILE);
        if (cur && cur.triggerId === reqId) {
          return { ok: true, report: cur };
        }
      }
    }
    const cached = await loadCleanupReport();
    return { ok: false, report: cached };
  }

  async function cleanSelectedItems() {
    return {
      ok: false,
      error: '清理已改由 NewMax 确认执行，没有把请求交给后台，没有移动任何文件。'
    };
  }

  async function checkServiceHealth() {
    const live = await readJsonFile(METRICS_FILE);
    const conn = await readJsonFile(CONNECTION_FILE);
    if (conn && conn.pid && live && live.sampledAtMs) {
      return { running: true, pid: conn.pid, via: 'connection' };
    }
    if (live && live.sampledAtMs) {
      const ageMs = Date.now() - Number(live.sampledAtMs);
      const prefs = await loadPrefs();
      const intervalMs = Math.max(5, Number((prefs && prefs.autoIntervalSec) || 5)) * 1000;
      if (ageMs <= Math.max(20000, intervalMs * 2 + 5000)) {
        return { running: true, pid: live.servicePid || null, via: 'metrics' };
      }
    }
    return { running: false, pid: null, via: 'none' };
  }

  async function stopCollectorService() {
    const reqId = `stop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const wrote = await writeJsonFile(TRIGGER_FILE, {
      requestId: reqId,
      action: 'stop_service',
      requestedAt: Date.now()
    });
    if (!wrote) return false;
    await new Promise((r) => setTimeout(r, 700));
    const conn = await readJsonFile(CONNECTION_FILE);
    return !conn;
  }

  /**
   * Save user preferences into PREFS_KEY + user-prefs.json.
   */
  async function saveState(state) {
    syncDerivedFields(state);
    await savePrefs(state);
    return state;
  }

  /**
   * Build a compact fingerprint to detect real metric/config changes without needless DOM repaints.
   */
  function getStateFingerprint(state) {
    if (!state) return '';
    const active = state.layers && state.layers.find((l) => l.id === state.activeLayer);
    const cleanGB = state.cleanupSummary ? state.cleanupSummary.totalCleanableGB : '';
    const cleanCnt = state.cleanupSummary ? state.cleanupSummary.itemCount : '';
    return [
      state.activeLayer,
      state.thresholdPct,
      state.autoIntervalSec,
      state.autoRunning ? 1 : 0,
      state.scanCount,
      state.lastUpdated,
      state.usedGB,
      state.freeGB,
      state.usedPct,
      active ? active.usedGB : '',
      active ? active.pct : '',
      cleanGB,
      cleanCnt
    ].join('|');
  }

  function stepDynamicMetrics(state) {
    return syncDerivedFields(state);
  }

  function simulateDynamicSampling(state) {
    return syncDerivedFields(state);
  }

  global.IsoDiskKernel = {
    STORAGE_KEY,
    PREFS_KEY,
    METRICS_FILE,
    CLEANUP_FILE,
    PREFS_FILE,
    TRIGGER_FILE,
    DEFAULT_SCAN_ROOTS,
    DEFAULT_SNAPSHOT,
    cloneDefault,
    recalcTotals,
    syncDerivedFields,
    isDaemonFresh,
    formatBytes,
    formatSizeMB,
    normalizeScanRoots,
    getStateFingerprint,
    stepDynamicMetrics,
    simulateDynamicSampling,
    buildIsoDiskSvg,
    formatReadout,
    loadPrefs,
    savePrefs,
    updateBadge,
    loadState,
    saveState,
    loadCleanupReport,
    triggerLiveScan,
    triggerCleanupScan,
    cleanSelectedItems,
    checkServiceHealth,
    stopCollectorService
  };
})(window);
