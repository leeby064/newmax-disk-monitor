# Acceptance Checklist

## 2026-11-22 支持普通点开头名称（如 `.next`）

- 正在运行的主进程 `resources.describe({ extended: true })` 返回 `resource-operations-v3`，`oneShotChanges` 同时包含 `trash` 与 `trashDirectory`。
- 零副作用路径探测确认：普通点开头路径（`xmonitor_new/.newmax-dot-probe-nonexistent-99182`）通过宿主名称策略并返回 `target_missing`，受保护路径（`xmonitor_new/.git`）仍被宿主拦截并返回 `target_unsafe`。
- 采集服务（PID 99109）与侧栏面板已对齐宿主 `ResourceFilePolicy`：可清理列表现包含 58 项、共 11.39 GB，其中含 `xmonitor_new/.next`（540.4 MB）、`gongzhonghao/.next`（129.1 MB）、`newmax-console/.next`（108.2 MB）及含 `.gitkeep` 的 `jinglvnengyuan/dist`；超过 4000 项或含 `node_modules`/符号链接的 `.next` 目录（如 `newmax-web/.next`）及受保护隐藏项（`.git`、`.env*`、`.ssh` 等）仍自动排除，`leakedCount = 0`。
- 勾选 `xmonitor_new/.next` 底部显示「已选 1 项 · 约 540.4 MB · 点按钮直接移动 1 个文件夹」；全选 58 项底部显示「点按钮直接移动 10 个文件，其余 48 项再点一次」，无阻拦项。未对用户真实文件执行删除。

## 2026-11-21 混合勾选不再整批拒绝

- `Caches/Dia` 超过宿主 4000 项检查上限，`Caches/company.thebrowser.dia` 内有 `Updater.app`。它们和安装包放在同一批时，确认卡片出现前整批被拒绝，列表只重绘，文件不移动。
- 侧栏现在把这类文件夹留在批外。勾选 ISO 与 `Caches/Dia` 后，底部为「点按钮直接移动 1 个文件。1 个文件夹先不提交，避免整批不出确认卡片」。没有替用户确认真实移动。

## 2026-11-21 按路径直接删除

- 正在运行的主进程 `resources.describe({ extended: true })` 返回 `resource-operations-v3`，`oneShotChanges` 含 `trash` 与 `trashDirectory`。
- 侧栏勾选 `Downloads/utm-backup/` 后，底部状态为「点按钮直接移动 1 个文件夹」，条目标为「确认后整夹移入废纸篓」。页面不再出现选文件夹文案。`.next` 标为「名称不能直接提交」，`Application Support` 缓存标为「不在允许的目录范围」。
- 自动化点击「移至废纸篓」后宿主返回取消。`~/Downloads/utm-backup` 与 Windows 11 ISO 仍在原处。真实移动仍需用户在 NewMax 主窗口确认卡片上允许。失败不回退后台删除。

## 2026-11-20 整夹移动接线

- 运行中的侧栏调用 `resources.describe()` 返回 `{ok:true, value:{version:'resource-operations-v2', changes:[...,'trashDirectory']}}`。
- 勾选 `Downloads/utm-backup/` 后，底部状态为「点按钮，选择「Downloads」」，不再提示不能整夹移动。`newmax-web/.next` 仍标为隐藏名称，不会提交。
- 没有执行真实移入废纸篓：系统选文件夹和 NewMax 确认都需要用户点击，自动化点击不能代替。没有移动任何用户文件，也没有回退到后台删除。

## Summary

- **App ID**: `app-d417779e-c5dd-4967-9d9c-ca66382be274`
- **App Name**: 磁盘监控（磁盘监控与清理）
- **App Form Scope**: 仅嵌入式表面（Surfaces-only，`entry: {}`，已移除独立窗口 `entry.frontend`）
  - **Sidebar Launcher**: `main-launcher` (`sidebar/below-nav`) → 打开 `board@dock`
  - **Sidebar Panel**: `board@dock` (`src/panel.html`, 默认 420×720px，兼容最小 240px 宽度)
  - **Info Card Inline**: `summary@info-card/section` (`src/summary.html`, 252×160px 透明底色)
