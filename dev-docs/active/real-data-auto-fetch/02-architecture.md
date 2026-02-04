# 02 Architecture

## Boundaries（边界）
- **business.sqlite（账号隔离）**：组合配置、交易流水、持仓引擎输出（快照/报表）、风险规则等；不得写入全局缓存。
- **market-cache.sqlite（全局共享缓存）**：标的注册表与公共市场数据（行情/公司行为/汇率/交易日历等）；不得写入任何账号业务信息（持仓数量/现金余额/交易记录等）。

## Key invariants（必须保持）
- Token/密钥只允许来自：
  - 环境变量（最高优先级）
  - 本地加密配置（Electron `safeStorage`）
  - 禁止：落库、写入 repo、明文日志输出
- 外部 HTTP（Tushare）不得在 DB transaction 内调用；拉取与入库分离，保证可回滚与可重试。
- ingestion 必须串行化（全局 mutex），避免“手动拉取 vs auto-ingest”并发写同一 DB。
- 可追溯：所有落入 market-cache 的数据都应携带 `source` + `ingested_at`；计算结果需可定位 as-of。

## Data model（方向）
### market-cache.sqlite（全局共享）
- 已有
  - `instruments(symbol primary key, name, asset_class, market, currency, auto_ingest, created_at, updated_at)`
  - `daily_prices(symbol, trade_date, open, high, low, close, volume, source, ingested_at)`
- 新增（v1）
  - `ingest_runs`：记录每次拉取的结构化结果（触发原因、范围、耗时、错误摘要、写入行数）
  - `trading_calendar`：`market + date + is_open`（用于新鲜度/截止日判断）
  - `instrument_profiles`（或扩展 `instruments`）：缓存 Tushare 标的基础数据（名称/分类/上市信息等），支持搜索与详情查询（即使不拉行情也可用）
- 新增（可选）
  - `corporate_actions`：公司行为/分红事件（用于展示与“未处理”标识）

### business.sqlite（账号隔离）
- 已有（相关）
  - `ledger_entries`：统一流水（用于 ledger-first 持仓推导）
- v1 不新增“自动公司行为入账”；只需支持 UI “去处理”时创建手工流水。

## Provider abstraction（数据源抽象）
- 现状：
  - Tushare client 已支持日线（股票 `daily`、ETF `fund_daily`）
  - CSV import 已支持（属于另一类来源：用户导入）
- v1 扩展建议：
  - Instrument metadata：最小补齐 `name/market/currency/asset_class`
  - Trading calendar：最小补齐 `market/date/is_open`
  - Corporate actions（可选）：先落缓存 + 展示，不进入复算
- v1 原则（单一 provider + 可扩展接口）
  - 外部 provider v1 暂锁定为 Tushare（单一来源），但 provider 层必须可插拔（为后续扩展预留）。
  - 即使只有单一 provider，也要保留 `source` 标注（Tushare/CSV 等）与 as-of/ingested_at 追溯字段。

## IPC / API surface（建议）
> 现有：`market.ingestTushare`, `import*Csv`, `chooseCsvFile`。

建议新增（命名以最终实现为准）：
- `market.getDataStatus()`：返回 token 状态、上次 run、缺失/过期摘要、建议动作
- `market.setProviderToken({ provider, token })`：写入本地加密配置（不落库）
- `market.testProviderToken({ provider })`：发起最小请求验证 token
- `market.listIngestRuns({ limit })`：用于 UI 展示“拉取历史”
- `market.getDailyBars({ symbol, startDate, endDate })`：日K范围查询
- `market.backfillDailyBars({ symbol, startDate, endDate })`：按需回补并记录 run
- `market.listInstrumentRegistry()` / `market.setInstrumentAutoIngest()`：标的注册表管理（可选 v1）
- `market.listCorporateActions(...)`（可选 v1）
- `market.getTargets()` / `market.setTargets(...)`：拉取对象（Targets）配置（v1 必需）
- `market.listWatchlist()` / `market.addWatchlistItem(...)` / `market.removeWatchlistItem(...)`：自选列表管理（账号隔离）
- `market.previewTargets()`：返回“将拉取的 symbols + 原因（来自 holdings/watchlist/registry/tag/...）”
- `market.searchInstruments({ query, assetClass?, market? })`：基于本地缓存的 Tushare 标的库搜索
- `market.getInstrumentProfile({ symbol })`：获取某标的完整基础信息（名称/分类/代码等）
- `market.syncInstrumentCatalog({ force? })`：同步/刷新 Tushare 标的基础库（可增量/可分批）

