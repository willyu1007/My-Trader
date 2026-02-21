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

6. Phase R2 gate snapshot (baseline-aware, read-only)
```bash
pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend run phase-r2:gate-snapshot -- --baseline-run-id 0eb63ce9-e877-4424-a622-2b2ebd11c829 --target-clean-days 3
```

7. Historical replay gate (3 as-of days, optional accelerated verification)
```bash
# 通过临时 Electron 脚本触发 now=2026-02-11/12/13 的三次 universe run
# 并写入 meta.source='historical-gate-replay'
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
- [ ] 稳定期主链路（降级接口关闭）连续 3 个交易日无阻断失败
- [ ] Wave-1 `index_daily` 恢复门禁通过（独立开关 + 独立游标 + 独立回滚）
- [ ] Wave-2 `daily_basic` 恢复门禁通过
- [ ] Wave-3 `moneyflow` 恢复门禁通过

## P2 gate checks
- [ ] 每个增强模块上线前有权限探测与灰度记录
- [ ] P2 上线后 P0/P1 门禁指标无回退
- [ ] P2 模块可独立回滚且不影响核心链路

## P2 gray release checklist (wave-1)
1. Pre-check
- [x] 已确认收口后默认值：`p2Enabled=true` 且 `p2RealtimeIndexV1/p2RealtimeEquityEtfV1/p2FuturesMicrostructureV1=true`
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
- [ ] 模块级游标推进可追踪（index_daily/daily_basic/moneyflow）
- [ ] `status='running'` 残留自动收敛有效（启动后为 0）

## Post-verification convergence checklist (MUST)
- [ ] 已确认 P0/P1/P2 门禁全部通过，且连续 3 个交易日无阻断错误 run
- [x] 将 rollout 默认值切换为全开（`p0Enabled/p1Enabled/p2Enabled=true`）
- [x] 已验收的 P2 子模块默认值切换为开启（`p2RealtimeIndexV1/p2RealtimeEquityEtfV1/p2FuturesMicrostructureV1=true`）
- [x] `p2SpecialPermissionStkPremarketV1` 仅在权限实测通过时置为 `true`，否则保持 `false`
- [x] 删除 Dashboard 中面向业务用户的 rollout 配置 UI/UX（含入口、文案、交互）
- [x] 回归验证：删除 UI 后手动拉取/定时拉取/启动补跑路径不受影响

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
  - 备注：该路径在收口阶段已移除业务侧 rollout UI/UX，现以 backend 门禁与默认全开收敛逻辑为准。
- 2026-02-20：Phase B 首段实现后编译回归 -> ⚠️部分通过
  - `pnpm -C packages/shared build` -> ✅
  - `pnpm -C apps/frontend typecheck` -> ✅
  - `pnpm -C apps/backend typecheck` -> ❌（已知阻塞不变：`@duckdb/duckdb-wasm` 类型声明缺失）
- 2026-02-20：Phase B 代码路径校验（静态）-> ✅
  - `InstrumentKind/MarketInstrumentKind` 已扩展：`stock/fund/index/futures/spot`
  - `tushareProvider.fetchInstrumentCatalog` 已纳入 `index_basic/fut_basic/sge_basic`（optional）
  - `runUniverseIngest/ingestUniverseTradeDate` 已接入 `index_daily/fut_daily/sge_daily`，run `meta.universeCounts` 包含 `indexes/futures/spots`
- 2026-02-20：Phase B 前端筛选回归（kind）-> ✅
  - `Dashboard` 的 kind 筛选项已扩展到 `stock/fund/index/futures/spot`
  - `pnpm -C apps/frontend typecheck` -> ✅
- 2026-02-20：Phase B 实网回归前置检查（Electron token + provider 冒烟）-> ⚠️阻塞
  - 使用 Electron 临时脚本读取活跃账号 token 并准备执行 `index/futures/spot` feed 冒烟
  - 结果：`token.configured=false`, `token.source=none`（无法获取可用 Tushare token）
  - 结论：真实 API 的 P0 全量/增量回归暂不可执行，需先在活跃账号配置可用 token
- 2026-02-20：DuckDB 类型阻断修复 -> ✅
  - 新增：`apps/backend/src/types/duckdb-wasm.d.ts`
  - `pnpm -C apps/backend typecheck` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader typecheck` -> ✅
