import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const failures = [];

function readText(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    failures.push(`missing file: ${relPath}`);
    return null;
  }
  return fs.readFileSync(absPath, "utf8");
}

function assertContains(relPath, expected, label) {
  const text = readText(relPath);
  if (text === null) return;
  const ok =
    typeof expected === "string" ? text.includes(expected) : expected.test(text);
  if (!ok) {
    failures.push(`missing ${label}: ${relPath}`);
  }
}

function assertNotContains(relPath, unexpected, label) {
  const text = readText(relPath);
  if (text === null) return;
  const has =
    typeof unexpected === "string"
      ? text.includes(unexpected)
      : unexpected.test(text);
  if (has) {
    failures.push(`unexpected ${label}: ${relPath}`);
  }
}

function assertExists(relPath, label) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    failures.push(`missing ${label}: ${relPath}`);
  }
}

// 1) Must keep main DuckDB runtime baseline.
assertContains(
  "apps/backend/package.json",
  '"@duckdb/duckdb-wasm"',
  "duckdb-wasm dependency"
);
assertNotContains(
  "apps/backend/package.json",
  '"@duckdb/node-api"',
  "duckdb node-api dependency"
);

// 2) Keep zero-byte placeholder cleanup for duckdb-wasm path safety.
assertContains(
  "apps/backend/src/main/storage/paths.ts",
  "duckdb-wasm expects a valid DuckDB file",
  "duckdb-wasm path guard comment"
);
assertContains(
  "apps/backend/src/main/storage/paths.ts",
  "stat.size === 0",
  "zero-byte analysis.duckdb guard"
);
assertContains(
  "apps/backend/src/main/storage/paths.ts",
  "fs.promises.unlink(analysisDbPath)",
  "analysis.duckdb placeholder cleanup"
);

// 3) Keep stale running-run convergence in orchestrator.
assertContains(
  "apps/backend/src/main/market/ingestOrchestrator.ts",
  "converged stale running ingest runs",
  "stale running convergence log"
);

// 4) Keep rollout compatibility chain (shared + preload + ipc + repository).
assertContains(
  "packages/shared/src/ipc.ts",
  "MARKET_ROLLOUT_FLAGS_GET",
  "shared rollout get channel"
);
assertContains(
  "packages/shared/src/ipc.ts",
  "MARKET_ROLLOUT_FLAGS_SET",
  "shared rollout set channel"
);
assertContains(
  "apps/backend/src/preload/index.ts",
  "getRolloutFlags",
  "preload rollout getter"
);
assertContains(
  "apps/backend/src/preload/index.ts",
  "setRolloutFlags",
  "preload rollout setter"
);
assertContains(
  "apps/backend/src/main/ipc/registerIpcHandlers.ts",
  "MARKET_ROLLOUT_FLAGS_GET",
  "ipc rollout get handler"
);
assertContains(
  "apps/backend/src/main/ipc/registerIpcHandlers.ts",
  "MARKET_ROLLOUT_FLAGS_SET",
  "ipc rollout set handler"
);
assertContains(
  "apps/backend/src/main/storage/marketSettingsRepository.ts",
  "const ROLLOUT_FLAGS_KEY = \"rollout_flags_v1\"",
  "rollout flags key"
);
assertContains(
  "apps/backend/src/main/storage/marketSettingsRepository.ts",
  "export async function getMarketRolloutFlags",
  "rollout flags getter"
);
assertContains(
  "apps/backend/src/main/storage/marketSettingsRepository.ts",
  "export async function setMarketRolloutFlags",
  "rollout flags setter"
);
assertContains(
  "apps/backend/src/main/storage/marketSettingsRepository.ts",
  "export async function convergeMarketRolloutFlagsToDefaultOpen",
  "rollout flags convergence helper"
);

// 5) Keep phase gate snapshot script from main.
assertExists(
  "apps/backend/scripts/phase-r2-gate-snapshot.mjs",
  "phase-r2 gate snapshot script"
);

// 6) Keep provider kinds expanded on main (index + forex).
assertContains(
  "apps/backend/src/main/market/providers/types.ts",
  '"index"',
  "provider kind index"
);
assertContains(
  "apps/backend/src/main/market/providers/types.ts",
  '"forex"',
  "provider kind forex"
);

// 7) Keep market-cache macro/fx schema baseline from main.
assertContains(
  "apps/backend/src/main/market/marketCache.ts",
  "create table if not exists fx_pair_meta",
  "fx pair meta table"
);
assertContains(
  "apps/backend/src/main/market/marketCache.ts",
  "create table if not exists macro_series_meta",
  "macro series meta table"
);
assertContains(
  "apps/backend/src/main/market/marketCache.ts",
  "create table if not exists macro_observations_latest",
  "macro observations latest table"
);
assertContains(
  "apps/backend/src/main/market/marketCache.ts",
  "create table if not exists macro_module_snapshot",
  "macro module snapshot table"
);

// 8) Dashboard must be modularized (single-path, non dual-track).
assertContains(
  "apps/frontend/src/components/Dashboard.tsx",
  'export { Dashboard } from "./dashboard/index";',
  "dashboard modular entry export"
);
assertExists(
  "apps/frontend/src/components/dashboard/index.ts",
  "dashboard modular index"
);
assertExists(
  "apps/frontend/src/components/dashboard/DashboardContainer.tsx",
  "dashboard modular container"
);
assertExists(
  "apps/frontend/src/components/dashboard/views/OtherView.tsx",
  "dashboard modular Other view"
);

// 9) Keep analysis DB forwarding + target materialization manual path.
assertContains(
  "apps/backend/src/main/market/ingestOrchestrator.ts",
  "analysisDbPath: state.analysisDbPath",
  "orchestrator forwards analysisDbPath to universe ingest"
);
assertContains(
  "apps/backend/src/main/ipc/registerIpcHandlers.ts",
  /materializeTargetsFromSsot|runCompletenessMaterialization/,
  "target materialization ipc integration"
);
assertContains(
  "apps/backend/src/main/ipc/registerIpcHandlers.ts",
  "MARKET_TARGET_TASK_RUN_MATERIALIZATION",
  "target materialization run channel"
);
assertContains(
  "apps/backend/src/main/market/marketCache.ts",
  "create table if not exists target_task_status",
  "target task status schema"
);
assertContains(
  "apps/backend/src/main/market/marketCache.ts",
  "create table if not exists target_materialization_runs",
  "target materialization run schema"
);

// 10) Keep rollout-closure baseline for full-pool ingest semantics.
assertNotContains(
  "apps/backend/src/main/market/providers/tushareProvider.ts",
  'assetClass: "futures"',
  "provider futures target-asset mapping"
);
assertNotContains(
  "apps/backend/src/main/market/providers/tushareProvider.ts",
  'assetClass: "spot"',
  "provider spot target-asset mapping"
);
assertContains(
  "apps/backend/src/main/storage/marketDataSourceRepository.ts",
  '["cn_a", "etf", "metal_futures", "metal_spot"]',
  "legacy full-pool fallback config"
);
assertNotContains(
  "apps/backend/src/main/market/marketIngestRunner.ts",
  "selectedBuckets",
  "universe ingest selected bucket filter flow"
);
assertNotContains(
  "apps/backend/src/main/market/marketIngestRunner.ts",
  "updateMarketUniversePoolBucketStates",
  "universe pool run-state writeback flow"
);

if (failures.length > 0) {
  console.error("[verify-pr1-guardrails] failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[verify-pr1-guardrails] OK");
