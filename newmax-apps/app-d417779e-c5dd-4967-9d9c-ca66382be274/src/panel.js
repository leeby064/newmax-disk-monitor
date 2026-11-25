(function () {
  'use strict';

  const K = window.IsoDiskKernel;

  let diskState = K.cloneDefault();
  let cleanupReport = null;
  let activeTab = 'cleanup';
  let activeCategory = 'all';
  let searchQuery = '';
  let selectedIds = new Set();
  let trashNotice = '';
  let isBusy = false;
  let pollTimer = null;
  let lastDiskFp = '';
  let serviceRunning = null;

  // Header & Tabs
  const heroPctEl = document.getElementById('heroPct');
  const heroUsageEl = document.getElementById('heroUsage');
  const heroUpdatedEl = document.getElementById('heroUpdated');
  const heroMeterFillEl = document.getElementById('heroMeterFill');
  const statusPillEl = document.getElementById('statusPill');
  const btnScanAll = document.getElementById('btnScanAll');
  const btnScanLabel = document.getElementById('btnScanLabel');
  const tabCleanCountEl = document.getElementById('tabCleanCount');

  // Cleanup Tab
  const cleanableTotalEl = document.getElementById('cleanableTotal');
  const btnToggleProtected = document.getElementById('btnToggleProtected');
  const protectedSummaryTextEl = document.getElementById('protectedSummaryText');
  const protectedDrawerEl = document.getElementById('protectedDrawer');
  const protectedListEl = document.getElementById('protectedList');
  const serviceAlertBannerEl = document.getElementById('serviceAlertBanner');
  const catFilterBarEl = document.getElementById('catFilterBar');
  const searchInputEl = document.getElementById('searchInput');
  const btnSelectVisible = document.getElementById('btnSelectVisible');
  const btnClearSelect = document.getElementById('btnClearSelect');
  const cleanupFeedbackEl = document.getElementById('cleanupFeedback');
  const cleanupListEl = document.getElementById('cleanupList');

  // Bottom Action Bar
  const cleanupFooterEl = document.getElementById('cleanupFooter');
  const selectedCountTextEl = document.getElementById('selectedCountText');
  const selectedSizeTextEl = document.getElementById('selectedSizeText');
  const grantStatusTextEl = document.getElementById('grantStatusText');
  const btnRequestClean = document.getElementById('btnRequestClean');

  // Overview Tab
  const panelIsoStageEl = document.getElementById('panelIsoStage');
  const isoReadoutEl = document.getElementById('isoReadout');
  const volumeListEl = document.getElementById('volumeList');

  // Settings Tab
  const settingsForm = document.getElementById('settingsForm');
  const setIntervalEl = document.getElementById('setInterval');
  const setThresholdEl = document.getElementById('setThreshold');
  const setThresholdValEl = document.getElementById('setThresholdVal');
  const setKeepVersionsEl = document.getElementById('setKeepVersions');
  const setMinSizeEl = document.getElementById('setMinSize');
  const setIncludeAppCachesEl = document.getElementById('setIncludeAppCaches');
  const setIncludeDownloadLargeEl = document.getElementById('setIncludeDownloadLarge');
  const setScanRootsEl = document.getElementById('setScanRoots');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnResetSettings = document.getElementById('btnResetSettings');
  const settingsFeedbackEl = document.getElementById('settingsFeedback');
  const serviceStatusTextEl = document.getElementById('serviceStatusText');
  const btnStopService = document.getElementById('btnStopService');

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showFeedback(el, text, tone) {
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'md-banner';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = `md-banner${tone ? ' ' + tone : ''}`;
  }

  function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.md-seg-btn').forEach((btn) => {
      const isAct = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isAct);
      btn.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });
    document.querySelectorAll('.md-tab-panel').forEach((sec) => {
      const isAct = sec.id === `tab-${tabName}`;
      sec.hidden = !isAct;
      sec.classList.toggle('active', isAct);
    });
    if (tabName === 'overview') {
      renderOverview();
    } else if (tabName === 'settings') {
      syncSettingsForm();
      refreshServiceStatus();
    }
    updateCleanupFooter();
  }

  function renderHeader() {
    const isWarn = diskState.usedPct >= diskState.thresholdPct;
    heroPctEl.textContent = `${diskState.usedPct.toFixed(1)}%`;
    heroUsageEl.textContent = `${diskState.usedGB.toFixed(1)} / ${diskState.totalGB.toFixed(1)} GB · 余 ${diskState.freeGB.toFixed(1)} GB`;
    const timePart = diskState.lastUpdated ? String(diskState.lastUpdated).slice(11, 19) : '--';
    const modeLabel = diskState.autoRunning ? `每${diskState.autoIntervalSec || 5}s` : '已暂停';
    heroUpdatedEl.textContent = `#${diskState.scanCount || 1} · ${timePart} · ${modeLabel}`;

    heroMeterFillEl.style.width = `${Math.min(100, Math.max(2, diskState.usedPct))}%`;
    heroMeterFillEl.classList.toggle('warn', isWarn);

    statusPillEl.classList.toggle('warn', isWarn);
    statusPillEl.textContent = isWarn ? `≥${diskState.thresholdPct}% 预警` : '健康';

    if (serviceRunning === false) {
      serviceAlertBannerEl.hidden = false;
      serviceAlertBannerEl.textContent =
        '采集服务没在运行，清单可能不是最新的。移入废纸篓不依赖采集进程，点按钮后由 NewMax 确认完整路径。';
    } else {
      serviceAlertBannerEl.hidden = true;
    }
  }

  function canDirectDelete(item) {
    const path = canonicalPath(item && item.path);
    if (!path || pathVerdict(path)) return false;
    if (item.isDir) return item.hostTrashBlock === 'ok';
    return true;
  }

  function listableItems() {
    return ((cleanupReport && cleanupReport.items) || []).filter(canDirectDelete);
  }

  function getFilteredItems() {
    if (!cleanupReport || !Array.isArray(cleanupReport.items)) return [];
    const q = searchQuery.trim().toLowerCase();
    return listableItems().filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (q) {
        const hay = `${item.name} ${item.displayPath} ${item.reason} ${item.categoryLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderProtectedCaches() {
    const caches = (cleanupReport && cleanupReport.protectedCaches) || [];
    const totalGB = cleanupReport ? Number(cleanupReport.protectedTotalGB || 0) : 0;
    const totalMB = cleanupReport ? Number(cleanupReport.protectedTotalMB || 0) : 0;
    const sizeText = totalGB >= 1 ? `${totalGB.toFixed(2)} GB` : `${totalMB.toFixed(0)} MB`;
    protectedSummaryTextEl.textContent = `已保护依赖缓存 ${sizeText}`;

    if (caches.length === 0) {
      protectedListEl.innerHTML =
        '<div class="md-label-sm">未检测到本地依赖缓存目录（已自动排除 node_modules、.npm、pnpm、Electron 等）</div>';
      return;
    }

    protectedListEl.innerHTML = caches
      .map((c) => `<div class="protected-row">
        <div>
          <strong>${esc(c.label)}</strong>
          <span class="protected-row-path">${esc(c.path)}</span>
        </div>
        <span class="md-mono-val">${esc(K.formatSizeMB(c.sizeMB))}</span>
      </div>`)
      .join('');
  }

  function renderCategoryFilters() {
    const items = listableItems();
    const defs = [
      { id: 'all', label: '全部' },
      { id: 'app-cache', label: '应用缓存' },
      { id: 'build-temp', label: '打包临时' },
      { id: 'history-version', label: '历史版本' },
      { id: 'installer', label: '安装包/镜像' },
      { id: 'large-file', label: '下载大文件' },
      { id: 'logs', label: '日志' }
    ];

    const counts = { all: items.length };
    items.forEach((it) => {
      counts[it.category] = (counts[it.category] || 0) + 1;
    });

    if (activeCategory !== 'all' && !(counts[activeCategory] > 0)) {
      activeCategory = 'all';
    }

    catFilterBarEl.innerHTML = defs
      .filter((d) => d.id === 'all' || (counts[d.id] || 0) > 0)
      .map((d) => {
        const act = activeCategory === d.id ? 'active' : '';
        return `<button type="button" class="filter-chip ${act}" data-cat="${d.id}">${d.label} (${counts[d.id] || 0})</button>`;
      })
      .join('');
  }

  function renderCleanupList() {
    if (!cleanupReport) {
      cleanableTotalEl.textContent = '--';
      tabCleanCountEl.textContent = '0';
      cleanupListEl.innerHTML = '<div class="md-empty">尚未生成清理清单，点击右上角「扫描」开始分析。</div>';
      updateCleanupFooter();
      return;
    }

    const listed = listableItems();
    const validIds = new Set(listed.map((item) => item.id));
    Array.from(selectedIds).forEach((id) => {
      if (!validIds.has(id)) selectedIds.delete(id);
    });

    const listedBytes = listed.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
    cleanableTotalEl.textContent = K.formatBytes(listedBytes);
    tabCleanCountEl.textContent = String(listed.length);

    renderProtectedCaches();
    renderCategoryFilters();

    const filtered = getFilteredItems();
    if (filtered.length === 0) {
      cleanupListEl.innerHTML =
        cleanupReport.itemCount === 0
          ? '<div class="md-empty">当前扫描目录下没有可安全清理的文件。</div>'
          : '<div class="md-empty">当前筛选条件下无匹配条目。</div>';
      updateCleanupFooter();
      return;
    }

    cleanupListEl.innerHTML = filtered
      .map((item) => {
        const checked = selectedIds.has(item.id);
        const hostNote = itemHostNote(item);
        return `<label class="clean-item ${checked ? 'selected' : ''}" data-item-id="${esc(item.id)}" role="listitem">
          <input type="checkbox" class="clean-checkbox" data-check-id="${esc(item.id)}" ${checked ? 'checked' : ''} aria-label="选择 ${esc(item.name)}" />
          <div class="clean-content">
            <div class="clean-top">
              <span class="clean-name">${esc(item.name)}</span>
              <span class="clean-size">${esc(K.formatSizeMB(item.sizeMB))}</span>
            </div>
            <div class="clean-meta">
              <span class="cat-tag ${esc(item.category)}">${esc(item.categoryLabel)}</span>
              <span>${esc(item.modifiedAt || '')}</span>
              ${hostNote}
            </div>
            <div class="clean-reason">${esc(item.reason)}</div>
            <div class="clean-path" title="${esc(item.displayPath)}">${esc(item.displayPath)}</div>
          </div>
        </label>`;
      })
      .join('');

    updateCleanupFooter();
  }

  function updateCleanupFooter() {
    if (activeTab !== 'cleanup' || selectedIds.size === 0) {
      cleanupFooterEl.hidden = true;
      return;
    }

    const items = selectedItems();
    if (items.length === 0) {
      cleanupFooterEl.hidden = true;
      return;
    }

    const totalBytes = items.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
    cleanupFooterEl.hidden = false;
    selectedCountTextEl.textContent = `已选 ${items.length} 项`;
    selectedSizeTextEl.textContent = `约 ${K.formatBytes(totalBytes)}`;
    const plan = planTrash();
    grantStatusTextEl.textContent = trashNotice || plan.status;
    btnRequestClean.disabled = isBusy;
  }

  function renderOverview() {
    panelIsoStageEl.innerHTML = K.buildIsoDiskSvg(diskState, { compact: false });
    isoReadoutEl.textContent = K.formatReadout(diskState);

    volumeListEl.innerHTML = diskState.layers
      .map((layer) => {
        const isAct = layer.id === diskState.activeLayer;
        return `<button type="button" class="vol-card ${isAct ? 'active' : ''}" data-vol-id="${esc(layer.id)}">
          <div class="vol-card-top">
            <span class="vol-code">${esc(layer.code)} · ${esc(layer.label)}</span>
            <span class="vol-pct">${layer.pct.toFixed(1)}%</span>
          </div>
          <div class="vol-sub">
            <span>已用 ${layer.usedGB.toFixed(1)} / ${layer.totalGB.toFixed(1)} GB</span>
            <span>余 ${layer.freeGB.toFixed(1)} GB</span>
          </div>
          <div class="clean-path">${esc(layer.mount)}</div>
        </button>`;
      })
      .join('');
  }

  function syncSettingsForm() {
    const intVal = diskState.autoRunning ? String(Number(diskState.autoIntervalSec) || 5) : '0';
    setIntervalEl.value = ['5', '15', '30', '0'].includes(intVal) ? intVal : '5';
    setThresholdEl.value = String(diskState.thresholdPct || 80);
    setThresholdValEl.textContent = `${diskState.thresholdPct || 80}%`;
    setKeepVersionsEl.value = String(diskState.keepLatestVersions || 1);
    setMinSizeEl.value = String(diskState.minSizeMB || 1);
    if (setIncludeAppCachesEl) setIncludeAppCachesEl.checked = diskState.includeAppCaches !== false;
    if (setIncludeDownloadLargeEl) setIncludeDownloadLargeEl.checked = diskState.includeDownloadLargeFiles !== false;
    setScanRootsEl.value = (diskState.scanRoots || K.DEFAULT_SCAN_ROOTS).join('\n');
  }

  async function refreshServiceStatus() {
    const health = await K.checkServiceHealth();
    serviceRunning = !!health.running;
    renderHeader();
    if (health.running) {
      const permTag = diskState.canWriteTrash === false ? ' · 只读受限' : '';
      serviceStatusTextEl.textContent = health.pid ? `运行中 (PID ${health.pid}${permTag})` : `运行中${permTag}`;
      btnStopService.disabled = false;
    } else {
      serviceStatusTextEl.textContent = '未运行';
      btnStopService.disabled = true;
    }
  }

  function setupPollTimer() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    const intervalSec = Number(diskState.autoIntervalSec) || 5;
    if (!diskState.autoRunning || intervalSec <= 0) return;
    const uiPollMs = intervalSec <= 5 ? 2500 : intervalSec <= 15 ? 4000 : 6000;
    pollTimer = setInterval(() => {
      if (document.hidden || isBusy) return;
      refreshFromDiskOnly();
    }, uiPollMs);
  }

  async function refreshFromDiskOnly(forceRender) {
    const latest = await K.loadState();
    const fp = K.getStateFingerprint(latest) + '|' + (latest.canWriteTrash === false ? 'ro' : 'rw');
    const intervalChanged =
      latest.autoIntervalSec !== diskState.autoIntervalSec || latest.autoRunning !== diskState.autoRunning;
    diskState = latest;
    if (intervalChanged) setupPollTimer();
    if (forceRender || fp !== lastDiskFp) {
      lastDiskFp = fp;
      renderHeader();
      if (activeTab === 'overview') renderOverview();
      await K.updateBadge(diskState);
    }
  }

  async function runFullScan(showStatusMsg) {
    if (isBusy) return;
    isBusy = true;
    btnScanAll.disabled = true;
    btnScanLabel.textContent = '扫描中...';
    try {
      const [diskRes, clnRes] = await Promise.all([
        K.triggerLiveScan(),
        K.triggerCleanupScan()
      ]);
      diskState = diskRes.state;
      lastDiskFp = K.getStateFingerprint(diskState) + '|' + (diskState.canWriteTrash === false ? 'ro' : 'rw');
      if (clnRes.report) {
        cleanupReport = clnRes.report;
      } else {
        cleanupReport = await K.loadCleanupReport();
      }
      renderHeader();
      renderCleanupList();
      if (activeTab === 'overview') renderOverview();
      await K.updateBadge(diskState);

      if (showStatusMsg) {
        if (clnRes.ok && cleanupReport) {
          showFeedback(
            cleanupFeedbackEl,
            `扫描完成（${cleanupReport.scannedAt}）：发现 ${cleanupReport.itemCount} 项可安全清理，共 ${K.formatBytes(cleanupReport.totalCleanableBytes)}。`,
            'ok'
          );
        } else if (!diskRes.scanned) {
          showFeedback(cleanupFeedbackEl, '本地采集服务未运行，当前展示最近缓存。', 'warn');
        }
      }
    } finally {
      isBusy = false;
      btnScanAll.disabled = false;
      btnScanLabel.textContent = '扫描';
    }
  }

  async function selectLayer(layerId) {
    if (!diskState.layers.some((l) => l.id === layerId)) return;
    diskState.activeLayer = layerId;
    renderOverview();
    await K.savePrefs(diskState);
  }

  let resourceContract;

  const RESOURCE_ERRORS = {
    host_unavailable: '当前宿主没有按路径移入废纸篓的接口，没有移动任何内容。',
    user_gesture_required: '请直接点击按钮。没有移动任何内容。',
    permission_denied: '应用还不能使用废纸篓确认。没有移动任何内容。',
    grant_invalid: '这次没有走选文件夹。授权状态无效，没有移动任何内容。',
    cancelled: '已取消。没有移动任何内容。',
    busy: '正在等待上一次确认。没有移动任何内容。',
    invalid_request: '这批路径不能提交。没有移动任何内容。',
    target_unsafe: 'NewMax 拒绝了这一批，没有移动任何内容。常见原因是文件夹里有受保护条目（如 .git、.env、.app）或链接，或路径不在允许范围。不会交给后台删除。',
    target_missing: '目标已不存在。没有继续移动其余内容。',
    target_exists: '目标已变化。没有继续移动其余内容。',
    target_changed: '目标已变化。没有继续移动其余内容。',
    limit_exceeded: '单批超过限制，或文件夹太大。没有移动任何内容。',
    io_failed: '系统废纸篓执行失败。已完成的项不会回滚，未执行的项仍在原处。'
  };

  const PROTECTED_PARTS = new Set([
    'node_modules', '.git', '.hg', '.svn', '.ssh', '.gnupg', '.aws', '.azure', '.kube',
    '.docker', '.netrc', '.npmrc', '.pypirc', '.git-credentials', '.gitconfig',
    '.newmax', '.newmax-clean', '.claude', '.codex', '.gemini'
  ]);
  const PROTECTED_HOME_PARTS = new Set([
    'applications', 'desktop', '.config', '.trash', '.cargo', '.gradle', '.rustup'
  ]);
  const PROTECTED_CACHE_PARTS = new Set([
    'electron', 'electron-builder', 'node-gyp', 'pnpm', 'yarn', 'gradle',
    'cocoapods', 'homebrew', 'ms-playwright', 'pip', 'uv', 'cargo', 'go', 'go-build', 'coresimulator'
  ]);

  function resourcesApi() {
    const sdk = window.newmaxApp;
    const api = sdk && sdk.resources;
    if (!api || typeof api.applyTargets !== 'function' || typeof api.describe !== 'function') return null;
    return api;
  }

  function canDirectTrash() {
    return !!(resourceContract
      && resourceContract.version === 'resource-operations-v3'
      && resourceContract.oneShot
      && resourceContract.oneShot.has('trash')
      && resourceContract.oneShot.has('trashDirectory'));
  }

  async function ensureResourceContract() {
    const api = resourcesApi();
    if (!api) {
      resourceContract = null;
      return null;
    }
    let described = null;
    try {
      described = await api.describe({ extended: true });
    } catch {
      resourceContract = null;
      return null;
    }
    const value = described && described.ok === true ? described.value : null;
    const oneShot = value && Array.isArray(value.oneShotChanges) ? value.oneShotChanges : null;
    if (!value || value.version !== 'resource-operations-v3' || !oneShot) {
      resourceContract = null;
      return null;
    }
    resourceContract = { version: value.version, oneShot: new Set(oneShot) };
    return resourceContract;
  }

  function resourceError(code) {
    return RESOURCE_ERRORS[code] || 'NewMax 没有移动文件。';
  }

  function canonicalPath(value) {
    const path = String(value || '');
    if (!path.startsWith('/') || path.length > 1024 || path.endsWith('/')) return '';
    const parts = path.split('/');
    if (parts.some((part, index) => index > 0 && (!part || part === '.' || part === '..'))) return '';
    return path;
  }

  function fileBase(item) {
    const parts = String((item && item.path) || '').split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }

  function safeResourceName(name) {
    if (typeof name !== 'string' || !name.length || new TextEncoder().encode(name).length > 255) return false;
    const key = name.normalize('NFKC').toLowerCase();
    if (key === '.' || key === '..' || key !== key.trim()) return false;
    return !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}/\\:]/u.test(key);
  }

  function protectedResourceKey(key) {
    return (
      PROTECTED_PARTS.has(key)
      || /^\.env(?:\.|$)/u.test(key)
      || /\.(app|bundle|framework|plugin|keychain(-db)?|photoslibrary|ssh|pem|p12)$/i.test(key)
    );
  }

  function homeDir() {
    const items = (cleanupReport && cleanupReport.items) || [];
    for (let i = 0; i < items.length; i += 1) {
      const path = String(items[i].path || '');
      const display = String(items[i].displayPath || '');
      if (!display.startsWith('~/') || !path.startsWith('/')) continue;
      const suffix = display.slice(1);
      if (suffix.startsWith('/') && path.endsWith(suffix) && path.length > suffix.length) {
        return path.slice(0, path.length - suffix.length);
      }
    }
    return '';
  }

  function fromHomeParts(path) {
    const home = homeDir();
    if (home && (path === home || path.startsWith(`${home}/`))) {
      return path.slice(home.length + 1).split('/').filter(Boolean);
    }
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'Users' && parts.length >= 3) return parts.slice(2);
    return null;
  }

  function pathVerdict(path) {
    const fromHome = fromHomeParts(path);
    if (!fromHome || !fromHome.length || !fromHome.every(safeResourceName)) return 'name';
    const keys = fromHome.map((part) => part.normalize('NFKC').toLowerCase());
    const [top, section, child] = keys;
    if (PROTECTED_HOME_PARTS.has(top) || (top === 'library' && section !== 'caches' && section !== 'logs')) {
      return 'scope';
    }
    if (
      (top === 'library' && section === 'caches' && PROTECTED_CACHE_PARTS.has(child))
      || (top === '.cache' && PROTECTED_CACHE_PARTS.has(section))
      || (top === 'go' && section === 'pkg' && child === 'mod')
    ) {
      return 'scope';
    }
    if (keys.some(protectedResourceKey)) return 'name';
    return '';
  }

  function itemHostNote(item) {
    if (resourceContract === undefined) return '';
    if (!canDirectTrash()) return '<span class="clean-host-note">当前宿主不能直接删除</span>';
    const path = canonicalPath(item && item.path);
    const verdict = path ? pathVerdict(path) : 'name';
    if (verdict === 'scope') return '<span class="clean-host-note">不在允许的目录范围</span>';
    if (verdict) return '<span class="clean-host-note">名称受保护，不能提交</span>';
    const hold = folderHold(item);
    if (hold === 'unchecked') return '<span class="clean-host-note">先不和文件一起提交</span>';
    if (hold === 'limit') return '<span class="clean-host-note">超过 4000 项，确认前会被拒绝</span>';
    if (hold) return '<span class="clean-host-note">内容会挡住整批确认</span>';
    if (item.isDir) return '<span class="clean-host-note">确认后整夹移入废纸篓</span>';
    return '';
  }

  function folderHold(item) {
    if (!item || !item.isDir) return '';
    if (!Object.prototype.hasOwnProperty.call(item, 'hostTrashBlock')) return 'unchecked';
    if (item.hostTrashBlock === 'ok' || item.hostTrashBlock === '') return '';
    return item.hostTrashBlock || 'unchecked';
  }

  function selectedItems() {
    return listableItems().filter((item) => selectedIds.has(item.id));
  }

  function blockedReason(blocked) {
    const scope = blocked.filter((item) => item.verdict === 'scope').length;
    const name = blocked.length - scope;
    const parts = [];
    if (name) parts.push(`${name} 项属于受保护名称或无效路径，不能提交`);
    if (scope) parts.push(`${scope} 项不在允许范围。资源库里只有缓存和日志可以直接移动`);
    return `${parts.join('。')}。没有移动任何内容，也不会交给后台删除。`;
  }

  function planTrash() {
    const items = selectedItems();
    if (!resourcesApi()) {
      return { changes: [], status: '当前页面没有直接删除接口', reason: '当前页面没有按路径移入废纸篓的接口，没有移动任何内容。' };
    }
    if (!canDirectTrash()) {
      return {
        changes: [],
        status: resourceContract === undefined ? '正在确认删除接口' : '当前宿主不能按路径直接删除',
        reason: '正在运行的 NewMax 还没有确认按绝对路径移入废纸篓。没有移动任何内容，也不会交给后台删除。'
      };
    }
    const eligible = [];
    const blocked = [];
    const seen = new Set();
    items.forEach((item) => {
      const path = canonicalPath(item.path);
      const verdict = path ? pathVerdict(path) : 'name';
      if (verdict) {
        blocked.push({ id: item.id, verdict });
        return;
      }
      const key = path.normalize('NFKC').toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      eligible.push({
        id: item.id,
        path,
        name: fileBase(item),
        kind: item.isDir ? 'trashDirectory' : 'trash',
        hold: folderHold(item)
      });
    });
    const files = eligible.filter((row) => row.kind === 'trash');
    const safeDirs = eligible.filter((row) => row.kind === 'trashDirectory' && !row.hold);
    const held = eligible.filter((row) => row.hold);
    if (!files.length && !safeDirs.length) {
      return {
        changes: [],
        status: held.length ? '这些文件夹会挡住确认' : '没有可移动的内容',
        reason: held.length
          ? `这 ${held.length} 个文件夹会在确认卡片出现前被拒绝，所以刚才只会刷新、不会移动。请只勾选安装包或普通文件后再点。`
          : (blocked.length ? blockedReason(blocked) : '没有可移动的内容，没有删除任何内容。')
      };
    }
    const queued = files.concat(safeDirs);
    const batch = queued.slice(0, 10);
    const rest = queued.length - batch.length;
    const dirCount = batch.filter((row) => row.kind === 'trashDirectory').length;
    const fileCount = batch.length - dirCount;
    const parts = [];
    if (dirCount) parts.push(`${dirCount} 个文件夹`);
    if (fileCount) parts.push(`${fileCount} 个文件`);
    let status = `点按钮直接移动 ${parts.join('和')}`;
    if (held.length) status += `。${held.length} 个文件夹先不提交，避免整批不出确认卡片`;
    if (rest > 0) status += `，其余 ${rest} 项再点一次`;
    if (blocked.length) status += `，${blocked.length} 项不能提交`;
    return {
      changes: batch.map((row) => ({ kind: row.kind, path: row.path })),
      batch,
      rest,
      blocked,
      held,
      status,
      reason: ''
    };
  }

  // Event Bindings
  document.querySelectorAll('.md-seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  btnScanAll.addEventListener('click', () => runFullScan(true));

  btnToggleProtected.addEventListener('click', () => {
    const nextOpen = protectedDrawerEl.hidden;
    protectedDrawerEl.hidden = !nextOpen;
    btnToggleProtected.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  });

  catFilterBarEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    renderCleanupList();
  });

  searchInputEl.addEventListener('input', () => {
    searchQuery = searchInputEl.value;
    renderCleanupList();
  });

  btnSelectVisible.addEventListener('click', () => {
    getFilteredItems().forEach((item) => selectedIds.add(item.id));
    renderCleanupList();
  });

  btnClearSelect.addEventListener('click', () => {
    selectedIds.clear();
    trashNotice = '';
    renderCleanupList();
  });

  cleanupListEl.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-check-id]');
    if (!cb) return;
    const id = cb.dataset.checkId;
    trashNotice = '';
    if (cb.checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
    const row = cb.closest('.clean-item');
    if (row) row.classList.toggle('selected', cb.checked);
    updateCleanupFooter();
  });

  function movedLabel(items) {
    const folders = items.filter((item) => item.kind === 'trashDirectory').length;
    const files = items.filter((item) => item.kind !== 'trashDirectory').length;
    const parts = [];
    if (folders) parts.push(`${folders} 个文件夹`);
    if (files) parts.push(`${files} 个文件`);
    return parts.join('和') || '0 项';
  }

  btnRequestClean.addEventListener('click', async () => {
    if (isBusy) return;
    const api = resourcesApi();
    if (!api) {
      showFeedback(cleanupFeedbackEl, '当前页面没有按路径移入废纸篓的接口，没有移动任何内容。', 'err');
      return;
    }
    const plan = planTrash();
    if (plan.changes.length === 0) {
      showFeedback(cleanupFeedbackEl, plan.reason || '没有可移动的内容，没有删除任何内容。', 'warn');
      return;
    }
    isBusy = true;
    btnRequestClean.disabled = true;
    const label = btnRequestClean.querySelector('span');
    if (label) label.textContent = '等待 NewMax 确认';
    const heldNote = plan.held && plan.held.length ? ` ${plan.held.length} 个文件夹这次不提交。` : '';
    showFeedback(cleanupFeedbackEl, `请看 NewMax 主窗口右下角的确认卡片。允许后才会移动。${heldNote}`, 'warn');
    const started = Date.now();
    try {
      const result = await api.applyTargets({ changes: plan.changes });
      if (!result || result.ok !== true || !result.value || !Array.isArray(result.value.items)) {
        const code = result && result.code;
        const fastCancel = code === 'cancelled' && Date.now() - started < 1500;
        const blockedBatch = code === 'target_unsafe' || code === 'limit_exceeded';
        const text = fastCancel
          ? '确认卡片没有出现，所以没有移动任何内容。请看 NewMax 主窗口右下角；没有卡片就回到主窗口后再点一次。'
          : blockedBatch
            ? 'NewMax 在弹出确认前拒绝了这一批，所以一个文件都没移动。请去掉缓存文件夹，只勾选安装包后再点。'
            : resourceError(code);
        trashNotice = text;
        showFeedback(cleanupFeedbackEl, text, code === 'cancelled' && !fastCancel ? 'warn' : 'err');
        return;
      }
      const doneItems = [];
      const stopped = result.value.items.find((item) => item.status === 'failed' || item.status === 'changed');
      result.value.items.forEach((item, index) => {
        const row = plan.batch[index];
        if (item.status === 'done' && row && item.name === row.name) {
          doneItems.push(item);
          selectedIds.delete(row.id);
        }
      });
      const notRun = result.value.items.filter((item) => item.status === 'not_run').length;
      const restNote = plan.rest > 0 ? ` 还有 ${plan.rest} 项未提交，请再点一次。` : '';
      const blockedNote = plan.blocked && plan.blocked.length ? ` ${plan.blocked.length} 项因名称或目录范围未提交。` : '';
      const moved = movedLabel(doneItems);
      if (doneItems.length > 0 && !stopped && notRun === 0) {
        showFeedback(cleanupFeedbackEl, `NewMax 已将 ${moved} 移入废纸篓，可在系统废纸篓中还原。${restNote}${blockedNote}`, plan.rest || blockedNote ? 'warn' : 'ok');
      } else if (doneItems.length > 0) {
        showFeedback(cleanupFeedbackEl, `已移入废纸篓 ${moved}。其余未继续执行，仍在原处。${restNote}${blockedNote}`, 'warn');
      } else {
        showFeedback(cleanupFeedbackEl, `没有移动任何内容。NewMax 回执中没有成功项。${restNote}`, 'err');
      }
      const refreshed = await K.triggerCleanupScan();
      if (refreshed && refreshed.report) cleanupReport = refreshed.report;
    } finally {
      isBusy = false;
      if (label) label.textContent = '移至废纸篓';
      renderCleanupList();
    }
  });

  // Overview interactions
  panelIsoStageEl.addEventListener('click', (e) => {
    const scanEl = e.target.closest('[data-action="scan"]');
    if (scanEl) {
      runFullScan(true);
      return;
    }
    const part = e.target.closest('[data-layer]');
    if (part && part.dataset.layer) {
      selectLayer(part.dataset.layer);
    }
  });

  volumeListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-vol-id]');
    if (btn && btn.dataset.volId) {
      selectLayer(btn.dataset.volId);
    }
  });

  // Settings interactions
  setThresholdEl.addEventListener('input', () => {
    setThresholdValEl.textContent = `${setThresholdEl.value}%`;
  });

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const intervalVal = Number(setIntervalEl.value);
    if (intervalVal <= 0) {
      diskState.autoRunning = false;
    } else {
      diskState.autoRunning = true;
      diskState.autoIntervalSec = intervalVal;
    }
    diskState.thresholdPct = Math.min(95, Math.max(50, Number(setThresholdEl.value) || 80));
    diskState.keepLatestVersions = Math.max(1, Math.min(5, Number(setKeepVersionsEl.value) || 1));
    diskState.minSizeMB = Math.max(1, Math.min(500, Number(setMinSizeEl.value) || 1));
    diskState.includeAppCaches = setIncludeAppCachesEl ? setIncludeAppCachesEl.checked : true;
    diskState.includeDownloadLargeFiles = setIncludeDownloadLargeEl ? setIncludeDownloadLargeEl.checked : true;

    const lines = setScanRootsEl.value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    diskState.scanRoots = K.normalizeScanRoots(lines);

    btnSaveSettings.disabled = true;
    btnSaveSettings.textContent = '保存中...';
    try {
      await K.savePrefs(diskState);
      setupPollTimer();
      renderHeader();
      showFeedback(settingsFeedbackEl, '设置已保存并同步至信息面板，正在按新规则重新扫描...', 'ok');
      const clnRes = await K.triggerCleanupScan();
      if (clnRes.report) {
        cleanupReport = clnRes.report;
        renderCleanupList();
      }
      showFeedback(
        settingsFeedbackEl,
        `设置已生效：采集周期 ${diskState.autoRunning ? diskState.autoIntervalSec + 's' : '暂停'} · 预警 ${diskState.thresholdPct}% · 保留最新 ${diskState.keepLatestVersions} 版。`,
        'ok'
      );
    } finally {
      btnSaveSettings.disabled = false;
      btnSaveSettings.textContent = '保存设置并重新扫描';
    }
  });

  btnResetSettings.addEventListener('click', async () => {
    diskState.autoRunning = true;
    diskState.autoIntervalSec = 5;
    diskState.thresholdPct = 80;
    diskState.keepLatestVersions = 1;
    diskState.minSizeMB = 1;
    diskState.includeAppCaches = true;
    diskState.includeDownloadLargeFiles = true;
    diskState.largeFileMB = 50;
    diskState.scanRoots = K.DEFAULT_SCAN_ROOTS.slice();
    syncSettingsForm();
    await K.savePrefs(diskState);
    setupPollTimer();
    renderHeader();
    showFeedback(settingsFeedbackEl, '已恢复默认设置（5秒采集、80% 预警、保留最新 1 个版本）。', 'ok');
    const clnRes = await K.triggerCleanupScan();
    if (clnRes.report) {
      cleanupReport = clnRes.report;
      renderCleanupList();
    }
  });

  btnStopService.addEventListener('click', async () => {
    btnStopService.disabled = true;
    const stopped = await K.stopCollectorService();
    if (stopped) {
      serviceStatusTextEl.textContent = '已停止';
      showFeedback(settingsFeedbackEl, '后台采集服务已安全停止（下次打开面板时自动重启）。', 'warn');
    } else {
      await refreshServiceStatus();
      showFeedback(settingsFeedbackEl, '服务当前未运行或已停止。', 'warn');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !isBusy) {
      selectedIds.clear();
      renderCleanupList();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshFromDiskOnly(false);
    }
  });

  async function init() {
    const [latestDisk, latestCleanup] = await Promise.all([
      K.loadState(),
      K.loadCleanupReport(),
      ensureResourceContract()
    ]);
    diskState = latestDisk;
    lastDiskFp = K.getStateFingerprint(diskState) + '|' + (diskState.canWriteTrash === false ? 'ro' : 'rw');
    cleanupReport = latestCleanup;
    renderHeader();
    renderCleanupList();
    syncSettingsForm();
    setupPollTimer();
    refreshServiceStatus();
    K.updateBadge(diskState);
    if (!cleanupReport) {
      await runFullScan(false);
    }
  }

  init();
})();
