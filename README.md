<!-- newmax-app:app-d417779e-c5dd-4967-9d9c-ca66382be274:start -->
# 磁盘监控

[built by newmax](https://newmax.ai)

实时监控本机 APFS 磁盘空间并列出可清理清单。日常清理在侧边栏，另有一个小窗口用于让宿主启动采集服务。严格保护项目打包依赖缓存。

## 功能 / Features

- REQ\-1 小窗口加嵌入表面：保留 entry\.frontend 指向紧凑服务窗口 src/boot\.html，仅用于让宿主启动采集服务；日常清理仍在 sidebar/below\-nav 打开的 dock 侧边栏和 info\-card/section 信息面板，信息面板保持透明底色与 252×160px 零边距对齐。
- REQ\-2 基于 iso\-figure 的 2\.5D 等距线框磁盘监控与实时采集：通过宿主托管本地服务 disk\-collector 定时按设置周期采集真实 APFS 磁盘空间，并在信息面板与侧边栏中支持点击 2\.5D 盘片切换分卷和手动触发扫描。
- REQ\-3 智能可清理清单与依赖缓存保护：后台扫描并列出可安全清理的打包临时目录（\.next/out/dist/build/release 解包目录）、历史版本打包产物（默认保留最新版本）、旧下载安装包与应用日志，严格排除并明示受保护的依赖与打包缓存（node\_modules、\.npm、pnpm、Yarn、Electron、electron\-builder、uv、pip、Go、Cargo、Gradle、CocoaPods、Homebrew）。
- REQ\-4 侧边栏一站式清理与设置持久化：后台只负责扫描。侧边栏勾选后，在运行中宿主确认 resource\-operations\-v3 且 oneShotChanges 含 trash 与 trashDirectory 时，直接把绝对路径交给 window\.newmaxApp\.resources\.applyTargets，由 NewMax 主窗口确认完整路径后移入废纸篓；失败不回退到选文件夹或后台清理。设置包含自动采集周期、告警阈值、历史版本保留份数、扫描目录列表和安全停止采集服务，并通过 window\.newmaxApp\.data 与 user\-prefs\.json 持久化。

## 源码 / Source

- [浏览应用源码 / Browse source](newmax-apps/app-d417779e-c5dd-4967-9d9c-ca66382be274/)
- [应用原始文档 / App documentation](newmax-apps/app-d417779e-c5dd-4967-9d9c-ca66382be274/README.md)
- 版本 / Version: 1\.0\.1
- NewMax runtime: ^1\.0\.0
- 权限 / Permissions: data\.kv, files\.appData, notifications, resources\.read, resources\.change
- [本次发布 / Release](https://github.com/leeby064/newmax-disk-monitor/releases/tag/app-e7a4fceb-382c-4db9-b016-88ac802b7212)

## 安装 / Install

1. 安装并打开 / Install and open [NewMax](https://newmax.ai).
2. 本地应用 → 激活应用。 / Local apps → Activate app.
3. 粘贴下方完整口令，等待下载校验。 / Paste the full code below and wait for verification.
4. 检查来源与权限后，点击「信任并安装」。 / Review the publisher and permissions, then choose Trust and install.

```text
NEWMAX-APP:1:leeby064/newmax-disk-monitor/app-e7a4fceb-382c-4db9-b016-88ac802b7212:d097217a2387b983ac76f54d58517f5503db78e419461e11b46ccde057921171
```

无需 GitHub 登录；安装后需手动打开应用。口令对应此版本，旧口令不会自动升级。
No GitHub sign-in is required. Open the app manually after installation. Each code installs a fixed snapshot.

## 使用说明 / Notes

这是依赖 NewMax 的应用源码，不是独立系统安装程序。个人数据、账号密钥与开发对话不随包分发；外部服务、连接器和依赖可能需要自行配置。
This app requires NewMax. Personal data, credentials and development chats are not included. External services, connectors and dependencies may need separate setup.

许可证请查看源码中的 LICENSE 或原始文档；此发布流程不会自动添加或修改许可。
See the source LICENSE or original documentation for licensing. Publishing does not assign or change a license.
<!-- newmax-app:app-d417779e-c5dd-4967-9d9c-ca66382be274:end -->

# newmax-disk-monitor
Public NewMax app shares
