# 自动获取真实数据 v1（本地优先）- Roadmap

## Goal
把“真实数据自动获取”做成可日常使用的闭环：**可配置（Token/开关）**、**可观测（状态/日志）**、**可追溯（as-of/source/ingested_at）**、**可控（手动刷新/回滚）**，并把缺失/过期数据的修复路径明确地呈现在 UI 中。

> 本 roadmap 以当前 repo 现状为基础（已存在 Tushare 日线拉取 + market-cache.sqlite + auto-ingest 定时器），补齐“自动化/可控/可解释”的关键能力，并为后续公司行为/汇率/交易日历留好扩展点。

## Non-goals
- 自动交易/券商直连/下单执行
- 云端同步、多设备共享、多用户协作
- 分钟级/实时行情（tick/level2）
- 在仓库内保存 Token/密钥；或在日志中打印明文 Token
- 一次性覆盖 HK/US（后续单独任务）
- 纳入退市标的（v1 明确不包含）

## Repo 现状盘点（关键事实）
- **market-cache.sqlite**：已有 `instruments`（含 `auto_ingest`）+ `daily_prices`（含 `source/ingested_at`）。
- **真实数据来源**：已有 Tushare 日线拉取（股票 `daily`、ETF `fund_daily`），但只拉行情字段，**未补齐标的元数据**（name/market/currency 等）。
- **自动拉取**：已有 `autoIngest` 定时器（启动/间隔/触发），symbol 来自 `instruments(auto_ingest=1)` ∪ `positions(quantity>0)`；缺 token 时仅 warn 一次并跳过。
- **可解释性**：`PortfolioSnapshot` 已计算 `dataQuality(coverage/freshness)`，UI 有 `DataQualityCard` 但“市场”Tab 仍是占位；导入/拉取入口目前在「Other / Data Import」里。
- **图表基础**：`daily_prices` 已包含 OHLCV（可直接作为“日 K”数据源）；目前缺的是“范围查询 + 按需补拉 + UI 图表展示 + 缺口提示”。
- **数据源方向（v1 约束）**：外部市场数据 provider 暂以 **Tushare 作为单一来源**，但必须保留可扩展的 provider 接口（未来可接入其他来源）；同时保留 `csv` 导入作为补充（仍应保留 `source` 标注）。
- **已知缺口**：
  - Token 目前只能通过环境变量 `MYTRADER_TUSHARE_TOKEN` 配置，缺少应用内配置/提示/健康检查。
  - auto-ingest 触发点主要绑定在 `positions`/持仓 CSV；**ledger 驱动的新增标的**不会注册到 `instruments` 也不会触发拉取，可能导致“有流水/持仓但无行情”。
  - 拉取过程无结构化 run 记录（只打 console），UI 无法展示“上次成功/失败、耗时、覆盖范围、错误原因”。
  - market-cache 目前无 schema_version/迁移策略（有 `market_meta` 但未用于版本化）。
  - 缺少“拉取对象”配置：目前拉取对象隐式来自 positions/registry，无法由用户显式配置“只拉哪些标的/哪些列表/哪些板块/哪些类型 ETF/哪些组合”。

## Open questions（需要在开始实现前确认）
1. **数据范围 v1（已确认）**：选择方案 B —— **日线价格 + 标的元数据 + 交易日历**。
   - 日线价格：按 `symbol + trade_date` 的 OHLCV 时间序列（用于估值/收益/风险）。
   - 元数据：标的相对稳定属性（name/market/currency/asset_class/...，用于展示、默认值、以及选择数据源/接口）。
   - 交易日历：用于新鲜度/截止日判断（避免周末/节假日误判），也可作为图表日期轴对齐依据。
2. **Token 存储策略（已确认）**：接受“本地加密存储（Electron `safeStorage`）+ env 覆盖优先”的方案（避免引入 `keytar` 等 native 依赖）。
3. **自动拉取触发条件（已确认）**：除“定时/手动刷新”外，在 `ledger` 发生影响持仓的变更时触发一次（带 debounce/互斥，避免频繁拉取）。
4. **公司行为/分红（已确认 v1 策略）**：仅“获取并展示”（落 market-cache），但必须提供“未处理”标识。
   - 解释：
     - “获取并展示”= 拉取并缓存事件，UI 可见/可追溯，但**不自动写入 `ledger_entries`**，因此默认不会影响持仓/现金/收益复算结果。
     - “未处理标识”= 对于会影响计算的事件（拆股/合股/分红等），如果尚未被用户（或系统）在 `ledger_entries` 中处理/对齐，则在 UI 明确标注“未处理”，并给出处理路径（例如跳转到流水录入、预填关键字段）。
   - 处理状态判定（建议）：
     - `unhandled`：存在公司行为/分红事件，但找不到对应的 ledger 记录（优先通过 `external_id` 关联；次选按 `symbol + date + kind` 近似匹配）。
     - `handled`：已存在对应 ledger（手工或系统），并且该 ledger 明确引用了事件（`external_id` 或等价关联信息）。

