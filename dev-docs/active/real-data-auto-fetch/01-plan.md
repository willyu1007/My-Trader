# 01 Plan

> 原则：先把“能跑”变成“可用”（可配置/可观测/可解释），再做“正确性闭环”（ledger-first symbol 选择），最后补齐“体验闭环”（元数据/交易日历/日K与回补/未处理标识）。

## Milestones
### Milestone 1：可配置 + 可观测（把“跑起来”变成“可用”）
- Deliverables
  - Token 本地加密配置（`safeStorage`），env 覆盖优先；提供 token 测试接口与 UI 提示
  - Tushare 标的基础库（可查询，即使不拉行情也可用）：
    - 同步/刷新标的库
    - 代码/名称模糊搜索 + 详情查看（名称、分类、代码、上市/市场等）
    - 字段映射清单（记录 Tushare key -> 本地字段）
  - market-cache 增加 `ingest_runs`（或等价结构），记录每次拉取的结果并可在 UI 查询
  - UI 增加全局「数据状态」入口（覆盖率/新鲜度/缺失标的/上次拉取状态/一键刷新）
  - 全量数据池（Universe，近 3 年，DuckDB）：
    - Universe=CN A 股股票 + 交易所 ETF（不含退市/不含场外基金）
    - 新增 `analysis.duckdb`，全量落：`daily_prices` / `daily_basics` / `daily_moneyflows` / `trade_calendar` / `instrument_meta`
    - 支持一次性 bootstrap（可断点续跑/可暂停/可看进度）+ 每日增量维护
  - 拉取对象（Targets）配置 v1：
    - 可选来源：持仓(ledger-derived) / 自选列表(watchlist) / 全局标的注册表(auto_ingest=1)
    - 扩展类型：显式标的（某具体公司）/ 条件型目标（板块、某类型ETF：基于 tag/category）
    - 用户可开关“是否将持仓纳入自动拉取”，并可预览当前将拉取的 symbols
  - 分类策略（v1）：默认使用 Tushare 提供的行业/分类；同时允许用户添加自定义标签（tag）
- Acceptance
  - 未配置 token：UI 清晰提示如何配置；拉取按钮禁用或给出明确错误
  - 配置 token：手动刷新可成功，且 run 记录可见（成功/失败都记录）
  - 用户可在 UI 明确看到“全量跑批/目标池跑批”的开关、状态与 run 记录（不会悄悄后台跑且不可解释）

### Milestone 2：symbol 选择正确性（ledger-first 对齐）
- Deliverables
  - auto-ingest symbol 集合改为：基于 Targets 配置的合并结果（registry/watchlist/holdings 各自可开关）
  - ledger 变更触发 auto-ingest（debounce + 互斥），并确保新标的会注册进 `instruments`
- Acceptance
  - 只通过流水录入新增标的，不创建 position，也能在一个周期内补齐行情

### Milestone 3：元数据 + 交易日历 + 日K闭环（让质量指标更可靠、图表可用）
- Deliverables
  - 标的元数据同步：name/market/currency/asset_class（用于展示与默认值）
  - 交易日历：用于新鲜度判断与拉取截止日选择
  - 日K：范围查询 IPC + 按需回补 + 缺口提示 + 未复权/未处理提示
- Acceptance
  - 周末/节假日不误报“过期”；日K 区间切换稳定且可一键回补

### Milestone 4（可选）：公司行为/分红获取 + 未处理标识
- Deliverables
  - 拉取公司行为/分红事件并落 market-cache；UI 展示列表
  - 对会影响计算的事件提供 `handled/unhandled` 标识与“去处理”入口（预填流水字段）
- Acceptance
  - 用户可明确知道“哪里会影响收益/成本但尚未入账”，并能快速处理或忽略

## Phases（建议执行顺序）
### Phase 0 - 准备与对齐（半天内）
- 明确 DoD：
  - “可观测”= 每次拉取都有 run 记录
  - “可解释”= UI 给出缺口原因 + 修复入口
  - “安全”= token 不落库、不明文日志
- 定义新增 IPC 清单（命名/输入输出/错误码）

### Phase 1 - Token 与 ingest_runs（Milestone 1）
- 后端
  - Token 安全存储与读取（env > local）
  - `ingest_runs` 表结构 + 写入逻辑（手动/自动都写）
  - 提供 IPC 查询 runs、查询当前配置来源（env/local/none）
-  Targets 配置
  - 新增业务库 `watchlist`（账号隔离）+ IPC CRUD
  - 新增 Targets 配置持久化（规则集合，支持：holdings/watchlist/registry/explicit/tag）
  - 新增设置项：是否将 holdings 纳入自动拉取（默认开启）
  - 新增 IPC：预览当前将拉取的 symbols（数量/列表）
- 前端
  - 数据状态入口：展示 run 摘要、缺失标的、刷新按钮、token 配置入口/指引
  - Targets 设置页：管理 watchlist、registry auto_ingest、holdings 开关，并展示“将拉取的标的数”

### Phase 2 - ledger-first symbol（Milestone 2）
- 后端
  - 统一 ingestion mutex（避免并发写 DB）
  - ledger 变更触发：识别受影响 symbol，注册 `instruments`，触发 debounce 拉取
  - auto-ingest 的 symbol 来源切换为 ledger-derived（positions 仅兼容）

### Phase 3 - 元数据/日历/日K（Milestone 3）
- 后端
  - provider 接口（预留扩展，但 v1 仅实现 Tushare）：instrument meta、trade calendar
  - 分类/标签：默认 provider 分类（Tushare）+ user tags（用于 Targets 的板块/ETF类型选择）
  - 日K 读取：`symbol + date range` 查询 daily_prices
  - 日K 回补：区间缺口检测 -> 触发拉取 -> 记录 run
- 前端
  - 持仓/标的详情：日K 图表 + 区间切换 + 回补入口
  - 交易日历纳入 freshness 解释（提示“因非交易日不计入过期”）

### Phase 4 - 公司行为（Milestone 4，可选）
- 后端
  - corporate_actions 表 + 拉取写入 + 追溯字段（source/asOf/ingested_at）
  - handled/unhandled 判定逻辑（优先 external_id，其次近似匹配）
- 前端
  - 公司行为列表与标记；一键跳转到流水录入并预填

## Rollback strategy
- 任何新增逻辑必须可被关闭：
  - 关闭 auto-ingest（现有 env 开关保留；未来可补 UI 开关）
  - 清空 market-cache（纯缓存，可重建）
  - 清除本地 token（保留 env 模式）

## Open questions / TODO（记录本次疑问）
- Clarify: “全量数据拉取”的口径应拆分为两条链路
  - Universe（全市场近 3 年，DuckDB）：用于分析层与全量数据池，应默认每日维护（可加开关/频率）
  - Targets（目标池，SQLite）：用于组合估值/缺口回补的快速路径，需要范围配置避免无意义的大规模回补与限流
- UI：在「数据管理」明确提示 Targets vs Universe 的区别，避免“既然要全量，为何还要范围”的困惑
