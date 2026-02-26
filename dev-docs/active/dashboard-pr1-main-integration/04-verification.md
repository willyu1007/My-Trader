# 04 Verification

## Automated checks
- Baseline checks (每批次必跑):
  - `pnpm -C packages/shared build`
  - `pnpm -C apps/backend typecheck`
  - `pnpm -C apps/frontend typecheck`
  - `pnpm -C apps/backend run verify:completeness-v2`
  - `pnpm typecheck`
  - `pnpm build`

- Guard checks (每批次必跑):
  - `rg -n "@duckdb/duckdb-wasm" apps/backend/package.json`
  - `rg -n "MARKET_ROLLOUT_FLAGS_GET|MARKET_ROLLOUT_FLAGS_SET" packages/shared/src/ipc.ts apps/backend/src/preload/index.ts apps/backend/src/main/ipc/registerIpcHandlers.ts`
  - `rg -n "converged stale running ingest runs" apps/backend/src/main/market/ingestOrchestrator.ts`
  - `rg -n "\"index\"|\"forex\"" apps/backend/src/main/market/providers/types.ts`

- Optional gate snapshot (建议在 dual-pool 合入后每轮执行):
  - `pnpm -C apps/backend run phase-r2:gate-snapshot -- --baseline-run-id <BASELINE_RUN_ID> --target-clean-days 3`

## Manual smoke checks
- Ingest control path:
  - manual / schedule / startup / pause / resume / cancel
- Token readiness path:
  - 无 token、无权限 token、有效 token
- Source Center V2:
  - 主 token + 域 token 设置
  - 连通性测试
  - readiness 阻断与错误提示
- Dashboard:
  - 导航、Portfolio、Analysis、Market、Other、Lock

## Rollout / Backout (if applicable)
- Rollout:
  - 每批次独立 PR + 独立验收；Dashboard 切换后观察 1 个交易日。
- Backout:
  - 以 PR 为单位 revert（Dashboard 切换批次使用快速回退 PR）。

## Runs (recorded)
- 2026-02-22: `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-22: `pnpm typecheck` -> ✅ pass
- 2026-02-22: `pnpm build` -> ✅ pass
- 2026-02-22 (after Phase 1 shared/preload additive changes): `pnpm typecheck` -> ✅ pass
- 2026-02-22 (after Phase 1 shared/preload additive changes): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-22 (after Phase 1 shared/preload additive changes): `pnpm build` -> ✅ pass
- 2026-02-22 (after Phase 2 backend Source Center wiring): `pnpm typecheck` -> ✅ pass
- 2026-02-22 (after Phase 2 backend Source Center wiring): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-22 (after Phase 2 backend Source Center wiring): `pnpm build` -> ✅ pass
- 2026-02-22 (after Phase 2 backend Source Center wiring): `rg -n \"MARKET_DATA_SOURCE_GET_CATALOG|MARKET_TOKEN_GET_MATRIX_STATUS|MARKET_TEST_DOMAIN_CONNECTIVITY|MARKET_INGEST_PREFLIGHT_RUN|MARKET_VALIDATE_SOURCE_READINESS\" apps/backend/src/main/ipc/registerIpcHandlers.ts apps/backend/src/preload/index.ts packages/shared/src/ipc.ts` -> ✅ pass
- 2026-02-22 (Phase 3 low-risk step): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-22 (Phase 3 low-risk step): `pnpm typecheck` -> ❌ fail（`AssetClass` 扩展后前端映射缺 key）
- 2026-02-22 (Phase 3 low-risk step fix): `pnpm typecheck` -> ✅ pass
- 2026-02-22 (Phase 3 low-risk step fix): `pnpm build` -> ✅ pass
- 2026-02-22 (Phase 3 runner/provider merge): `pnpm typecheck` -> ✅ pass
- 2026-02-22 (Phase 3 runner/provider merge): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-22 (Phase 3 runner/provider merge): `pnpm build` -> ✅ pass
- 2026-02-22 (Phase 3 orchestrator/materialization merge): `pnpm typecheck` -> ✅ pass
- 2026-02-22 (Phase 3 orchestrator/materialization merge): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-22 (Phase 3 orchestrator/materialization merge): `pnpm build` -> ✅ pass
- 2026-02-22 (Phase 5 dashboard modular switch): `pnpm typecheck` -> ✅ pass
- 2026-02-22 (Phase 5 dashboard modular switch): `pnpm build` -> ✅ pass
- 2026-02-22 (Phase 5 dashboard modular switch): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-22 (Phase 6 same-day closure gates): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-22 (Phase 6 same-day closure gates): `pnpm typecheck` -> ✅ pass
- 2026-02-22 (Phase 6 same-day closure gates): `pnpm build` -> ✅ pass
- 2026-02-22 (Phase 6 same-day closure gates): `pnpm -C apps/backend run verify:position-engine` -> ✅ pass（100 runs）
- 2026-02-22 (Historical closure evidence): `node apps/backend/scripts/phase-r2-gate-snapshot.mjs` -> ✅ pass
- 2026-02-22 (Historical closure evidence key metrics):
  - `runtime.runningCount = 0`
  - `quality.nullPct = 0`
  - `quality.pkConflicts = 0`
  - `quality.macroFutureLeakCount = 0`
  - `postBaseline.cleanAsOfTradeDateProgress.reached = true`（3/3）
  - 原始证据: `dev-docs/active/dashboard-pr1-main-integration/evidence/2026-02-22-history-gate-snapshot.json`