## Decisions（已确认）
### 1) 全量覆盖范围（Universe）
- 市场：CN
- 标的类型：A 股股票 + 交易所 ETF（不包含场外基金/普通基金；不包含退市）
- 贵金属：若 provider 能提供“可交易标的（交易所品种/对应 ETF）”则纳入；否则 v1 先跳过（不硬接不稳定口径）

### 2) 全量历史范围与数据池（近 3 年，日级）
- 覆盖对象：Universe 全量标的（不再仅限目标池）
- 时间范围：近 3 年（日级，trade_date 口径）
- 数据池：`daily_prices` + `daily_basics` + `daily_moneyflows` + instrument meta + trade calendar
  - 注：不同资产类型 provider 字段可能不齐（例如 ETF 的 `daily_basics`/`moneyflow`），允许以 `null/partial` 存储并在 UI/计算层降级解释

### 3) 存储选型：SQLite + DuckDB（新增分析仓，不替换业务库）
- SQLite：继续承载业务库（positions/ledger 等）与 Market UI 的在线查询/快读缓存（`market-cache.sqlite`）
- DuckDB：新增 `analysis.duckdb` 作为“全量数据池（近 3 年）”（回测/模型验证/机会发现优先读这里）
- 同步原则：
  - 全量历史优先落 DuckDB（可重建）
  - UI 需要的“目标池最新/近期区间”可同步落 market-cache（小而快）

### 4) 幂等与去重：一个标的一天一套数据
- 表级幂等：对每个 dataset（prices/basics/moneyflow），以 `(symbol, trade_date[, dataset])` 作为唯一粒度
- 同一天多次触发（定时/手动/按需回补）允许重复“尝试”，但必须 upsert 覆盖写；可追溯以 `ingested_at`/`ingest_runs` 为准

## 数据池 / 目标池对齐（本次新增需求）
目标：每天定时跑批，把“目标池”内的标的所需数据补齐到最新交易日，形成稳定的可用闭环（Market/组合估值/数据质量都依赖它）。

### 目标池（Target pool）
“要拉哪些标的”的集合，来源统一走 Targets 配置（可预览/可解释）：
- `holdings`：ledger 推导的当前持仓（可按组合开关/选择 portfolioIds）
- `watchlist`：自选列表（含分组）
- `registry(auto_ingest=1)`：标的注册表中用户勾选的自动拉取项
- `explicitSymbols`：用户手工输入的 symbol
- `tagFilters`：按 tag 过滤的标的集合（依赖标的元数据/标签体系）

### 数据池（Data pool）
“每个标的要补哪些数据”的集合（v1 聚焦日级）：
- `daily_prices`：OHLCV（日线图表/估值/收益/风险基础）
- `daily_basics`：最小需要 `circ_mv`（集合市值加权、信息版、数据质量解释）
- `daily_moneyflows`：moneyflow（日级势能，Market 视图可用）
- `instrument meta`：name/market/currency/assetClass 等（展示与 Targets 条件过滤）
- `trade_calendar`：交易日历（新鲜度与“最新交易日”判定，避免周末误判）

### “补齐”的定义（v1）
- 以“最近交易日”（由 `trade_calendar` 决定）作为 `asOfTradeDate`
- 对目标池内每个 symbol：确保上述数据在 `asOfTradeDate` 覆盖（至少最新 1 个交易日可用）
- 历史回补策略：
  - 默认只补缺口（从库里最后一条 trade_date 向前连续补到 asOf）
  - 新标的首次纳入目标池：补一个默认 lookback（例如 6M/1Y，待确认），避免图表区间切换立即触发大量按需回补
- 每次跑批必须落 `ingest_runs`：包含 asOfTradeDate、symbol 数、写入行数、错误摘要、耗时

