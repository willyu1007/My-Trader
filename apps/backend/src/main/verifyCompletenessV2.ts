import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { MarketDataSourceConfigV2 } from "@mytrader/shared";

import { ensureMarketCacheSchema } from "./market/marketCache";
import {
  getCompletenessConfig,
  listCompletenessStatus,
  listTargetTaskStatusFromCompleteness,
  previewTargetTaskCoverageFromCompleteness,
  runCompletenessMaterialization
} from "./market/completeness/completenessService";
import {
  listTargetTaskStatusRows,
  previewTargetTaskCoverage,
  upsertTargetTaskStatuses
} from "./market/targetTaskRepository";
import {
  getMarketDataSourceConfig,
  setMarketDataSourceConfig
} from "./storage/marketDataSourceRepository";
import { ensureBusinessSchema } from "./storage/businessSchema";
import { exec, get, openSqliteDatabase, run, close } from "./storage/sqlite";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function buildTempPath(prefix: string): string {
  return path.join(
    os.tmpdir(),
    `mytrader-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
  );
}

async function testBackfillIdempotency(): Promise<void> {
  const marketDbPath = buildTempPath("completeness-v2-backfill");
  const marketDb = await openSqliteDatabase(marketDbPath);
  try {
    await exec(
      marketDb,
      `
        create table if not exists market_meta (
          key text primary key not null,
          value text not null
        );
      `
    );
    await exec(
      marketDb,
      `
        create table if not exists target_task_status (
          symbol text not null,
          module_id text not null,
          asset_class text,
          as_of_trade_date text,
          status text not null,
          coverage_ratio real,
          source_run_id text,
          last_error text,
          updated_at integer not null,
          primary key (symbol, module_id)
        );
      `
    );
    await exec(
      marketDb,
      `
        create table if not exists target_materialization_runs (
          id text primary key not null,
          as_of_trade_date text,
          status text not null,
          symbol_count integer not null,
          complete_count integer not null,
          partial_count integer not null,
          missing_count integer not null,
          not_applicable_count integer not null,
          source_run_id text,
          error_message text,
          started_at integer not null,
          finished_at integer
        );
      `
    );

    await run(
      marketDb,
      `
        insert into target_task_status (
          symbol,
          module_id,
          asset_class,
          as_of_trade_date,
          status,
          coverage_ratio,
          source_run_id,
          last_error,
          updated_at
        )
        values ('600519.SH', 'core.daily_prices', 'stock', '2026-02-20', 'complete', 1, 'run-legacy', null, ?)
      `,
      [Date.now()]
    );
    await run(
      marketDb,
      `
        insert into target_materialization_runs (
          id,
          as_of_trade_date,
          status,
          symbol_count,
          complete_count,
          partial_count,
          missing_count,
          not_applicable_count,
          source_run_id,
          error_message,
          started_at,
          finished_at
        )
        values (
          'legacy-materialization-1',
          '2026-02-20',
          'success',
          1,
          1,
          0,
          0,
          0,
          'run-legacy',
          null,
          ?,
          ?
        )
      `,
      [Date.now() - 1000, Date.now()]
    );

    await ensureMarketCacheSchema(marketDb);
    const firstStatusCount = Number(
      (
        await get<{ total: number }>(
          marketDb,
          `select count(*) as total from completeness_status_v2`
        )
      )?.total ?? 0
    );
    const firstRunCount = Number(
      (
        await get<{ total: number }>(
          marketDb,
          `select count(*) as total from completeness_runs_v2`
        )
      )?.total ?? 0
    );

    await ensureMarketCacheSchema(marketDb);
    const secondStatusCount = Number(
      (
        await get<{ total: number }>(
          marketDb,
          `select count(*) as total from completeness_status_v2`
        )
      )?.total ?? 0
    );
    const secondRunCount = Number(
      (
        await get<{ total: number }>(
          marketDb,
          `select count(*) as total from completeness_runs_v2`
        )
      )?.total ?? 0
    );
    const marker = await get<{ value: string }>(
      marketDb,
      `select value from market_meta where key = 'completeness_v2_backfill_v1'`
    );

    assert(firstStatusCount === 1, "expected one status row after first backfill");
    assert(firstRunCount === 1, "expected one run row after first backfill");
    assert(secondStatusCount === firstStatusCount, "status backfill must be idempotent");
    assert(secondRunCount === firstRunCount, "run backfill must be idempotent");
    assert(marker?.value === "1", "backfill marker must be written");
  } finally {
    await close(marketDb);
    if (fs.existsSync(marketDbPath)) fs.unlinkSync(marketDbPath);
  }
}

async function testCompatAndSourcePoolNotStarted(): Promise<void> {
  const businessDbPath = buildTempPath("completeness-v2-business");
  const marketDbPath = buildTempPath("completeness-v2-market");
  const analysisDbPath = path.join(
    os.tmpdir(),
    `mytrader-completeness-v2-analysis-${Date.now()}.duckdb`
  );

  const businessDb = await openSqliteDatabase(businessDbPath);
  const marketDb = await openSqliteDatabase(marketDbPath);

  try {
    await ensureBusinessSchema(businessDb);
    await ensureMarketCacheSchema(marketDb);

    const baseConfig = await getMarketDataSourceConfig(businessDb);
    const disabledFxConfig: MarketDataSourceConfigV2 = {
      ...baseConfig,
      domains: {
        ...baseConfig.domains,
        fx: {
          ...baseConfig.domains.fx,
          enabled: false,
          modules: {
            ...baseConfig.domains.fx.modules,
            "fx.daily": { enabled: false }
          }
        }
      }
    };
    await setMarketDataSourceConfig(businessDb, disabledFxConfig);
    const configWithoutFx = await getCompletenessConfig({ businessDb });
    const noFxIds = new Set(configWithoutFx.checks.map((item) => item.id));
    assert(!noFxIds.has("source.fx.daily"), "source fx check should be hidden when disabled");

    const nextConfig: MarketDataSourceConfigV2 = {
      ...disabledFxConfig,
      domains: {
        ...disabledFxConfig.domains,
        index: {
          ...disabledFxConfig.domains.index,
          enabled: true,
          modules: {
            ...disabledFxConfig.domains.index.modules,
            "index.daily": { enabled: true }
          }
        },
        fx: {
          ...disabledFxConfig.domains.fx,
          enabled: true,
          modules: {
            ...disabledFxConfig.domains.fx.modules,
            "fx.daily": { enabled: true }
          }
        },
        macro: {
          ...disabledFxConfig.domains.macro,
          enabled: true,
          modules: {
            ...disabledFxConfig.domains.macro.modules,
            "macro.snapshot": { enabled: true }
          }
        }
      }
    };
    await setMarketDataSourceConfig(businessDb, nextConfig);

    const completenessConfig = await getCompletenessConfig({ businessDb });
    const checkIds = new Set(completenessConfig.checks.map((item) => item.id));
    assert(checkIds.has("source.index.daily"), "source index check should be visible");
    assert(checkIds.has("source.fx.daily"), "source fx check should be visible");
    assert(checkIds.has("source.macro.snapshot"), "source macro check should be visible");

    await runCompletenessMaterialization({
      businessDb,
      marketDb,
      analysisDbPath,
      request: { scopeId: "source_pool" }
    });

    for (const checkId of [
      "source.index.daily",
      "source.fx.daily",
      "source.macro.snapshot"
    ]) {
      const rows = await listCompletenessStatus({
        marketDb,
        request: {
          scopeId: "source_pool",
          checkId,
          limit: 20,
          offset: 0
        }
      });
      assert(rows.total > 0, `expected source rows for ${checkId}`);
      const hasExpectedStatus = rows.items.every(
        (row) => row.status === "not_started" || row.status === "not_applicable"
      );
      assert(
        hasExpectedStatus,
        `source rows for ${checkId} must be not_started/not_applicable when no data exists`
      );
    }

    await upsertTargetTaskStatuses(marketDb, [
      {
        symbol: "600519.SH",
        moduleId: "core.daily_prices",
        assetClass: "stock",
        asOfTradeDate: "2026-02-20",
        status: "complete",
        coverageRatio: 1,
        sourceRunId: "compat-run",
        lastError: null
      },
      {
        symbol: "510300.SH",
        moduleId: "core.daily_prices",
        assetClass: "etf",
        asOfTradeDate: "2026-02-20",
        status: "partial",
        coverageRatio: 0.5,
        sourceRunId: "compat-run",
        lastError: null
      }
    ]);

    const legacyCoverage = await previewTargetTaskCoverage(marketDb);
    const compatCoverage = await previewTargetTaskCoverageFromCompleteness({ marketDb });
    assert(
      legacyCoverage.totals.symbols === compatCoverage.totals.symbols,
      "legacy and completeness symbol totals should match"
    );
    assert(
      legacyCoverage.totals.complete === compatCoverage.totals.complete,
      "legacy and completeness complete totals should match"
    );
    assert(
      legacyCoverage.totals.partial === compatCoverage.totals.partial,
      "legacy and completeness partial totals should match"
    );

    const legacyRows = await listTargetTaskStatusRows(marketDb, {
      moduleId: "core.daily_prices",
      limit: 100,
      offset: 0
    });
    const compatRows = await listTargetTaskStatusFromCompleteness({
      marketDb,
      request: {
        moduleId: "core.daily_prices",
        limit: 100,
        offset: 0
      }
    });

    const legacyFingerprints = legacyRows.items
      .map((row) => `${row.symbol}|${row.moduleId}|${row.status}|${row.coverageRatio ?? "null"}`)
      .sort();
    const compatFingerprints = compatRows.items
      .map((row) => `${row.symbol}|${row.moduleId}|${row.status}|${row.coverageRatio ?? "null"}`)
      .sort();

    assert(
      JSON.stringify(legacyFingerprints) === JSON.stringify(compatFingerprints),
      "legacy and completeness status rows should match for stock/etf sample"
    );
  } finally {
    await close(businessDb);
    await close(marketDb);
    if (fs.existsSync(businessDbPath)) fs.unlinkSync(businessDbPath);
    if (fs.existsSync(marketDbPath)) fs.unlinkSync(marketDbPath);
    if (fs.existsSync(analysisDbPath)) fs.unlinkSync(analysisDbPath);
  }
}

async function main(): Promise<void> {
  await testBackfillIdempotency();
  await testCompatAndSourcePoolNotStarted();
  console.log("[verify-completeness-v2] ok");
}

main().catch((error) => {
  console.error("[verify-completeness-v2] failed");
  console.error(error);
  process.exitCode = 1;
});