- **Local Service**: `manifest.services` → `disk-collector` (`.venv/bin/python3 backend/disk_service.py`)，通过 `live-metrics.json`、`cleanup-report.json`、`scan-trigger.json`、`user-prefs.json` 与隔离表面实时通信。

## Visual & Alignment Review

1. **信息面板 (`summary@info-card/section`, 252×160px)**:
   - `html`、`body` 与 `#app` 的计算背景均为 `rgba(0, 0, 0, 0)`，`padding/margin` 为 `0`，精确适配 `252×160px` 无溢出裁切。
   - 顶部状态徽标实时显示预警与可安全释放空间（`≥80% · 清50.8G`），左侧渲染 2.5D 等距线框，右侧实时显示本机 APFS 占用（`80.0%`，`795.5/994.6G`），底部显示实时采样时间、`5s` 周期按钮与 `SCAN` 手动扫描按钮。
2. **侧边栏面板 (`board@dock`, 420px 默认宽与 240px 极窄宽)**:
   - 顶部紧凑状态栏一眼展示总占用率（`80.0%`）、已用/剩余容量、采样序号与「扫描」按钮，下方三分区（`可清理` / `磁盘概览` / `设置`）切换清晰。
   - 「可清理」首屏直接展示可释放总空间（实测 `50.81 GB` / `143` 项）与绿色「已保护依赖缓存 `2.36 GB`」可展开抽屉，6 大分类筛选胶囊（应用缓存 79 / 打包临时 15 / 历史版本 23 / 安装包与镜像 5 / 下载大文件 6 / 日志 15）、搜索框与列表在 `420px` 与 `240px` 宽度下均无横向溢出（`scrollWidth <= innerWidth + 1`）。
   - 「磁盘概览」展示 `iso-figure` 2.5D 线框模型与 APFS 分卷明细；「设置」展示采集周期、预警阈值、历史版本保留数、最小体积过滤、常规清理范围开关（应用缓存 / 下载大文件）、扫描根目录与后台采集服务状态/停止按钮。

## Criteria Verification

| # | Criterion | Status | Observed Evidence |
|---|-----------|--------|-------------------|
| 1 | 应用清单不包含 entry.frontend（仅保留侧边栏面板与信息面板），信息面板视图（summary）在 252×160px 容器中 html、body 与 #app 均为透明背景（transparent）且 padding/margin 为 0，无横向或纵向裁切溢出。 | PASSED | `preview_app` 确认 `hasWindow: false`、`previewTargets` 仅为 `board@dock` 与 `summary@info-card/section`；`evaluate_app(view="summary", width=252)` 实测 `html/body/#app` 背景均为 `rgba(0, 0, 0, 0)`，尺寸 `252×160`，`scrollWidth <= 252` 且 `scrollHeight <= 160`。 |
| 2 | 2.5D 磁盘线框采用 iso-figure 矩阵投影内核渲染多层立面（含 matrix 变换与 non-scaling-stroke 线框），信息面板展示实时容量与可清理估算，点击盘片/分卷按钮与 SCAN 能实时更新读数。 | PASSED | `summary` 含 `matrix(` 投影与 `non-scaling-stroke`；顶部状态徽标实时显示可释放空间估算（`≥80% · 清50.8G`）；点击 `SCAN` 后扫描序号立即递增（`#29492 -> #29494`，读数 `#29494 22:07:01 · 80.0%`）；点击 `DAT` 切换为「数据」。 |
| 3 | 侧边栏面板（board@dock，涵盖 240px 窄宽至 420px 默认宽）展示磁盘占用、分类可清理清单（应用缓存、打包临时产物、历史版本包、安装包/镜像、下载大文件、日志）及受保护依赖缓存声明，支持筛选、勾选、内联确认安全清理与重新扫描，且不列出任何项目依赖缓存目录。 | PASSED | `evaluate_app(view="board", width=420)` 与 `inspect_app_ui(width=240)` 实测均无横向溢出；扫描出 143 项共 `50.81 GB`（应用缓存 79 项 `8.22 GB`、打包临时 15 项 `6.89 GB`、历史版本 23 项 `2.91 GB`、安装包/镜像 5 项 `10.39 GB`、下载大文件 6 项 `22.09 GB`、日志 15 项 `0.32 GB`）；受保护依赖缓存校验 `leaked: []`，抽屉列出 npm/pnpm/Electron/electron-builder/node-gyp/uv/Go 等 7 项 `2.36 GB` 保护缓存。 |
| 4 | 侧边栏「设置」分区支持调整告警阈值、自动采集周期、历史版本保留数及扫描根目录，修改后通过 window.newmaxApp.data 与 user-prefs.json 持久化保存并在重载后保持一致。 | PASSED | 在侧边栏「设置」中关闭「下载大文件」并保存后，`window.newmaxApp.data` 与 `cleanup-report.json` 立即生效（`largeHidden: true`，总额自动更新为 `28.7 GB`）；点击「恢复默认」还原全部默认开关与配置并持久化。 |