- 2026-02-20：全量构建回归（修复后）-> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader build` -> ✅
- 2026-02-20：P0 provider 扩展逻辑 mock 冒烟 -> ✅
  - 方式：stub `global.fetch`，覆盖 `stock_basic/fund_basic/index_basic/fut_basic/sge_basic`
  - 断言通过：`index`/`futures` 目录可入链、ETF 过滤生效、`sge_basic` 失败时走 optional catalog 降级且不阻断整体 catalog 返回
- 2026-02-20：P0 门禁 orchestrator 冒烟复跑（真实账号库）-> ✅
  - 对账：`ingest_runs` 行数保持不变（before=90, afterManual=90, afterSchedule=90）
  - 结论：`p0Enabled=false` 时 manual 阻断、schedule 跳过，且测试后开关恢复
- 2026-02-20：收口改动编译回归 -> ✅
  - `pnpm typecheck` -> ✅
  - `pnpm build` -> ✅
- 2026-02-20：收口改动运行回归（dev）-> ✅
  - `pnpm dev` 启动后 watch/build 正常，未出现 `managed ingest job failed` 阻断日志
  - 手动中断产生 `ELIFECYCLE exit code 130`，属于 SIGINT 正常退出
- 2026-02-20：历史 rollout flags 自动收敛冒烟（真实账号库）-> ✅
  - 执行：手工将 `rollout_flags_v1` 写入旧值（含非全开字段），重启 `pnpm dev` 触发账号解锁
  - 结果：`rollout_flags_v1` 自动恢复为默认全开基线（`p0/p1/p2=true`，3 个 P2 子模块开关 `true`，专项权限开关保持 `false`）
- 2026-02-20：rollout UI 删除静态校验 -> ✅
  - `apps/frontend/src/components/Dashboard.tsx` 已无 “批次开关（Rollout）” 入口、文案与交互逻辑残留
- 2026-02-21：Phase C（P1）开发回归（编译级）-> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader/packages/shared build` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/frontend typecheck` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader typecheck` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader build` -> ✅
- 2026-02-21：Phase C 代码路径静态校验 -> ✅
  - 外汇白名单目录 + 日线链路：`forex` 已接入 `fetchInstrumentCatalog` 与 `ingestUniverseTradeDate(fx_daily)`，并受 `p1Enabled` 门禁控制。
  - 外汇元数据镜像：新增 `fx_pair_meta`（DuckDB + market-cache.sqlite），写入 `base_ccy/quote_ccy/quote_convention/is_active`。
  - 宏观基线链路：新增 `macro_series_meta`、`macro_observations`、`macro_module_snapshot`（DuckDB），以及 `macro_observations_latest`、`macro_module_snapshot`（market-cache.sqlite 镜像）。
  - 时间语义门禁：宏观 `available_date` 计算落地（`release_date` 优先 + fallback lag + next CN trade date），并在快照写入时阻断 `available_date < release_date`。
- 2026-02-21：Phase C 运行态冒烟（dev 启动）-> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend dev` 启动后，watch/build 正常，日志出现 `auto-ingest scheduled every 360 min`，未出现 schema 初始化阻断错误。
  - 手动中断产生 `ELIFECYCLE exit code 130`，属于 SIGINT 正常退出。
