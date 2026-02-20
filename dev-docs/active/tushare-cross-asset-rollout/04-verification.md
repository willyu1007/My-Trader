# 04 Verification

## Automated checks
- `pnpm typecheck` -> expect exit 0
- `pnpm build` -> expect exit 0
- `pnpm -C apps/backend typecheck` -> expect exit 0
- `pnpm -C apps/frontend typecheck` -> expect exit 0

## Command checklist (actionable)
1. Resolve active account DB paths
```bash
USER_DATA="$HOME/Library/Application Support/@mytrader/backend"
ACCOUNT_INDEX="$USER_DATA/account-index.sqlite"
ACCOUNT_DIR="$(sqlite3 "$ACCOUNT_INDEX" "select data_dir from accounts order by coalesce(last_login_at,0) desc, created_at desc limit 1;")"
BUSINESS_DB="$ACCOUNT_DIR/business.sqlite"
MARKET_DB="$USER_DATA/market-cache.sqlite"
echo "ACCOUNT_DIR=$ACCOUNT_DIR"
```

2. Scheduler/control and rollout flags snapshot
```bash
sqlite3 "$BUSINESS_DB" "
select key, value_json
from market_settings
where key in (
  'ingest_scheduler_config_v1',
  'ingest_control_state_v1',
  'rollout_flags_v1'
)
order by key;
"
```

3. Recent run stability (last 7 days)
```bash
sqlite3 "$MARKET_DB" "
select
  date(started_at/1000,'unixepoch','localtime') as day,
  count(*) as runs,
  sum(case when status='failed' or coalesce(errors,0) > 0 then 1 else 0 end) as blocking_like_runs
from ingest_runs
group by day
order by day desc
limit 7;
"
```

4. Quality quick checks (null-rate / PK conflict)
```bash
sqlite3 "$MARKET_DB" "
select
  count(*) as total_rows,
  sum(case when symbol is null or trade_date is null or close is null then 1 else 0 end) as null_rows,
  round(100.0 * sum(case when symbol is null or trade_date is null or close is null then 1 else 0 end) / nullif(count(*),0), 4) as null_pct
from daily_prices;
"

sqlite3 "$MARKET_DB" "
select count(*) as pk_conflicts
from (
  select symbol, trade_date, count(*) c
  from daily_prices
  group by symbol, trade_date
  having c > 1
);
"
```

5. Macro future-leak check (run after P1 macro tables are available)
```bash
sqlite3 "$MARKET_DB" "
select count(*) as future_leak_rows
from macro_module_snapshot
where available_date > as_of_trade_date;
"
```

## Common gate checks (required)
- [ ] 连续 3 个交易日无阻断错误 run
- [ ] `inserted/updated/errors` 与目标表行变化可对账
- [ ] 关键字段空值率 <= 0.5%
- [ ] 主键冲突 = 0
- [ ] 手动/定时/启动补跑/暂停/恢复/取消全通过

## P0 gate checks
- [ ] P0 资产（stock/etf/index-context/futures/spot）全量 + 增量 run 各至少 1 次成功
- [ ] P0 核心模块 `complete + partial >= 95%`
- [ ] 指数上下文模块当日可用率 >= 95%

## P1 gate checks
- [ ] 外汇白名单 `task.momentum` 的 `complete + partial >= 95%`
- [ ] 宏观 4 模块最近 20 个交易日 `missing` 占比 <= 5%
- [ ] 无 `available_date > as_of_trade_date` 穿越记录

## P2 gate checks
- [ ] 每个增强模块上线前有权限探测与灰度记录
- [ ] P2 上线后 P0/P1 门禁指标无回退
- [ ] P2 模块可独立回滚且不影响核心链路

## P2 gray release checklist (wave-1)
1. Pre-check
- [ ] 已确认 `p2Enabled=false` 且所有 P2 子开关默认为 `false`
- [ ] 已完成目标接口权限探测并在 `03-implementation-notes.md` 记录结论

2. Single-module rollout
- [ ] 一次仅开启一个 P2 子模块开关
- [ ] 触发手动 ingest 并记录 run 结果（成功/失败、耗时、errors）
- [ ] 执行门禁回归，确认 P0/P1 指标未回退

3. Rollback drill
- [ ] 关闭当前子模块开关，确认执行路径可立即回退
- [ ] 回退后再次触发 ingest，确认核心链路恢复稳定

4. Promotion
- [ ] 单模块稳定后再进入下一个子模块灰度
- [ ] wave-1 全部完成后再评估是否扩大 P2 范围

## Manual checks
- [ ] Target 状态可追溯到 SSOT 缺口（含 explain payload）
- [ ] 批次开关/回滚开关行为符合预期
- [ ] 错误摘要可读且不泄露 token/敏感信息