## Agent verification (2026-11-19T14:02:20.463Z)

Source revision: 7165148d1b7e2deb0d5891f10fd0410e44c79815d0f57b94c370121ff7c3130b

Visual review: 已审阅侧边栏面板（board@dock，420×720px 与 240×720px 极窄宽）和信息面板（summary@info-card/section，252×160px）的真实截图与 DOM：应用已切换为纯嵌入形态（无独立窗口），侧边栏首屏直接呈现顶部实时磁盘占比（80.0% / 795.5 / 994.6 GB）与「可清理（56 项 / 11.90 GB）」「已保护依赖缓存 2.29 GB」「磁盘概览」「设置」三分区，在 240px 极窄宽度下卡片、筛选胶囊、搜索框与列表全部自然换行无横向溢出；信息面板保持透明底色与清晰 2.5D 线框，顶部徽标实时联动展示可清理空间估算（≥80% · 清11.9G）。

- [x] 应用清单不包含 entry.frontend（仅保留侧边栏面板与信息面板），信息面板视图（summary）在 252×160px 容器中 html、body 与 #app 均为透明背景（transparent）且 padding/margin 为 0，无横向或纵向裁切溢出。
  Evidence: preview_app 返回 hasWindow: false 且 previewTargets 仅为 board@dock 与 summary@info-card/section；evaluate_app(view="summary", width=252) 实测 html/body/#app 背景均为 rgba(0, 0, 0, 0)，padding/margin 为 0，尺寸精确 252×160px，无任何横向或纵向溢出。
- [x] 2.5D 磁盘线框采用 iso-figure 矩阵投影内核渲染多层立面（含 matrix 变换与 non-scaling-stroke 线框），信息面板展示实时容量与可清理估算，点击盘片/分卷按钮与 SCAN 能实时更新读数。
  Evidence: inspect_app_ui 与 evaluate_app(view="summary", width=252) 实测：SVG 含 iso-figure matrix() 投影与 non-scaling-stroke 线框；顶部徽标显示「≥80% · 清11.9G」；点击 SCAN 后触发后台实时 df -k 扫描并立即更新序号与时间戳（#29433 -> #29434，#29434 22:02:05 · 80.0%）；点击 DAT 按钮实时切换为「数据」。
- [x] 侧边栏面板（board@dock，涵盖 240px 窄宽至 420px 默认宽）展示磁盘占用、分类可清理清单（打包临时产物、历史版本包、安装包、日志）及受保护依赖缓存声明，支持筛选、勾选、内联确认安全清理与重新扫描，且不列出任何项目依赖缓存目录。
  Evidence: inspect_app_ui(view="board", width=420/240) 与 evaluate_app(view="board", width=420/240) 实测：420px 与 240px 均无横向溢出；扫描发现 56 项共 11.90 GB（打包临时 15 项、历史版本 23 项、安装包 4 项、日志 14 项），自动保留最新 build11 仅列 build3-build10；leakedProtected 为 []，绿色抽屉明示 2.29 GB 受保护依赖缓存（npm/pnpm/Electron/electron-builder/uv/Go 等）；勾选条目点击「移至废纸篓」弹出内联二次确认条并可取消；磁盘概览分区正常渲染 2.5D 线框与分卷明细。