- 2026-02-21：Phase C 实库回归（启动补跑）-> ❌ 阻断
  - 执行：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend dev`（等待启动补跑）
  - 观测：日志出现 `managed ingest job failed`，错误为 `Out of Memory Error`（DuckDB `3.1 GiB` 内存上限耗尽，且未设置 `temp_directory`）。
  - 对账：
    - 最新 `universe` run 记录为 `failed`（`error_message` 前缀为 OOM）；
    - `fx_pair_meta/macro_series_meta/macro_observations_latest/macro_module_snapshot` 仍为 0 行；
    - `macro_module_snapshot` future-leak 检查仍为 0（无数据）。
  - 结论：P1 实网回归被 Universe OOM 阻断，需先完成运行资源与切片治理。
- 2026-02-21：实库健康附加检查 -> ⚠️
  - `ingest_runs` 存在历史 `status='running'` 残留：`targets=9`、`universe=4`。
  - 影响：run 稳定性统计会被污染，建议在 orchestrator 启动阶段补充“过期 running 收敛”为 `failed/canceled` 的修复。
- 2026-02-21：阻断修复回归（第 1 轮）-> ⚠️部分通过
  - 代码修复：DuckDB 运行时参数 + stale running 收敛 + Universe 分片（batch）+ `instrument_meta` 批量 upsert。
  - 运行观测：启动后出现 `converged stale running ingest runs: 13`，收敛生效；但 universe 补跑仍出现 `memory access out of bounds` 与 `daily_basic/daily offset` 阻断。
- 2026-02-21：阻断修复回归（第 2 轮）-> ✅
  - 代码修复：`fetchTusharePaged` 增加重复页检测与 partial-return 防护；Universe 临时降级停用 `daily_basic/moneyflow/index_daily` 全市场日级拉取。
  - 执行：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend dev`（等待启动补跑完成后再退出）。
  - 结果：
    - 最新 universe run：`0eb63ce9-e877-4424-a622-2b2ebd11c829 | success | as_of_trade_date=2026-02-13 | errors=0`
    - `meta_json`：`processedTradeDates=1`、`pendingTradeDates=731`、`macroSummary.seriesCount=14`、`macroSummary.observationCount=11248`、`macroSummary.moduleSnapshotCount=4`
    - P1 表行数：`fx_pair_meta=8`、`macro_series_meta=14`、`macro_observations_latest=13`、`macro_module_snapshot=4`
    - `macro_module_snapshot` future-leak 检查：`0`
    - 退出后 `status='running'` 计数：`0`
- 2026-02-21：恢复计划落盘后执行回归（Phase R1）-> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader/packages/shared build` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader typecheck` -> ✅
  - 启动补跑（`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend dev`）后最新 universe run：
    - `status=success`, `as_of_trade_date=2026-02-13`, `errors=0`
    - `meta.recoverySummary` 已包含 3 个恢复模块条目（index_daily/daily_basic/moneyflow）
- 2026-02-21：Wave-1 `index_daily` 首轮灰度（开启 `universeIndexDailyEnabled`）-> ✅
  - 设置：`rollout_flags_v1.universeIndexDailyEnabled=true`（其余两个恢复开关保持关闭）。
  - 启动补跑后最新 universe run：
    - `status=success`, `errors=0`
    - `recoverySummary[0]`（index_daily）：`status=partial`、`processedTradeDate=2023-02-14`、`processedSymbols=40`、`pendingTradeDates=732`、`pendingSymbolsInDate=7960`
    - `recoverySummary[0].cursor={"tradeDate":"2023-02-14","symbolOffset":40}`
  - 结论：Wave-1 分片与独立游标机制已生效，且未阻断主链路成功。
- 2026-02-21：Phase R2 代码回归（Wave-2/3 实现后）-> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader/packages/shared build` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader typecheck` -> ✅
  - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend build` -> ✅
- 2026-02-21：Wave recovery 自动化冒烟（Electron 脚本）-> ✅
  - 执行命令：
    - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend exec tsc -p tsconfig.json --noEmit false --outDir /private/tmp/mytrader-wave-smoke-1771640586`
    - `MYTRADER_USER_DATA=\"/Users/yurui/Library/Application Support/@mytrader/backend\" pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend exec electron /private/tmp/mytrader-wave-smoke-1771640586/run_recovery_wave_smoke.js`
  - 场景结果：
    - `all_recovery_disabled` -> universe `success`，三模块 `disabled`
    - `wave2_daily_basic_enabled` -> universe `success`，`daily_basic=partial`，`cursor.symbolOffset=30`
    - `wave3_moneyflow_enabled` -> universe `success`，`moneyflow=partial`，`cursor.symbolOffset=30`
  - 清理验证：
    - `rollout_flags_v1` 已恢复原值（`universeIndexDailyEnabled=true`，`universeDailyBasicEnabled=false`，`universeMoneyflowEnabled=false`）
    - smoke run ids（`9fd29631-556b-40e2-b3d9-b2258a212091`、`04b829f5-1f03-4239-9208-12bfcb830e3d`、`77ae56cd-a603-40e2-931c-d1999c4bd6ab`）已删除
