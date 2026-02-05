# 06 DB Schema（Draft）

> 目标：在“真相源 = 流水（ledger-first）”前提下，定义可演进、可追溯、可复现的数据结构。  
> 说明：此文件是草案，会随着功能讨论逐步收敛。

## 数据库划分
- **business.sqlite（账号隔离）**：组合配置、交易/现金流水、风险规则、目标配置、报表/快照等业务数据
- **market-cache.sqlite（全局共享缓存）**：标的注册表与公共市场数据（行情/公司行为/汇率/交易日历等）

## business.sqlite（账号隔离）
### 已有表（现状）
- `app_meta(key, value)`：`schema_version`
- `portfolios(id, name, base_currency, created_at, updated_at)`
- `positions(...)`：当前为“手工持仓 + 兼容层”（后续会降级为派生缓存或迁移到流水）
- `risk_limits(...)`

### 核心：统一流水表 `ledger_entries`（计划新增）
> 交易 Tab 覆盖：买卖、费用税费、分红、现金流、持仓调整、公司行为事件。  
> 因此建议优先落一个可扩展的统一流水表，并由“持仓引擎”从该表推导持仓/现金/收益等结果。

#### 字段（建议）
- 主键与归属
  - `id` text primary key（uuid）
  - `portfolio_id` text not null
  - `account_key` text（nullable，预留扩展钩子；默认 `null` 或 `default`）
- 事件语义
  - `event_type` text not null  
    - 典型值：`trade`、`cash`、`fee`、`tax`、`dividend`、`adjustment`、`corporate_action`
  - `trade_date` text not null（`YYYY-MM-DD`）
  - `event_ts` integer（UTC epoch ms，用于稳定排序；如无法提供可为空）
  - `sequence` integer（同一 `event_ts` 内稳定排序，可选）
  - `note` text
- 标的相关（可空）
  - `instrument_id` text（稳定标的 ID，优先用于计算）
  - `symbol` text
  - `side` text（`buy` / `sell`；仅在需要方向的事件里使用）
  - `quantity` numeric（数量始终为正，方向由 `side` 表达）
  - `price` numeric
  - `price_currency` text（可选；默认等同 `cash_currency` 或标的币种）
- 现金相关（可空）
  - `cash_amount` integer（建议用正负号表示流入/流出，按 minor units 存储）
  - `cash_currency` text
  - `fee` integer（minor units）
  - `tax` integer（minor units）
- 导入/追溯（强烈建议保留）
  - `source` text not null（`manual`/`csv`/`broker_import`/`system` 等）
  - `external_id` text（用于幂等导入去重）
  - `meta_json` text（可选：公司行为细节、备注字段、未来 lot 信息扩展等）
- 时间戳
  - `created_at` integer not null
  - `updated_at` integer not null
  - `deleted_at` integer（可选：软删除，满足审计/撤销/回滚）

#### 语义约定（建议）
- 排序：引擎按 `event_ts` -> `sequence` -> `id` 回放；`trade_date` 仅用于聚合/估值日
- `trade` / `adjustment`：通常需要 `instrument_id + side + quantity`；`price` 视业务需要（trade 必填，adjustment 可选）
- 标的引用：计算以 `instrument_id` 为准，`symbol` 仅用于展示/导入冗余
- `trade` 现金腿：显式 `cash_amount + cash_currency`，不依赖 `quantity*price` 推导
- `cash`：通常使用 `cash_amount + cash_currency`
- `fee` / `tax`：可单独事件或挂在 trade 上（先按最简单的“单独事件”设计）
- `dividend` / `corporate_action`：可以先作为事件落在 `ledger_entries`，后续如需要更丰富字段再拆表
- `meta_json`：建议包含 `adjustment_mode`（`absolute`/`delta`）与公司行为标准字段

#### 数值精度策略（建议）
- 金额类（`cash_amount/fee/tax`）：使用 minor units 整数存储
- 数量/价格：优先定点（`value_int + scale`）或 Decimal（字符串写入 NUMERIC），避免 SQLite REAL 累积误差
  - 若采用 `value_int + scale`，可替换为 `quantity_int/quantity_scale`、`price_int/price_scale`