## Post-verification convergence checklist (MUST)
- [ ] 已确认 P0/P1/P2 门禁全部通过，且连续 3 个交易日无阻断错误 run
- [ ] 将 rollout 默认值切换为全开（`p0Enabled/p1Enabled/p2Enabled=true`）
- [ ] 已验收的 P2 子模块默认值切换为开启（`p2RealtimeIndexV1/p2RealtimeEquityEtfV1/p2FuturesMicrostructureV1=true`）
- [ ] `p2SpecialPermissionStkPremarketV1` 仅在权限实测通过时置为 `true`，否则保持 `false`
- [ ] 删除 Dashboard 中面向业务用户的 rollout 配置 UI/UX（含入口、文案、交互）
- [ ] 回归验证：删除 UI 后手动拉取/定时拉取/启动补跑路径不受影响

## Runs (recorded)
- 2026-02-20：初始化全范围承接任务文档（尚未执行代码级验证）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/packages/shared build` -> ✅
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/frontend typecheck` -> ✅
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ❌（已知阻塞：`@duckdb/duckdb-wasm` 类型声明缺失，非本次改动引入）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader typecheck` -> ❌（同上，backend DuckDB 类型阻塞）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/packages/shared build` -> ✅（新增 rollout flags 类型/IPC 后重跑）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/frontend typecheck` -> ✅（新增 preload API 后重跑）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ❌（仍为同一 DuckDB 类型阻塞；未出现新增类型错误）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/packages/shared build` -> ✅（新增 rollout flags 前端面板后重跑）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/frontend typecheck` -> ✅（新增 rollout flags UI 与按钮门禁后重跑）
- 2026-02-20：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ❌（阻塞不变：`@duckdb/duckdb-wasm` 类型声明缺失）
- 2026-02-20：批次开关冒烟（仓储级，真实账号库）-> ✅
  - 基线快照：`sqlite3 "$BUSINESS_DB" "select key,value_json from market_settings where key='rollout_flags_v1';"`
  - 执行：通过临时编译并调用 `getMarketRolloutFlags/setMarketRolloutFlags/getMarketRolloutFlags/restore`，验证 `write_read_consistent=true`、`updated_at_forward_on_set=true`、`restore_back_to_original=true`
  - 结果：开关读写与持久化正常，`updatedAt` 正向增长，测试后已恢复原始值
- 2026-02-20：运行快照复核（真实库）-> ✅
  - `sqlite3 "$BUSINESS_DB" "select key,value_json from market_settings where key='rollout_flags_v1';"`（确认恢复后的最终值）
  - `sqlite3 "$MARKET_DB" "select date(started_at/1000,'unixepoch','localtime') day,count(*) runs,sum(case when status='failed' or coalesce(errors,0)>0 then 1 else 0 end) blocking_like_runs from ingest_runs group by day order by day desc limit 7;"`（近 7 天 run 快照）
- 2026-02-20：构建/类型检查回归（Phase A）-> ⚠️部分通过
  - `pnpm -C packages/shared build` -> ✅
  - `pnpm -C apps/frontend typecheck` -> ✅
  - `pnpm -C apps/backend typecheck` -> ❌（已知阻塞：`@duckdb/duckdb-wasm` 类型声明缺失，阻塞未变化）
- 2026-02-20：P0 门禁冒烟（orchestrator 级，真实账号库）-> ✅
  - 执行：`p0Enabled=false` 后分别 enqueue `source=manual` 与 `source=schedule` 的 targets 任务，并等待 orchestrator 回到 idle
  - 观测：manual 路径报错 `当前已关闭 P0 批次开关，禁止执行数据拉取。`；schedule 路径日志 `schedule ingest skipped: P0 rollout is disabled.`
  - 对账：`ingest_runs` 行数保持不变（before=80, afterManual=80, afterSchedule=80）
  - 恢复：测试后已将 `rollout_flags_v1` 恢复到原值
- 2026-02-20：P0 门禁 UI 代码路径校验（静态）-> ✅
  - 前端触发前置阻断：`apps/frontend/src/components/Dashboard.tsx:3014`
  - 手动拉取按钮禁用条件：`apps/frontend/src/components/Dashboard.tsx:9207`、`apps/frontend/src/components/Dashboard.tsx:9219`、`apps/frontend/src/components/Dashboard.tsx:9231`
- 2026-02-20：Phase B 首段实现后编译回归 -> ⚠️部分通过
  - `pnpm -C packages/shared build` -> ✅
  - `pnpm -C apps/frontend typecheck` -> ✅
  - `pnpm -C apps/backend typecheck` -> ❌（已知阻塞不变：`@duckdb/duckdb-wasm` 类型声明缺失）
- 2026-02-20：Phase B 代码路径校验（静态）-> ✅
  - `InstrumentKind/MarketInstrumentKind` 已扩展：`stock/fund/index/futures/spot`
  - `tushareProvider.fetchInstrumentCatalog` 已纳入 `index_basic/fut_basic/sge_basic`（optional）
  - `runUniverseIngest/ingestUniverseTradeDate` 已接入 `index_daily/fut_daily/sge_daily`，run `meta.universeCounts` 包含 `indexes/futures/spots`