### 每日定时跑批（Batch ingest）
- 默认：每天本地时间收盘后执行一次（例如 19:30，可配置）
- 规则：同一 `asOfTradeDate` 只跑一次（避免重复占用配额）；若应用当天未开启，下一次启动后检测“错过的交易日”则按交易日顺序补齐所有缺口（可分批/可暂停/可断点续跑）
- 与交互对齐：仍保留“手动立即刷新”和“按需回补”（图表区间/缺口触发），但都复用同一调度/互斥/记录体系

## 全量数据池跑批（Universe ingest）
目标：把 Universe 全量标的的数据池（prices/basics/moneyflow/meta/calendar）补齐到最新交易日，并持续维护“近 3 年窗口”。

- 初始构建（bootstrap）：首次启用时补齐近 3 年全量数据（可断点续跑、可暂停、可查看进度）
- 每日增量：之后每天只补“最新交易日”的增量数据；并可选做窗口滚动（保留近 3 年）
- 鲁棒性与限流：
  - 分批拉取（按 trade_date + symbol chunk）
  - 指数退避 + 有界重试
  - 幂等 upsert（同一天多次触发不会生成重复行）
  - `ingest_runs` 区分：`universe_bootstrap` / `universe_daily` / `targets_daily` / `on_demand`

## Milestones（按价值/依赖顺序）
### Milestone 1：可配置 + 可观测（把“跑起来”变成“可用”）
- Deliverables
  - 应用内可配置 Tushare Token（加密存储），并提供“连接测试/权限提示/错误解释”。
  - 可查询的 Tushare 标的基础库（即使不拉行情，也能查“名称/分类/代码等”）：
    - 提供标的搜索与详情查询（按代码/名称模糊检索）
    - 同步并缓存 Tushare 基础字段（至少：`ts_code/name/market/industry`，ETF 补齐类型字段）
    - 记录“字段映射/键值清单”（用于维护与后续扩展）
  - `market-cache` 增加 `ingest_runs`（或 `market_meta` 扩展）记录每次拉取的：开始/结束、触发原因、symbol 数、插入/更新行数、错误摘要。
  - UI 增加全局「数据状态」入口：显示覆盖率/新鲜度、上次拉取状态、缺失标的清单、以及“一键刷新”。
  - 每日定时跑批（补齐目标池到最新交易日）：
    - 可配置运行时间（默认 19:30，本地时区）
    - 同一 `asOfTradeDate` 去重；支持“启动后补跑错过交易日”（补齐所有错过的交易日；可分批/可暂停/可断点续跑）
    - 复用统一调度/互斥/`ingest_runs` 记录（定时/手动/按需回补同一套）
  - 全量数据池（Universe，近 3 年，DuckDB）：
    - 新增分析仓 `analysis.duckdb`（可重建）并落表：`daily_prices` + `daily_basics` + `daily_moneyflows` + `trade_calendar` + `instrument_meta`
    - 初始 bootstrap：一次性补齐近 3 年（可断点续跑/可暂停/可查看进度）
    - 每日增量：补齐最新交易日，并维护近 3 年窗口
  - 增加“拉取对象（Targets）”配置入口（v1 最小版，专门模块负责汇总/预览/解释）：
    - 支持的目标类型（先落可用最小集合，逐步扩展）：
      - 当前持仓（ledger-derived holdings，可开关；可选“按组合”粒度）
      - 自选列表（watchlist：单个标的/一组标的）
      - 全局标的注册表（registry：`instruments.auto_ingest=1`）
      - 显式标的（手工添加 `symbol`，用于“某具体公司”）
      - 条件型目标（依赖元数据/标签）：某某板块/某类型 ETF（先按 tag/category 机制落地）
    - 目标解析（Targets -> symbols）必须可预览：显示“将拉取的标的数/列表/来源原因”，并用于 `autoIngest` 与“按需回补”统一入口
    - 用户可显式开关“是否将持仓纳入自动拉取”（允许用户接受缺口，并依赖 dataQuality 提示去修复）
  - 分类策略（v1）：默认使用数据提供商（Tushare）给出的行业/分类；用户可额外添加自定义标签（tag）