- [x] 侧边栏「设置」分区支持调整告警阈值、自动采集周期、历史版本保留数及扫描根目录，修改后通过 window.newmaxApp.data 与 user-prefs.json 持久化保存并在重载后保持一致。
  Evidence: evaluate_app(view="board", width=420) 实测在侧边栏「设置」中将阈值设为 85%、采集周期设为 15s（此前还验证过历史版本保留数改为 2 后 build10 自动移出可清理清单）并点击保存，window.newmaxApp.data.get("disk_wireframe_user_prefs_v1") 与 user-prefs.json 均准确持久化新配置，点击「恢复默认」还原为 80% / 5s / 保留 1 版。


## Agent verification (2026-11-19T14:08:18.186Z)

Source revision: efb3bd78199c520dc82799030b4370dea7bed4de8d5b9524351cf9f049c26101

Visual review: 已审阅侧边栏面板（board@dock，420×720px 与 240×720px 窄宽）及信息面板（summary@info-card/section，252×160px）的截图与真实 DOM：侧边栏已全面展示常规可清理项（应用缓存 79 项、下载大文件 6 项、安装包/镜像 5 项、日志 15 项）与打包相关项（打包临时 15 项、历史版本 23 项），总计 143 项 50.81 GB，同时以绿色抽屉明示 2.36 GB 受保护项目依赖缓存；240px 极窄宽度下筛选胶囊、标签和条目均清晰换行无横向溢出；信息面板透明底色无多余边框，顶部徽标实时联动展示「≥80% · 清50.8G」。

- [x] 应用清单不包含 entry.frontend（仅保留侧边栏面板与信息面板），信息面板视图（summary）在 252×160px 容器中 html、body 与 #app 均为透明背景（transparent）且 padding/margin 为 0，无横向或纵向裁切溢出。
  Evidence: preview_app 确认 hasWindow: false 且 previewTargets 仅为 board@dock 与 summary@info-card/section；evaluate_app 与 inspect_app_ui(view="summary", width=252) 实测 html/body/#app 均为透明背景、padding/margin 为 0、尺寸精确 252×160px 无溢出。
- [x] 2.5D 磁盘线框采用 iso-figure 矩阵投影内核渲染多层立面（含 matrix 变换与 non-scaling-stroke 线框），信息面板展示实时容量与可清理估算，点击盘片/分卷按钮与 SCAN 能实时更新读数。
  Evidence: summary 含 iso-figure matrix() 投影与 non-scaling-stroke 线框；顶部徽标实时联动展示「≥80% · 清50.8G」；实测点击 SCAN 按钮立即触发后台 df -k 采样并更新读数（#29505 -> #29506，显示 #29506 22:08:03 · 80.0%）。
- [x] 侧边栏面板（board@dock，涵盖 240px 窄宽至 420px 默认宽）展示磁盘占用、分类可清理清单（应用缓存、打包临时产物、历史版本包、安装包/镜像、下载大文件、日志）及受保护依赖缓存声明，支持筛选、勾选、内联确认安全清理与重新扫描，且不列出任何项目依赖缓存目录。
  Evidence: inspect_app_ui(view="board", width=420/240) 与 evaluate_app 实测：420px 与 240px 均无横向溢出；扫描发现 143 项共 50.81 GB（应用缓存 79 项 8.22 GB、打包临时 15 项 6.89 GB、历史版本 23 项 2.91 GB、安装包/镜像 5 项 10.39 GB、下载大文件 6 项 22.09 GB、日志 15 项 0.32 GB）；受保护依赖缓存零泄露（leaked: []），绿色抽屉明示 7 项 2.36 GB 受保护依赖缓存（含 npm/pnpm/Electron/electron-builder/node-gyp/uv/Go）。
- [x] 侧边栏「设置」分区支持调整告警阈值、自动采集周期、历史版本保留数及扫描根目录，修改后通过 window.newmaxApp.data 与 user-prefs.json 持久化保存并在重载后保持一致。
  Evidence: evaluate_app 实测在侧边栏「设置」中支持配置采集周期、预警阈值、历史版本保留数、最小体积、常规清理开关（应用缓存/下载大文件）与扫描根目录；关闭「下载大文件」并保存后立即持久化并重新扫描（largeHidden: true），点击「恢复默认」还原全部默认配置并同步持久化。


## Agent verification (2026-11-22T11:28:17.360Z)