- 2026-02-22 (Reopen: closure-baseline recovery): `pnpm -C apps/backend exec tsc -p tsconfig.json --noEmit` -> ❌ fail（targetsService 收窄类型返回不匹配）
- 2026-02-22 (Reopen: closure-baseline recovery fix): `pnpm -C apps/backend exec tsc -p tsconfig.json --noEmit` -> ✅ pass
- 2026-02-22 (Reopen: closure-baseline recovery): `pnpm typecheck` -> ✅ pass
- 2026-02-22 (Runtime data normalization): `sqlite3 market-cache.sqlite "update instruments set asset_class = null where asset_class in ('futures','spot')"` -> ✅ pass
- 2026-02-22 (Runtime data normalization checks):
  - `SELECT COUNT(*) FROM instruments WHERE auto_ingest=1 AND asset_class IN ('stock','etf');` -> `5491`
  - `SELECT COUNT(*) FROM instruments WHERE auto_ingest=1 AND (asset_class='futures' OR asset_class='spot');` -> `0`
- 2026-02-22 (Stability hardening): `pnpm typecheck` -> ✅ pass（含 TuShare 请求超时补丁）
- 2026-02-22 (Target pool editor scope restore):
  - `SELECT COUNT(*) FROM instruments WHERE auto_ingest=1;` -> `24217`（编辑口径，2万+）
  - `SELECT COUNT(*) FROM instruments WHERE auto_ingest=1 AND asset_class IN ('stock','etf');` -> `5491`（执行抓取口径）
  - `targets_config_v1.includeRegistryAutoIngest` -> `true`
- 2026-02-22 (Target pool stats fallback fix): `pnpm -C apps/frontend exec tsc -p tsconfig.json --noEmit` -> ✅ pass
- 2026-02-22 (Target pool stats fallback fix): `pnpm typecheck` -> ✅ pass
- 2026-02-22 (Follow-up: closure guardrail realignment + schema fix): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-22 (Follow-up: closure guardrail realignment + schema fix): `pnpm typecheck` -> ✅ pass
- 2026-02-23 (Follow-up: SW L2 + concept chain): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up: SW L2 + concept chain): `pnpm exec tsc --noEmit -p apps/backend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up: SW L2 + concept chain + UI default collapse): `pnpm typecheck` -> ✅ pass
- 2026-02-23 (Follow-up: bulk fetch timeout hardening): `pnpm exec tsc --noEmit -p apps/backend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up: bulk fetch timeout hardening): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #2: L1-L2 relation fallback + THS concept fallback): `pnpm exec tsc --noEmit -p apps/backend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #2: L1-L2 relation fallback + THS concept fallback): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #2: L1-L2 relation fallback + THS concept fallback): `pnpm typecheck` -> ✅ pass
- 2026-02-23 (Runtime diagnosis snapshot before re-sync):
  - `count(distinct ind:sw:l2:*) = 124`
  - `count(distinct ind:sw:l1:*) = 0`
  - `count(distinct concept:*) = 0`
