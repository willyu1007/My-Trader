# 04 Verification

## Automated checks
- Baseline checks (每批次必跑):
  - `pnpm -C packages/shared build`
  - `pnpm -C apps/backend typecheck`
  - `pnpm -C apps/frontend typecheck`
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