## Scheduling & symbol selection（调度与标的选择）
- auto-ingest symbol 集合（v1 目标）= 基于 Targets 配置的合并结果：
  - registry：`instruments(auto_ingest=1)`（全局 registry）
  - watchlist：账号自选列表（business.sqlite，账号隔离）
  - holdings：ledger-derived 当前持仓（按 portfolio 回放推导；positions 仅兼容）
- 触发源：
  - 定时器（已有）
  - 手动刷新（已有入口，需升级可观测与 UX）
  - ledger 变更（新增）：影响持仓的事件触发一次 debounce 拉取（仅拉受影响 symbol）

## Freshness / coverage semantics（口径）
- Coverage：已实现按“有价标的市值占比”估算；保持并补齐解释/UI 修复入口。
- Freshness：接入交易日历后，以“最近交易日”为基准计算滞后；避免周末/节假日误报。

## 日K图表语义（v1）
- 数据源：`daily_prices` 的 OHLCV
- 范围查询：按 `symbol + [startDate,endDate]` 读取，允许断档（停牌/缺数据）
- 回补：当区间超出默认 lookback 或存在缺口时，允许用户触发回补（避免默认全量拉取）
- 复权：v1 暂不做；若存在拆股/分红未处理事件，UI 必须提示“未处理/未复权，可能不连续”

## Targets（拉取对象）语义（v1）
- 目标：避免全量拉取；用户可控制“自动保持更新的标的集合”。
- 形态：Targets 是一个“规则集合”，由专门模块负责管理与解析（Targets -> symbols）。
- 配置项（建议）
  - `includeHoldings`：是否将 holdings 纳入自动拉取（默认 true，可关闭）
  - `includeRegistryAutoIngest`：是否包含 registry(auto_ingest=1)（默认 true）
  - `includeWatchlist`：是否包含 watchlist（默认 true）
  - `explicitSymbols`（可选）：显式加入的 symbol（用于“某具体公司”）
  - `tagFilters`（可选）：按标签/分类选取（用于“某某板块/某类型ETF”）
  - `maxSymbolsPerRun` / `batchSize`（可选）：避免一次 run 过大导致限流
- 数据归属
  - watchlist 是业务偏好，必须落 business.sqlite（账号隔离）
  - registry(auto_ingest) 是全局偏好，落 market-cache.sqlite（已存在）

## Targets module（建议实现边界）
> 这是一个“功能模块”，用于把“用户表达的拉取对象（板块/标的/ETF类型/持仓/watchlist…）”解析成“具体要拉取的 symbols”，并保证可预览、可解释、可复用。

### Responsibilities
- 管理配置：
  - holdings（ledger-derived，可能需要按 portfolio 粒度开关）
  - watchlist（单标的或用户分组）
  - registry（`auto_ingest` 开关）
  - explicit symbols（手工加入）
  - tag/category filters（板块/ETF类型等条件目标）
- 解析与预览：
  - 输出 `ResolvedSymbol[]`：`symbol` + `reasons[]` +（可选）`assetClass/market/currency`
  - 对每个 symbol 标注来源原因（例如：`holdings:portfolio:A`、`watchlist:group:tech`、`tag:bond_etf`）
- 供给统一入口：
  - auto-ingest / 手动刷新 / 按需回补 都从同一套解析结果取 symbols

### Data dependencies
- holdings：来自 business.sqlite 的 `ledger_entries` 回放推导（positions 仅兼容）
- watchlist：来自 business.sqlite（账号隔离）
- registry + instrument meta + tag：来自 market-cache.sqlite（全局共享；不得写业务信息）

### Classification strategy（板块/ETF类型）
- v1：默认使用 Tushare 的行业/分类字段；同时支持用户手工 tag（例如：`sector:tech`、`etf:bond`、`theme:dividend`），Targets 可以按 tag 选取。
- 后续：扩展其他 provider 时，补充分类字段映射与冲突处理（此时再定义优先级/回退）。
