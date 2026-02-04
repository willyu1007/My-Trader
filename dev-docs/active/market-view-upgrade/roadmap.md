# 市场行情视图完善（布局/筛选/组视图/时间轴）- Roadmap

## Goal
把「市场行情」做成高频可用的“浏览与发现”工作台：**左侧快速扫描列表**、**右侧沉浸式详情/图表**、**支持集合（板块/主题）与单标的双模式**、**时间轴可调**，并与现有“标的库/自选/Targets/日线数据”形成闭环。

## Non-goals（本任务不做）
- 分钟级/实时行情、盘口/Level2
- 小走势图（sparkline）与复杂指标（MACD/RSI 等）
- 多市场（HK/US）的一次性覆盖（只保留扩展位）
- 将 Targets/自动拉取逻辑重做（本任务只调整入口与交互）
- Token 本地安全存储、ingest_runs（这些在 `real-data-auto-fetch` 任务内推进）

## 已对齐的 UX 决策
1. **仅针对「市场行情」视图调整**（其他模块不改布局范式）。
2. 左侧列表显示 **最新价格 + 涨跌/涨跌幅**，不做 sparkline。
3. **Targets 放到弹层（Modal/Drawer）**，不占用主布局空间。
4. **进入 Market 后全局导航自动收起为 icon-only**，离开 Market 后**恢复进入前状态**。
5. **时间轴可调**：时间范围 pills 常驻或“悬停时浮出”（偏图片风格）。

## Repo 现状（与本任务相关）
- 前端：`Dashboard` 已有「市场行情」初版（标的库同步/搜索/详情、用户标签、自选列表、Targets 配置与预览）。
- 后端：已有 instrument catalog（`instrument_profiles`）、watchlist、Targets 解析；但：
  - 缺少“批量报价/涨跌”查询 IPC（用于左侧列表、右侧 header）。
  - 缺少“日线区间查询”IPC（用于图表/时间范围切换）。
  - 缺少“集合/板块/主题”在 UI 的信息架构（仅有 tags 机制与 symbol-by-tag 查询能力）。

## 关键痛点（你提出的补充）
1. 单标的详情布局适合看股票，但 **板块/主题（多标的集合）不方便**。
2. 目前“只有搜索，没有筛选”，需要 **通盘规划浏览/筛选逻辑**，避免未来返工。
3. 时间轴需要更强交互：范围切换、悬停显示控件、后续可扩展自定义区间。
4. 进入 Market 自动折叠全局导航（提高可视面积、贴近图中体验）。

## 信息架构（拟定方案，核心对齐点）
> 你的建议倾向于“以 Tag 作为统一聚类体系”。本任务采用：**Watchlist/板块/主题/用户标签 = Tag**（Holdings 属于“虚拟动态集合”，不强行落 Tag 表），并在 UI 上围绕 Tag 构建集合视图。

### 左侧：Explorer Sidebar（固定宽度，可滚动）
- 顶部：搜索框（聚焦即输入），右侧提供“筛选（漏斗）”按钮（弹层）。
- 下方：**Scope 切换（集合来源）**，用于解决“多标的集合”问题：
  - **Tags（默认）**：展示“可用的 Tag 集合”（可按前缀分组/折叠）
    - Watchlist groups 作为 tag（例：`watchlist:核心`）
    - Provider tags（例：`industry:白酒`、`board:主板`、`fund_type:股票型`）
    - User tags（用户手动添加）
  - **Holdings（虚拟集合）**：从 ledger 推导当前持仓（可按 portfolio 切）
  - **Search（搜索结果）**：按代码/名称检索后的结果（可叠加筛选）
- 列表项分两类：
  - **Collection 行（tag 行）**：`tagLabel / 成分数 / 最新整体涨跌`（见下方“Tag 聚合项”）
  - **Instrument 行（个股/ETF）**：`symbol / name / 最新价 / 涨跌`

### 右侧：Detail Workspace（随选择变化）
- **Instrument 详情模式**（选中单个 symbol）：
  - 顶部 header：大号 symbol + name，副标题 market·currency，右侧显示最新价/涨跌。
  - 图表区：时间范围 pills（悬停浮出）+ 价格曲线/日K（后续接入）。
  - 信息区：元数据、tags、公司行为提示（先占位）。
- **Collection 详情模式**（选中集合，如“白酒板块”）：
  - 顶部 header：集合名称（tag/group），副标题包含规则（例如 `industry:白酒`）。
  - 主区：成分股列表（可排序：涨跌幅/成交量/市值占位），点击任一成分跳转到该标的详情模式。
  - **集合概览（v1 最小）**：展示“Tag 聚合项”的整体走势/涨跌（不等价于真实指数，仅用于快速感知）

