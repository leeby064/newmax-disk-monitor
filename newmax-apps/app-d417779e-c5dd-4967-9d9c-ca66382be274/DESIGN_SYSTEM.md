# Design System

## Product-Specific Design Direction — Material Design 3 (MD3) Forest Sage

### 1. 目标用户与双表面协同
- **目标用户**：在 macOS 上高频开发/打包多项目的开发者，需要一个常驻聊天侧边、轻盈现代的磁盘监控与安全清理工具，一眼看清磁盘占用与可释放空间，一键将安全条目移入废纸篓，同时严格保护项目依赖缓存。
- **小窗口 + 双嵌入表面**：`src/boot.html` 是不超过一列的服务状态窗，不重复清理清单。日常清理仍在侧边栏。
- **嵌入表面**：
  1. **信息面板卡片（`summary@info-card/section`, 252×160px）**：透明底色 2.5D 等距线框速览卡，联动显示实时占比、采样时间、预警与可释放空间估算，支持点击盘片切换分卷、切换采集周期与手动 `SCAN`。
  2. **侧边栏面板（`board@dock`, 420px 默认宽 / 240px 极窄宽）**：全面采用 **Material Design 3（MD3）Tonal Surface 层次体系与胶囊交互语言**。

### 2. MD3 色彩与 Tonal Surface 层次（Forest Sage 种子色 `#2D6A4F`，与 `symbol:memory:forest` 呼应）
- **浅色模式（Light Scheme）**：
  - `surface` `#F7FAF7` → `surface-container-low` `#F1F5F1` → `surface-container` `#EBEFEB` → `surface-container-high` `#E5EAE6` → `surface-container-highest` `#DFE5E0`
  - `primary` `#2D6A4F` / `primary-container` `#B7EBD0`（安全保护、主按钮、正常进度条）
  - `secondary-container` `#D0E8D9`（选中分段标签、激活筛选胶囊、已勾选列表项高亮底色）
  - `tertiary` `#8F4E00` / `tertiary-container` `#FFDCC2`（高占用预警、历史版本包标签、权限警告）
  - `error` `#BA1A1A` / `error-container` `#FFDAD6`（移入废纸篓操作、下载大文件提醒、失败错误横幅）
- **深色模式（Dark Scheme）**：
  - `surface` `#111412` → `surface-container-low` `#191D1A` → `surface-container` `#1D211E` → `surface-container-high` `#272B28` → `surface-container-highest` `#323633`
  - `primary` `#8BD6B0` / `primary-container` `#0E5138`
  - `secondary-container` `#364B40`
  - `tertiary` `#FFB77C` / `tertiary-container` `#6D3A00`
  - `error` `#FFB4AB` / `error-container` `#93000A`

### 3. MD3 组件与交互规范
- **Top App Bar**：等宽大字占用率 + 胶囊状态徽标 + Tonal 扫描按钮 + 圆角线性进度条（Linear Progress Indicator）+ 3 段式 Segmented Button（`可清理` / `磁盘概览` / `设置`）。
- **Tonal Summary Card + Protected Drawer**：填充型摘要卡展示「可安全释放空间」与可展开的绿盾「已保护依赖缓存」胶囊。
- **Filter Chips + Pill Search Bar**：8px 圆角筛选胶囊（选中态自动切为 `secondary-container` 无描边）+ 全圆角搜索栏与文本操作按钮（`全选` / `取消`）。
- **MD3 List Surface**：摒弃厚重孤立边框卡片，采用统一的 `surface-container-low` 容器配 1px `outline-variant` 细分割线，勾选行以 `secondary-container` 柔和着色，显著降低长列表视觉噪点。
- **MD3 Switch & Slider**：「设置」页采用 MD3 轨道开关控制常规扫描范围、标准滑块调节预警阈值。
- **底部操作条**：勾选后只显示「移至废纸篓」。点击直接把绝对路径交给 NewMax，主窗口列出完整路径，允许后才移动；不再先弹出选文件夹，应用内也不再做第二层确认。240px 下按钮换行。结果按成功、部分完成和未移动区分，并写明内容是否仍在原处。失败不回退后台删除。
- **窄宽适配（240px–420px）**：`<= 300px` 时自动收缩内边距与胶囊留白，长文件名支持 `word-break: break-all`，路径单行省略保留 `title`，全程零横向溢出。