- Acceptance
  - 无 env 的情况下，UI 明确提示如何配置 Token；不会静默失败。
  - 用户可以在 UI 看到“上次拉取结果”，并能手动触发一次拉取。
  - 用户可在 UI 明确配置“拉取对象”集合，并能看到当前将会拉取的 symbol 数量与预览。

### Milestone 2：symbol 选择正确性（ledger-first 对齐）
- Deliverables
  - auto-ingest 的 symbol 集合改为：基于“Targets 配置”的合并结果，例如：
    - `registry(auto_ingest=1)` ∪ `watchlist` ∪ `ledger-derived holdings`（各自可开关）
  - `ledger` 创建/更新/删除影响持仓时：注册 symbol 到 `instruments`（asset_class 可未知但不阻塞），并触发一次 auto-ingest（带 debounce/互斥锁）。
  - 统一 ingestion 互斥：避免手动拉取与自动拉取并发写同一 DB。
- Acceptance
  - 只通过交易流水录入新标的，也能在 1 个拉取周期内补齐行情；`dataQuality.missingSymbols` 可明显下降。

### Milestone 3：标的元数据 + 交易日历（让质量指标更可靠）
- Deliverables
  - 增加标的元数据同步（最小：name/market/currency/asset_class + provider 分类字段），用于 UI 展示、默认值填充、Targets 条件过滤。
  - 增加“分类/标签”能力（用于 Targets 的条件型目标）：
    - provider 分类：默认以 Tushare 为准（例如 stock 的 `industry/market`，fund/ETF 的 `fund_type/type/market` 等）
    - user tags：允许用户对标的打 tag（如“科技/红利/债券ETF/黄金ETF”等），Targets 可按 tag 选取标的集合
  - 增加交易日历表（最小：`market + date + is_open`），用于：
    - 新鲜度计算避免“非交易日误判”
    - 自动拉取的 `endDate` 选择更稳健（例如取最近交易日）
  - 日 K 图表能力（以 `daily_prices` 为数据源，补齐可用性闭环）：
    - 范围查询：提供 `symbol + date range` 的 OHLCV 读取接口（IPC），支持 1M/3M/6M/1Y/YTD/ALL 等区间。
    - 历史深度：支持“按需补拉/回补”（当区间超出默认 lookback 时），并显示补拉进度与结果（避免一次性全量拉取）。
    - 缺口提示：当数据不足/缺交易日/停牌导致断档时，图表明确标注并给出“一键补齐/刷新”入口。
    - 口径提示：v1 暂不做复权；若存在拆股/分红等未处理事件，图表与详情显示“未处理/未复权，可能不连续”的提示。
- Acceptance
  - 新鲜度口径与交易日对齐；“周末/节假日”不会导致误报。
  - 选中任一标的可稳定查看日 K；数据不足时提示清晰且可一键补拉。

### Milestone 4（可选）：公司行为/分红的“获取 + 未处理标识”
- Deliverables（分阶段）
  - v0：拉取并落 `market-cache.corporate_actions`（可展示、可追溯），并在 UI 提供 `handled/unhandled` 状态与“去处理”入口。
  - v1（后续再评估）：对持仓相关事件生成 `ledger_entries(source=system)`（带 `external_id` 幂等），参与 position/performance 回放。
- Acceptance
  - v0：用户能识别“哪些事件未入账”，并能按提示完成手工处理或确认忽略。
  - v1：同一数据源重复拉取不产生重复系统流水；回放结果可复现。

## Implementation plan（任务拆解，按执行顺序）
1. **Schema & observability**
   - market-cache schema_version（复用 `market_meta`）与迁移策略落地
   - 新增 `ingest_runs`（或等价结构）+ IPC 查询接口
2. **Token 管理**
   - main process 增加“安全配置存储”（加密 at-rest），提供 IPC：get/set/test
   - 约定优先级：env > 本地配置（并在 UI 显示来源）
3. **统一 ingestion 调度**
   - 增加全局 ingestion mutex
   - auto-ingest：支持 debounce、可取消（sessionId 已有雏形）
4. **拉取对象（Targets）配置（避免全量拉取）**
   - 建立一个专门的 Targets 模块（后端服务 + UI），负责：
     - 维护 Targets 配置（开关、规则、分组）
     - 解析 Targets -> symbols（并返回原因/预览）
     - 为 auto-ingest / 手动刷新 / 按需回补提供统一的“拉取对象”入口
   - 定义 Targets 的来源与开关：holdings(ledger) / watchlist / registry / explicit symbols / tag filters
   - 新增业务库表 `watchlist`（账号隔离），并提供 IPC：增删改查
   - 新增设置项：是否将 holdings 纳入自动拉取（默认开启，可关闭）
   - 新增 IPC：预览当前将拉取的 symbol 列表与数量