- 2026-02-21：Phase R2 soak 续跑发现 cursor 不推进 -> 已修复并复测通过 ✅
  - 症状复现（修复前）：
    - `manual-soak` 连续 run 中，三模块 cursor 重复停留在同一 offset（`index=40`、`daily_basic=30`、`moneyflow=30`），`cursorMonotonic=false`。
  - 修复动作：
    - `marketIngestRunner` 将 cursor 存储从 DuckDB `analysis_meta` 切换到 `market-cache.sqlite.market_meta`。
  - 编译回归：
    - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ✅
    - `pnpm -C /Volumes/DataDisk/Project/My-Trader typecheck` -> ✅
  - 复测命令：
    - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend exec tsc -p tsconfig.json --noEmit false --outDir /private/tmp/mytrader-wave-soak2-1771643008`
    - `MYTRADER_USER_DATA=\"/Users/yurui/Library/Application Support/@mytrader/backend\" pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend exec electron /private/tmp/mytrader-wave-soak2-1771643008/run_wave_soak2.js`
  - 复测结果：
    - Wave-1 `index_daily`：cursor `40 -> 80`，`pendingSymbolsInDate 7960 -> 7920`
    - Wave-2 `daily_basic`：cursor `30 -> 60`，`pendingSymbolsInDate 5454 -> 5424`
    - Wave-3 `moneyflow`：cursor `30 -> 60`，`pendingSymbolsInDate 5454 -> 5424`
    - 所有 run `status=success` 且 `errors=0`
  - 清理：
    - 删除测试运行记录：`delete from ingest_runs where json_extract(meta_json,'$.source') in ('manual-soak','manual-soak2')`（共 13 条）
    - 删除临时目录：`/private/tmp/mytrader-wave-soak-1771642343`、`/private/tmp/mytrader-wave-soak2-1771643008`、`/private/tmp/mytrader-duckdb-persist-1771642669`