Source revision: 8474e0edbfa15103af6c254a60259d888ca9f5bf655eaf13f361cb002c1c7074

Visual review: 已审阅独立启动窗口（1100×728px）、侧边栏面板（board@dock，420×720px 与 240×720px）以及信息面板（summary@info-card/section，252×160px）的真实截图与 DOM：独立窗口清晰展示采集服务运行中（PID 99109）与 80.2% 占用率；侧边栏首屏展示 58 项共 11.39 GB 可清理项（已纳入 xmonitor_new/.next、gongzhonghao/.next、newmax-console/.next 等符合宿主安全策略的点开头构建目录）及 3.56 GB 受保护依赖缓存，240px 窄宽下无横向溢出；信息面板透明底色无多余边框，2.5D 线框与顶部「≥80% · 清11.4G」徽标对齐清晰。

- [x] 应用同时提供用于启动采集服务的小窗口（entry.frontend 为 src/boot.html）以及侧边栏面板和信息面板；信息面板视图（summary）在 252×160px 容器中 html、body 与 #app 均为透明背景（transparent）且 padding/margin 为 0，无横向或纵向裁切溢出。
  Evidence: preview_app 确认 hasWindow: true、entry.frontend 为 src/boot.html，且表面包含 board@dock 与 summary@info-card/section；inspect_app_ui 审阅了独立窗口（1100×728px，显示运行中 · 99109 与 80.2%）与信息面板（252×160px）；evaluate_app(view="summary", width=252) 实测 html/body/#app 背景均为 rgba(0, 0, 0, 0)，noOverflow 为 true，无横向或纵向裁切溢出。
- [x] 2.5D 磁盘线框采用 iso-figure 矩阵投影内核渲染多层立面（含 matrix 变换与 non-scaling-stroke 线框），信息面板展示实时容量与可清理估算，点击盘片/分卷按钮与 SCAN 能实时更新读数。
  Evidence: inspect_app_ui 与 evaluate_app(view="summary", width=252) 实测：SVG 含 matrix( 投影变换与 non-scaling-stroke 线框；顶部徽标实时联动展示「≥80% · 清11.4G」，容量读数为 80.2%（797.5/994.6G 余197G）；点击 DAT 切换为「数据」，点击 SCAN 实时更新时间戳与读数。
- [x] 侧边栏面板（board@dock，涵盖 240px 窄宽至 420px 默认宽）展示磁盘占用、分类可清理清单及受保护依赖缓存声明，支持筛选、勾选和重新扫描；运行中宿主确认 resource-operations-v3 且 oneShotChanges 含 trash 与 trashDirectory 后，勾选内容按绝对路径交给 window.newmaxApp.resources.applyTargets，由 NewMax 确认完整路径后移入废纸篓，不再先选文件夹，失败不回退后台清理，且不列出任何项目依赖缓存目录。
  Evidence: running host resources.describe({ extended: true }) 返回 resource-operations-v3，oneShotChanges 含 trash 与 trashDirectory；零副作用探测确认普通点开头路径返回 target_missing（放行），受保护路径 .git 返回 target_unsafe（拦截）。inspect_app_ui(420px/240px) 与 evaluate_app 实测：420px 与 240px（scrollWidth=240）均无横向溢出；列表展示 58 项共 11.39 GB，包含 xmonitor_new/.next（540.4 MB）、gongzhonghao/.next（129.1 MB）、newmax-console/.next（108.2 MB）及含 .gitkeep 的 jinglvnengyuan/dist，leakedCount=0；勾选 xmonitor_new/.next 底部显示「点按钮直接移动 1 个文件夹」，全选 58 项显示「点按钮直接移动 10 个文件，其余 48 项再点一次」，无阻拦项。未替用户执行真实文件删除。
- [x] 侧边栏「设置」分区支持调整告警阈值、自动采集周期、历史版本保留数及扫描根目录，修改后通过 window.newmaxApp.data 与 user-prefs.json 持久化保存并在重载后保持一致。
  Evidence: evaluate_app(view="board") 实测切换至「设置」分区可正常读取持久化偏好（hasPrefs: true，thresholdVal: 80%），服务说明文案已更新为包含 .next 等普通点开头构建目录。