5. **symbol 来源对齐 ledger-first**
   - 从 ledger 推导当前持仓（复用现有 positionEngine/performance 逻辑）
   - 在 ledger 变更后触发 auto-ingest（只对受影响 symbol）
6. **元数据与交易日历（Tushare 单一 provider + 预留扩展接口）**
   - provider 接口扩展：instrument meta + trade calendar（v1 仅实现 Tushare）
   - 分类/标签（用于 Targets 的板块/ETF 类型等条件目标）：默认 provider 分类（Tushare）+ user tags
   - UI：标的注册表管理（搜索/auto_ingest 开关/最近更新时间）
7. **日 K 图表可用性闭环**
   - 新增日 K 数据范围查询 IPC（OHLCV）
   - 增加“按需补拉/回补”能力（区间选择触发、或显式按钮触发）
   - UI：标的详情/持仓详情的日 K 展示（区间切换、as-of、缺口提示）
   - UI：未处理公司行为/分红提示（与 Milestone 4 的 handled/unhandled 对齐）
8. **（可选）公司行为/分红**
   - 先做“获取并展示”与 as-of/source 追溯，再评估生成系统流水

## Verification
- Build/typecheck:
  - `pnpm typecheck`
  - `pnpm build`
- Manual smoke (核心路径)
  - 未配置 Token：UI 提示清晰；不会出现“点了没反应”
  - 配置 Token 后：点击“一键刷新”能拉取当前持仓行情；刷新后 `priceAsOf` 更新
  - 仅录入 trade 流水新增标的：无需手工创建 position，也能自动补齐行情
  - 断网/Token 失效：run 记录有失败状态与可读错误；下次恢复后可成功
  - 公司行为/分红：拉取到事件后，未入账时 UI 显示“未处理”；入账后状态变为“已处理”（或至少不再提示）
  - 日 K：区间切换能加载对应 OHLCV；区间超出历史时提示并可触发回补；存在未处理事件时显示“未处理/未复权”提示

## Risks & mitigations
| Risk | Likelihood | Impact | Mitigation | Rollback |
|---|---:|---:|---|---|
| Token 泄漏（日志/落库/入仓） | low | high | 只在本地配置加密存储；日志脱敏；禁止写入 DB | 立即删除本地配置并旋转 Token |
| ledger/position 双来源导致 symbol 不一致 | med | med | auto-ingest 以 ledger 推导为准；position 仅兼容 | 退回只用 instruments(auto_ingest) + positions |
| Tushare 限流/不稳定 | med | med | 指数退避、分批、失败重试；run 记录可观测 | 暂停 auto-ingest、保留手动拉取 |
| market-cache 迁移破坏旧数据 | low | high | schema_version + 迁移可回滚；迁移前备份 | 删除 market-cache 重新拉取 |
| 公司行为/分红未处理导致收益/成本口径偏差 | med | med | 明确“未处理”标识 + 处理入口；必要时在总览给出提醒 | 允许用户忽略提示或关闭公司行为展示 |
| 日 K 历史回补量大导致限流/耗时/磁盘膨胀 | med | med | 默认短 lookback + 按需补拉；分批拉取；run 记录可观测；允许用户清理缓存 | 关闭回补、清空 market-cache |
| 全量 3 年数据池体量过大导致耗时/磁盘爆 | med | high | DuckDB 独立文件；增量拉取；窗口滚动/清理策略；可暂停/断点续跑 | 删除 `analysis.duckdb` 重新构建或切回仅目标池 |
| 后续接入多 provider 后口径冲突（价格/元数据/日历冲突） | low | med | v1 先锁定 Tushare；预留 provider 接口与 `source` 标注；扩展时再定义优先级/回退并在 UI 可见 | 退回单一来源 |

## Rollout / Backout
- Rollout：桌面端本地更新；默认开启 auto-ingest（可 UI/ENV 关闭）
- Backout：
  - 关闭 auto-ingest（开关）
  - 清空 `market-cache.sqlite`（仅缓存，可重建）
  - 清除本地 Token（保留 env 方式）