- 2026-02-21：Phase R2 追加轻量回归（`manual-soak3`）-> ✅
  - 执行命令：
    - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend exec electron /private/tmp/mytrader-wave-soak3-1771644652/run_wave_soak3.js`
  - 结果摘要：
    - Wave-1 `index_daily`：cursor `120 -> 160`（`runId=316c7deb-77ff-4a99-93be-dbb8cd8e016e`）
    - Wave-2 `daily_basic`：cursor `90 -> 120`（`runId=72bc73b7-4215-4493-aa78-1beb01615f9b`）
    - Wave-3 `moneyflow`：cursor `90 -> 120`（`runId=bdf2a13b-b5ca-4cdf-a656-74badd308c4f`）
    - 三个 run 均 `status=success` 且 `errors=0`
    - 回归后 flags 快照：`universeIndexDailyEnabled=true`、`universeDailyBasicEnabled=false`、`universeMoneyflowEnabled=false`
  - 运行观察（非阻断）：
    - `sge_basic` 触发 Tushare 每日限额报错（optional catalog），主链路继续成功。
    - `tmt_twincome` 仍返回 `item` 必填错误并走 optional 降级，不阻断主 run。
  - 清理：
    - 删除测试运行记录：`delete from ingest_runs where json_extract(meta_json,'$.source')='manual-soak3'`（删除 6 条，剩余 0 条）
    - 删除临时目录：`/private/tmp/mytrader-wave-soak3-1771644652`
    - 验证：`select count(*) from ingest_runs where status='running';` 返回 `0`
- 2026-02-21：连续交易日门禁 Day-1 快照（Phase R2 gate tracking）-> ⚠️进行中
  - 统计边界（稳定修复后基线 run）：
    - 基线 run：`0eb63ce9-e877-4424-a622-2b2ebd11c829`（`started_at=1771635726285`）
    - 边界后 universe run：`3` 条
    - 边界后阻断 run：`0` 条
  - 当日运行态快照：
    - `status='running'` 计数：`0`
    - `rollout_flags_v1`：`universeIndexDailyEnabled=true`、`universeDailyBasicEnabled=false`、`universeMoneyflowEnabled=false`
    - cursor：`index=160`、`daily_basic=120`、`moneyflow=120`（`tradeDate=2023-02-14`）
  - 质量快照：
    - `daily_prices`：`total_rows=128813`、`null_rows=0`、`null_pct=0.0`
    - `daily_prices` 主键冲突：`0`
    - `macro_module_snapshot` future-leak：`0`
  - 编译回归：
    - `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend typecheck` -> ✅
    - `pnpm -C /Volumes/DataDisk/Project/My-Trader typecheck` -> ✅
  - 备注：
    - 近 7 天全量 `universe` 统计仍包含历史阻断 run（修复前样本），不用于 Day-1 之后的恢复门禁判定。
- 2026-02-21：连续门禁快照脚本落地与执行（标准化口径）-> ✅
  - 新增脚本：`apps/backend/scripts/phase-r2-gate-snapshot.mjs`
  - 命令：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend run phase-r2:gate-snapshot -- --baseline-run-id 0eb63ce9-e877-4424-a622-2b2ebd11c829 --target-clean-days 3`
  - 输出摘要：
    - `postBaseline.runs=3`
    - `postBaseline.blockingLikeRuns=0`
    - `runtime.runningCount=0`
    - `quality.nullPct=0`, `quality.pkConflicts=0`, `quality.macroFutureLeakCount=0`
    - `postBaseline.cleanDayProgress=1/3`（`reached=false`）
  - 时间边界：
    - 当前日期：`2026-02-21`（周六）
    - Day-2/Day-3 连续交易日门禁需等待后续交易日样本（最早 `2026-02-23`）。
