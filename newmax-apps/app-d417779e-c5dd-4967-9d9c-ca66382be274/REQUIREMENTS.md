# Requirements

## Product Intent

打造一款轻量、可靠的「磁盘监控与安全清理」本地应用。日常操作在**侧边栏面板（`dock`）**和**信息面板（`info-card/section`）**；另有一个紧凑独立窗口，只为让宿主以系统用户权限启动采集服务。通过 2.5D 等距线框监控本机 APFS 磁盘，并列出可安全清理的常规缓存、安装包、下载大文件、日志，以及项目打包临时目录和历史版本包。严格保护项目打包依赖缓存。

## App Form Scope Boundary

- **已启用形态**：
  1. 紧凑独立窗口 `entry.frontend` = `src/boot.html`，只负责让宿主启动 `disk-collector`。关掉窗口不停止服务，不在这里做清理清单。
  2. `sidebar/below-nav` 启动器（`main-launcher`）→ 打开 `dock` 侧边栏面板（`board`，`src/panel.html`，默认宽度 `m` / 420px，兼容最小 240px）。日常清理和设置在这里。
  3. `info-card/section` 内联卡片（`summary`，`src/summary.html`，252×160px 透明底色）。
- **明确排除形态**：不提供 `workbench`/`main` 面板宿主，不把小窗口做成第二套完整清理界面。

## Requirement Checklist

- [x] **REQ-1 小窗口加嵌入表面**：`entry.frontend` 指向 `src/boot.html`，供宿主启动采集服务；侧边栏与信息面板保持原职责。信息面板 `html/body/#app` 透明且零外边距，适配 252×160px。
- [x] **REQ-2 实时 APFS 磁盘监控与 2.5D 线框图**：由宿主托管本地服务 `disk-collector`（`manifest.services` → `.venv/bin/python3 backend/disk_service.py`）按设置周期采集真实 `df -k` 容量，写入 `live-metrics.json`；信息面板与侧边栏「磁盘概览」均采用 `iso-figure` 矩阵投影渲染可点击 2.5D 盘片，支持手动点击 `SCAN` / 「扫描」即时触发真实采集。
- [x] **REQ-3 智能可清理清单（常规文件 + 打包产物）与依赖缓存硬保护**：全面扫描常规可清理文件（应用与浏览器缓存 `~/Library/Caches`、`~/Library/Application Support/*/Cache|Code Cache|GPUCache|CachedData|Crashpad`、第三方沙盒应用缓存、下载目录安装包/ISO 镜像与大文件/大文件夹、应用日志与崩溃日志）以及项目打包相关产物（`.next`/`.nuxt`/`out`/`build`/`dist`/`target`、`release` 解包目录、Xcode `DerivedData`、历史版本打包产物默认保留最新 N 版及 Xcode 归档）；服务端与前端双重硬保护项目依赖与打包缓存（`node_modules`、`~/.npm`、`~/Library/pnpm`、`Yarn`、`electron`、`electron-builder`、`node-gyp`、`~/.cache/uv`、`pip`、`Go mod`、`Cargo`、`Gradle`、`CocoaPods`、`Homebrew`、`ms-playwright`、`.venv`），界面明示已保护缓存且永不提供清理勾选。可清理列表只保留 NewMax 能按绝对路径直接移入废纸篓的条目：支持普通点开头目录与文件（如 `.next`、`.rscinfo`、`.gitkeep`），仍排除受保护条目（如 `.git`、`.env*`、`.ssh`、`.app`、依赖缓存）、资源库里除缓存和日志以外的目录、以及含符号链接或超过 4000 项的文件夹，避免全选后整批被拒绝。
- [x] **REQ-4 侧边栏一站式安全清理与设置持久化**：侧边栏提供「可清理 / 磁盘概览 / 设置」三分区；后台只扫描。勾选后直接把绝对路径交给 `window.newmaxApp.resources.applyTargets`。运行中宿主 `resources.describe({ extended: true })` 必须返回 `resource-operations-v3`，且 `oneShotChanges` 同时包含 `trash` 与 `trashDirectory`，才提交文件和文件夹；NewMax 在主窗口列出完整路径，允许后才移入废纸篓。不再先弹出选文件夹。失败不回退到后台清理，也不回退到旧的目录授权流程。设置分区支持采集周期、预警阈值、历史版本保留份数、最小体积过滤及扫描根目录，持久化至 `window.newmaxApp.data` 与 `user-prefs.json`。

## Local-First & Safety Boundary

- 移入废纸篓只走 `window.newmaxApp.resources.applyTargets`。采集服务继续扫描，不删除文件。必须先握手确认一次性接口同时支持 `trash` 和 `trashDirectory`，再按绝对路径提交；失败时必须明确提示没有移动内容，不得显示成功，也不得回退到选文件夹或后台清理。
- 宿主只在打开带 `entry.frontend` 的窗口时拉起 `manifest.services`。因此保留紧凑服务窗口；服务只负责采集和扫描。
- 服务端硬编码拒绝删除任何受保护依赖缓存目录、用户主目录顶层、系统目录或 NewMax 应用数据目录。
- 零外部网络请求、零远程字体或第三方脚本依赖。