#### 推荐索引/约束
- 索引
  - `index ledger_entries_portfolio_date (portfolio_id, trade_date)`
  - `index ledger_entries_portfolio_instrument (portfolio_id, instrument_id, trade_date)`
  - `index ledger_entries_portfolio_type (portfolio_id, event_type, trade_date)`
  - `index ledger_entries_portfolio_ts (portfolio_id, event_ts)`
- 幂等导入（可选）
  - `unique (portfolio_id, source, external_id)`（`external_id` 为 null 时 SQLite 允许重复）
- 检查约束（可选）
  - `check (side in ('buy','sell') or side is null)`
  - `check (quantity is null or quantity >= 0)`
  - `check (event_ts is null or event_ts > 0)`
  - `check (cash_amount is null or cash_currency is not null)`

### 可选：`portfolio_instruments`（业务库映射表）
> 用于提供稳定 `instrument_id`，避免 symbol 变更/退市导致历史回放不一致。

- `id` text primary key（作为 `instrument_id`）
- `portfolio_id` text not null
- `symbol` text not null
- `market` text
- `name` text
- `alias_json` text（可选：别名/历史代码）
- `created_at` / `updated_at`
- 约束：`unique (portfolio_id, symbol)`

### 目标配置 `allocation_targets`（计划新增）
- `id` text primary key
- `portfolio_id` text not null
- `target_type` text not null（`symbol`/`asset_class`/`currency` 等）
- `target_key` text not null
- `weight` real not null（0~1）
- `created_at` / `updated_at`

### 快照/报表 `portfolio_snapshots`（后续）
> 用于复盘与可复现：保存当时使用的 as-of、口径版本、数据版本摘要等。

- `id` text primary key
- `portfolio_id` text not null
- `as_of_date` text not null
- `inputs_json` text（口径/版本/参数/数据源摘要）
- `outputs_json` text（估值/收益/风险结果摘要）
- `created_at` integer not null

## market-cache.sqlite（全局共享缓存）
### 已有表
- `instruments(symbol primary key, name, asset_class, market, currency, auto_ingest, created_at, updated_at)`
- `instrument_data_sources(symbol, domain, source, updated_at)`（同一标的同一数据域的当前数据源）
- `sw_industries(level, code, name, parent_code, updated_at)`（申万行业层级与 L1-L2 关系）
- `daily_prices(symbol, trade_date, open, high, low, close, volume, source, ingested_at)`

### 规划表（按需要逐步接入）
- `corporate_actions`：公司行为事件（数据源可得时）
- `fx_rates`：汇率（决定是否纳入多币种折算主线）
- `trading_calendar`：交易日历（对齐估值/收益率的日期轴）

## 迁移策略（建议）
- `apps/backend/src/main/storage/businessSchema.ts` 继续用 `schema_version` 做版本化迁移；每次新增表/字段都 bump 版本。
- 流水表新增后，现有 `positions` 作为兼容层逐步迁移：
  - 把现有手工持仓转换成一组 `ledger_entries(event_type='adjustment')` 作为期初持仓
  - UI 改为编辑流水（或生成调整流水），而不是直接改 positions

## Decisions（已确认）
- 交易方向：使用 `side`（`buy/sell`）
- 成本法（MVP）：均价法
- 不需要多账户/子账户（不引入 account_id 维度，但预留 `account_key`）

## Next open items
- 是否强制启用软删除（`deleted_at`）与撤销/审计策略？
- 公司行为事件：优先落到 `ledger_entries`（推荐）还是先建 `corporate_actions` 再映射？
- `event_ts` 的来源与精度（是否要求导入源必须提供）
- `price_currency` 规则（缺省等同 `cash_currency` 或标的币种）
- 数量/价格定点策略（采用 `value_int + scale` 还是 Decimal）