- 2026-02-21：实网启动补跑复验（Day-1 intra-day）-> ✅
  - 执行：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend dev`（等待一次 startup run 完成后手动 `SIGINT` 退出）。
  - 运行观察（非阻断）：
    - `sge_basic` 每日限额报错仍出现（optional catalog）。
    - `tmt_twincome` `item` 必填报错仍出现（optional feed fallback）。
  - 新增 run：
    - `8605949b-0f52-41e3-b25d-6c79ce611428 | success | errors=0 | source=startup`
  - 补跑后门禁快照：
    - `postBaseline.runs=4`
    - `postBaseline.blockingLikeRuns=0`
    - `postBaseline.cleanDayProgress=1/3`
    - `runtime.runningCount=0`
    - `quality.nullPct=0`, `quality.pkConflicts=0`, `quality.macroFutureLeakCount=0`
    - `universe_index_daily_cursor_v1.symbolOffset=200`（较上一快照 `160` 继续推进）
- 2026-02-21：实网启动补跑加压（Day-1 stress x2）-> ✅
  - 执行：2 轮 `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend dev` 启停循环（每轮等待 startup 补跑完成后终止进程）。
  - 日志观察（非阻断）：
    - `sge_basic` 限额报错（optional catalog）持续出现。
    - `tmt_twincome` `item` 必填报错（optional feed fallback）持续出现。
  - 新增 run（均成功）：
    - `06a0bb36-f36b-42c3-8e33-5d63c4c8255c | success | errors=0 | source=startup`
    - `48ba180d-ba6c-4df3-a956-47fb4791d8dc | success | errors=0 | source=startup`
  - 加压后门禁快照：
    - `postBaseline.runs=6`
    - `postBaseline.blockingLikeRuns=0`
    - `postBaseline.cleanDayProgress=1/3`
    - `runtime.runningCount=0`
    - `quality.nullPct=0`, `quality.pkConflicts=0`, `quality.macroFutureLeakCount=0`
    - `universe_index_daily_cursor_v1.symbolOffset=280`（继续推进）
  - 产物清理：
    - 已删除 `/tmp/mytrader-startup-loop-1.log`、`/tmp/mytrader-startup-loop-2.log`
- 2026-02-21：实网启动补跑复验（Day-1 stress +1）-> ✅
  - 执行：1 轮 `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend dev` 启停循环（等待 startup 补跑完成后终止进程）。
  - 运行观察（非阻断）：
    - `sge_basic` 限额报错（optional catalog）持续出现。
    - `tmt_twincome` `item` 必填报错（optional feed fallback）持续出现。
  - 新增 run：
    - `dcdcbcf2-7d17-4694-b75d-9f2e99d77e12 | success | errors=0 | source=startup`
  - 复验后门禁快照：
    - `postBaseline.runs=7`
    - `postBaseline.blockingLikeRuns=0`
    - `postBaseline.cleanDayProgress=1/3`
    - `runtime.runningCount=0`
    - `quality.nullPct=0`, `quality.pkConflicts=0`, `quality.macroFutureLeakCount=0`
    - `universe_index_daily_cursor_v1.symbolOffset=320`（继续推进）
  - 产物清理：
    - 已删除 `/tmp/mytrader-startup-loop-3.log`
- 2026-02-21：实网启动补跑复验（Day-1 stress +1, round-4）-> ✅
  - 执行：1 轮 `pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend dev` 启停循环（等待 startup 补跑完成后终止进程）。
  - 运行观察（非阻断）：
    - `sge_basic` 限额报错（optional catalog）持续出现。
    - `tmt_twincome` `item` 必填报错（optional feed fallback）持续出现。
  - 新增 run：
    - `c0164b33-90a2-47ad-af62-b92982c88c5a | success | errors=0 | source=startup`
  - 复验后门禁快照：
    - `postBaseline.runs=8`
    - `postBaseline.blockingLikeRuns=0`
    - `postBaseline.cleanDayProgress=1/3`
    - `runtime.runningCount=0`
    - `quality.nullPct=0`, `quality.pkConflicts=0`, `quality.macroFutureLeakCount=0`
    - `universe_index_daily_cursor_v1.symbolOffset=360`（继续推进）
  - 产物清理：
    - 已删除 `/tmp/mytrader-startup-loop-4.log`
- 2026-02-21：历史交易日回放门禁（accelerated）-> ✅
  - 执行方式：
    - 编译临时运行包：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend exec tsc -p tsconfig.json --noEmit false --outDir /private/tmp/mytrader-historical-gate-1771652824`
    - 执行回放脚本：`pnpm -C /Volumes/DataDisk/Project/My-Trader/apps/backend exec electron /private/tmp/mytrader-historical-gate-1771652824/run_historical_gate_replay.js`
  - 回放目标日：
    - `2026-02-11`
    - `2026-02-12`
    - `2026-02-13`
  - 回放结果：
    - `4e92cf30-159b-46b9-81e0-02dcb9b55db7 | success | errors=0 | as_of_trade_date=2026-02-11 | source=historical-gate-replay`
    - `7f45b91c-aba9-48cf-b03c-021baea3b11c | success | errors=0 | as_of_trade_date=2026-02-12 | source=historical-gate-replay`
    - `7a7456b4-11c9-46d9-b416-c14f52ecb86c | success | errors=0 | as_of_trade_date=2026-02-13 | source=historical-gate-replay`
  - 快照结论：
    - `postBaseline.cleanDayProgress=1/3`（自然日口径，仍需后续交易日累计）
    - `postBaseline.cleanAsOfTradeDateProgress=3/3`（历史回放口径，`reached=true`）
    - `runningCount=0`，质量口径保持 `nullPct=0 / pkConflicts=0 / macroFutureLeakCount=0`
  - 口径说明：
    - 本回放用于加速验证“按交易日 as_of 维度”的稳定性，不替代“自然交易日连续 3 天”生产观察口径。
