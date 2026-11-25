# Build Plan

## Visible Build Trace

| Phase | Status | Step | Evidence |
|------|--------|------|----------|
| requirements | completed | 明确 Surfaces-only（仅侧边栏 + 信息面板，移除独立窗口）与安全清理定位（保护项目依赖缓存） | `REQUIREMENTS.md` |
| plan | completed | 更新 `DESIGN_SYSTEM.md` 侧边栏三分区（可清理/磁盘概览/设置）及 240px 窄宽适配方案 | `DESIGN_SYSTEM.md`, `BUILD_PLAN.md` |
| generate | completed | 实现托管后端 `backend/disk_service.py`、共享核 `src/iso-disk.js`、侧边栏 `src/panel.html/css/js` 与信息面板 `src/summary.html` | `newmax.app.json`, `backend/`, `src/` |
| run | in_progress | 调用 `preview_app` 校验契约并拉起新版 `disk-collector` 服务 | `preview_app` |
| validate | pending | 使用 `inspect_app_ui` 与 `evaluate_app` 校验信息面板与侧边栏（420px 与 240px 窄宽）及安全清理闭环 | `ACCEPTANCE.md` |
| snapshot | pending | 完成验收并调用 `complete_app` | `ACCEPTANCE.md` |

## App Structure

```txt
app-d417779e-c5dd-4967-9d9c-ca66382be274/
  newmax.app.json
  NEWMAX_APP.md
  REQUIREMENTS.md
  BUILD_PLAN.md
  ACCEPTANCE.md
  DESIGN_SYSTEM.md
  .venv/
    bin/python3
  backend/
    disk_service.py
  src/
    iso-disk.js
    panel.html
    panel.css
    panel.js
    summary.html
```

## Current Implementation Scope

- `newmax.app.json`：删除 `entry.frontend`，声明 `surfaces.launchers`（`sidebar/below-nav` 打开 `board`）、`surfaces.panels`（`board@dock`）、`surfaces.inline`（`summary@info-card/section`）与 `services`（`disk-collector`）。
- `backend/disk_service.py`：宿主托管单实例服务，只采集磁盘并扫描可清理清单。`clean_items` 与 `/cleanup/clean` 拒绝执行，不移动文件。
- `src/panel.html` / `src/panel.css` / `src/panel.js`：侧边栏勾选后直接调用 `resources.applyTargets`。文件用 `trash`，文件夹用 `trashDirectory`，都传规范绝对路径。NewMax 主窗口列出完整路径，允许后才移入废纸篓；失败不回退选文件夹或后台清理。
- `src/summary.html`：保持 252×160px 透明底色 2.5D 线框信息面板卡片，顶部徽标联动展示可清理空间估算，底部实时显示采样时间、周期切换与手动 `SCAN`。