### Targets 弹层（右上角按钮进入）
- 入口固定在 Market 顶部工具条：`Targets / 自动拉取范围`
- 弹层内容：开关（holdings/watchlist/registry）、显式 symbol、tag filters、预览列表（分页/截断）

## Tag 聚合项（你的新提议：把 tag 当成“特殊标的”）
目标：在每个 tag 下增加一个“整体变化”的特殊行/详情，用于板块/主题快速浏览。

### 推荐落地方式（v1）
- **不把 tag 真的落成 instrument**（不改 `AssetClass/MarketDataSource`），而是在 UI/服务层做 **派生集合序列（derived series）**：
  - 列表层：tag 的“整体涨跌”= 成分股 **市值加权** 的涨跌幅（基于 latest 与 prev close）
  - 详情层：tag 的“整体走势”= 成分股 close **归一化（base=100）后市值加权** 的时间序列
    - 建议口径：使用上一交易日市值作为权重（`w_i(d) = mv_i(d-1) / sum(mv(d-1))`），避免前视
- 依赖：需要“日线市值数据”（例如 Tushare `daily_basic` 的 `circ_mv/total_mv`），并要定义缺失市值/缺失价格的处理策略。
- 优点：实现快、不引入 instrument/schema 级联变更；缺点：每次渲染都要聚合计算（可做缓存/按需加载）。

### 后续增强（v2+，可选）
- 将 tag 抽象成“可持久化的集合标的”（`collection`），落表保存：
  - 集合定义（tag/规则/权重方式）
  - 派生出来的日线序列（以 `derived` source 标注或独立表）
  - 元数据（成分数、权重方式、最后计算时间）
- 依赖：需要交易日历、更清晰的缺口处理、以及 membership 变更的可追溯策略。

## Milestones（按依赖与价值排序）
### Milestone 1：布局重构到“图中双栏” + 自动折叠导航
- Market 内部拆成：左侧 Explorer + 右侧 Detail
- 进入 Market：全局导航自动折叠到 icon-only；退出恢复策略明确
- Targets 从主页面迁移到弹层（入口按钮）

### Milestone 2：左侧列表与右侧 header 的“报价/涨跌”可用
- 新增 IPC：批量取 latest close + prev close（用于涨跌/涨跌幅）
- 列表显示红/绿涨跌；支持排序（默认按 symbol，可切换按涨跌）

### Milestone 3：集合（板块/主题）体验闭环
- 左侧新增 Tags/Collections（基于 tags/group）并支持基础分组/折叠
- 右侧提供集合详情：成分股表 + 点击跳转单标的
- 增加 Tag 聚合项（整体涨跌 + 整体走势，v1 先做派生计算，口径=市值加权）
- 最小筛选：assetClass/kind（stock/ETF）与 market（CN）等

### Milestone 4：时间轴交互（悬停浮出范围 pills + 区间加载）
- 新增 IPC：日线区间查询（`symbol + start/end`）用于图表与区间切换
- UI：范围 pills（1W/1M/3M/6M/YTD/1Y/2Y/5Y/10Y），hover 时浮出；支持键盘可达
- v1 图表：折线图（先），日K（后续可切换）

## Open questions（需要你确认）
1. ✅ **Tag 体系的命名约定**：统一采用 `namespace:value`。（watchlist 用 `watchlist:<group>`，用户自定义建议 `user:<name>`）
2. **市值加权口径细节**：
   - ✅ 使用 `circ_mv`（流通市值）作为权重。
   - ✅ 个别成分缺价格：统一剔除，并重归一化权重（并在 UI 显示覆盖率与缺失名单）。
   - ✅ 缺市值（`circ_mv` 缺失）：同样“剔除并重归一化权重”。
3. **筛选模型**：先做最小 facet（assetClass/kind/tag）还是一步做到“类似 Screener”的多维筛选？
4. **涨跌颜色习惯**：A 股红涨绿跌 vs 美股绿涨红跌；v1 先固定哪一种？（建议：跟随 `market=CN`）

## Verification（验收建议）
- `pnpm typecheck` / `pnpm build`
- 手工用例：
  - 进入 Market 自动折叠导航；退出恢复符合预期
  - 左侧列表：能稳定展示价格/涨跌；无数据时降级显示 `--`
  - 单标的详情：时间范围切换可用（即使先是假数据/占位，也要保证交互与状态正确）
  - 集合详情：成分股列表可加载/排序；点击跳转到单标的详情
  - Targets 弹层：配置可保存、预览可刷新，不阻塞主视图