- 2026-02-23 (Follow-up #3: full-pool UI de-dup): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #3: full-pool UI de-dup): `pnpm exec tsc --noEmit -p apps/backend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #3: full-pool UI de-dup): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #4: target completeness UX convergence): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #4: target completeness UX convergence): `pnpm exec tsc --noEmit -p apps/backend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #4: target completeness UX convergence): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #5: status board V1 emphasis redesign): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #5: status board V1 emphasis redesign): `pnpm exec tsc --noEmit -p apps/backend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #5: status board V1 emphasis redesign): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #6: status board V1.1 style/layout convergence): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #6: status board V1.1 style/layout convergence): `pnpm exec tsc --noEmit -p apps/backend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #6: status board V1.1 style/layout convergence): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #7: status board V1.2 matrix + status-line refinement): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #7: status board V1.2 matrix + status-line refinement): `pnpm exec tsc --noEmit -p apps/backend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #7: status board V1.2 matrix + status-line refinement): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #8: remove duplicate KPI cards, keep matrix-only): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #8: remove duplicate KPI cards, keep matrix-only): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #9: top status strip single-line + borderless): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #9: top status strip single-line + borderless): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #10: top status metrics right-aligned): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #10: top status metrics right-aligned): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #11: matrix v1.3 de-card + five-band health strip): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #11: matrix v1.3 de-card + five-band health strip): `pnpm exec tsc --noEmit -p apps/backend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #11: matrix v1.3 de-card + five-band health strip): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #12: matrix minimal labels + narrower columns): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #12: matrix minimal labels + narrower columns): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Follow-up #13: divider + complete-rate color + fixed asset column order): `pnpm exec tsc --noEmit -p apps/frontend/tsconfig.json` -> ✅ pass
- 2026-02-23 (Follow-up #13: divider + complete-rate color + fixed asset column order): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Completeness v2: backend verify script): `pnpm -C apps/backend run verify:completeness-v2` -> ✅ pass
- 2026-02-23 (Completeness v2: guardrails compatibility): `pnpm verify:pr1-guardrails` -> ✅ pass
- 2026-02-23 (Completeness v2: workspace typecheck): `pnpm typecheck` -> ✅ pass
- 2026-02-23 (Completeness v2: workspace build): `pnpm build` -> ✅ pass

## Completeness V2 Reconciliation SQL
- Migration backfill idempotency:
```sql
select value
from market_meta
where key = 'completeness_v2_backfill_v1';

select count(*) as status_rows
from completeness_status_v2
where scope_id = 'target_pool';

select count(*) as run_rows
from completeness_runs_v2
where scope_id = 'target_pool';
```
- Legacy compatibility cross-check:
```sql
select count(*) as legacy_rows
from target_task_status
where module_id = 'core.daily_prices';

select count(*) as v2_rows
from completeness_status_v2
where scope_id = 'target_pool'
  and check_id = 'target.core.daily_prices';
```
- Source pool `not_started` smoke:
```sql
select check_id, status, count(*) as rows
from completeness_status_v2
where scope_id = 'source_pool'
  and check_id in ('source.index.daily', 'source.fx.daily', 'source.macro.snapshot')
group by check_id, status
order by check_id, status;
```

## Completeness V2 Key Results
- `verify:completeness-v2` 覆盖三类断言并全部通过：
  - backfill 幂等（重复 `ensureMarketCacheSchema` 不重复迁移）。
  - legacy `target-task` API 与 completeness adapter 在 stock/etf 样本一致。
  - `source_pool` 在 index/fx/macro 启用但无数据时返回 `not_started/not_applicable`。
- guardrails 已兼容 target materialization adapter 路径（`runCompletenessMaterialization`）。

## 2026-02-24 Performance/Stability Closure Runs
- Build/typecheck gates:
  - `pnpm -C apps/backend run typecheck` -> ✅ pass
  - `pnpm -C apps/backend run build` -> ✅ pass
  - `pnpm -C apps/frontend run typecheck` -> ✅ pass
  - `pnpm -C apps/frontend run build` -> ✅ pass
- Task-package gates:
  - `pnpm verify:pr1-guardrails` -> ✅ pass
  - `pnpm -C apps/backend run verify:completeness-v2` -> ✅ pass
  - `pnpm typecheck` -> ✅ pass
  - `pnpm build` -> ✅ pass
- Static assertion checks (关键策略落点)：
  - `DEFAULT_INGEST_SCHEDULER_CONFIG.runOnStartup=false` / `catchUpMissed=false` -> ✅
  - `autoIngest` 无 startup `runOnce` -> ✅
  - `app.before-quit` 存在统一 shutdown 流程 -> ✅
  - `DashboardContainerLayout` 仅 `other/data-management` 使用 `scroll-auto` -> ✅
  - 数据状态轮询 `15s` + `document.hidden` pause -> ✅
  - market-cache 自愈 rotate + 重建 + notice -> ✅

## 2026-02-24 Manual Smoke Checklist Update
- 已在代码层完成以下闭环点：
  - 启动路径避免默认自动拉取；
  - 数据管理页禁止进入即批量重查；
  - 退出路径统一 stop/close；
  - 缓存损坏时自动备份重建。
- 需在带 GUI 的本机会话执行并记录（CLI 环境不可量化渲染帧率）：
  - 冷启动可操作时间（目标 < 3s）。
  - `other/data-management` 与 `data-status` 往返切换 10 次的主线程峰值卡顿。
  - 完备性面板连续滚轮 20s 掉帧观察。
  - 退出耗时（目标 < 2s）与无挂起进程。

## 2026-02-25 Status Detail Search (P0) Runs
- `pnpm -C packages/shared run typecheck` -> ✅ pass
- `pnpm -C apps/backend run typecheck` -> ✅ pass
- `pnpm -C apps/frontend run typecheck` -> ✅ pass
- `pnpm -C apps/backend run build` -> ✅ pass
- `pnpm -C apps/frontend run build` -> ✅ pass
- `pnpm -C apps/backend run verify:completeness-v2` -> ✅ pass

## 2026-02-25 Scroll Performance Follow-up Runs
- `pnpm -C apps/frontend run typecheck` -> ✅ pass
- `pnpm -C apps/frontend run build` -> ✅ pass

## 2026-02-25 Global Tooltip Scroll Suppression Runs
- `pnpm -C apps/frontend run typecheck` -> ✅ pass
- `pnpm -C apps/frontend run build` -> ✅ pass
