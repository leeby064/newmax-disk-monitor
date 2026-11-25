(function () {
  'use strict';

  const K = window.IsoDiskKernel;
  const servicePill = document.getElementById('servicePill');
  const usedPct = document.getElementById('usedPct');
  const usageLine = document.getElementById('usageLine');
  const meterFill = document.getElementById('meterFill');
  const detailLine = document.getElementById('detailLine');

  function render(state, health) {
    const pct = Number(state && state.usedPct);
    if (Number.isFinite(pct)) {
      usedPct.textContent = pct.toFixed(1) + '%';
      usageLine.textContent =
        state.usedGB.toFixed(1) +
        ' / ' +
        state.totalGB.toFixed(1) +
        ' GB · 余 ' +
        state.freeGB.toFixed(1) +
        ' GB';
      meterFill.style.width = Math.min(100, Math.max(2, pct)) + '%';
      meterFill.classList.toggle('warn', pct >= Number(state.thresholdPct || 80));
    }

    if (health && health.running) {
      servicePill.textContent = health.pid ? '运行中 · ' + health.pid : '运行中';
      servicePill.className = 'pill ok';
    } else {
      servicePill.textContent = '未运行';
      servicePill.className = 'pill warn';
    }

    if (!(health && health.running)) {
      detailLine.textContent = '采集服务未运行。若弹出「允许运行本机后台」，请点允许。允许后即可回到侧边栏查看清单。';
    } else {
      const when = state && state.lastUpdated ? String(state.lastUpdated).slice(11, 19) : '--';
      detailLine.textContent = '最近采集 ' + when + ' · 扫描 #' + (state.scanCount || 1) + '。可以关掉本窗口，服务会继续运行。';
    }
  }

  async function tick() {
    const [state, health] = await Promise.all([
      K.loadState(),
      K.checkServiceHealth()
    ]);
    render(state, health);
  }

  tick();
  setInterval(tick, 2000);
})();
