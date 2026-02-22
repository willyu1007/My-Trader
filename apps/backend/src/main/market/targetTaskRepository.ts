import crypto from "node:crypto";

import type {
  AssetClass,
  ListTargetTaskStatusInput,
  ListTargetTaskStatusResult,
  MarketTargetTaskStatusRow,
  PreviewTargetTaskCoverageResult,
  TargetTaskModuleId,
  TargetTaskStatus
} from "@mytrader/shared";

import { all, get, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

type PersistedTargetTaskStatusRow = {
  symbol: string;
  module_id: TargetTaskModuleId;
  asset_class: string | null;
  as_of_trade_date: string | null;
  status: TargetTaskStatus;
  coverage_ratio: number | null;
  source_run_id: string | null;
  last_error: string | null;
  updated_at: number;
};

export type UpsertTargetTaskStatusInput = {
  symbol: string;
  moduleId: TargetTaskModuleId;
  assetClass: AssetClass | null;
  asOfTradeDate: string | null;
  status: TargetTaskStatus;
  coverageRatio?: number | null;
  sourceRunId?: string | null;
  lastError?: string | null;
};

export async function upsertTargetTaskStatuses(
  db: SqliteDatabase,
  rows: UpsertTargetTaskStatusInput[]
): Promise<void> {
  if (rows.length === 0) return;
  const now = Date.now();
  await transaction(db, async () => {
    for (const row of rows) {
      const symbol = row.symbol.trim();
      if (!symbol) continue;
      await run(
        db,
        `
          insert into target_task_status (
            symbol, module_id, asset_class, as_of_trade_date, status,
            coverage_ratio, source_run_id, last_error, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(symbol, module_id) do update set
            asset_class = excluded.asset_class,
            as_of_trade_date = excluded.as_of_trade_date,
            status = excluded.status,
            coverage_ratio = excluded.coverage_ratio,
            source_run_id = excluded.source_run_id,
            last_error = excluded.last_error,
            updated_at = excluded.updated_at
        `,
        [
          symbol,
          row.moduleId,
          row.assetClass,
          row.asOfTradeDate,
          row.status,
          normalizeCoverageRatio(row.coverageRatio),
          row.sourceRunId ?? null,
          row.lastError ?? null,
          now
        ]
      );
    }
  });
}

export async function listTargetTaskStatusRows(
  db: SqliteDatabase,
  input?: ListTargetTaskStatusInput
): Promise<ListTargetTaskStatusResult> {
  const where: string[] = [];
  const params: Array<string | number> = [];
  const symbol = input?.symbol?.trim() ?? "";
  if (symbol) {
    where.push("symbol = ?");
    params.push(symbol);
  }
  const moduleId = input?.moduleId ?? null;
  if (moduleId) {
    where.push("module_id = ?");
    params.push(moduleId);
  }
  const status = input?.status ?? null;
  if (status) {
    where.push("status = ?");
    params.push(status);
  }

  const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";
  const limit = Math.max(1, Math.min(1000, Math.floor(input?.limit ?? 200)));
  const offset = Math.max(0, Math.floor(input?.offset ?? 0));

  const rows = await all<PersistedTargetTaskStatusRow>(
    db,
    `
      select symbol, module_id, asset_class, as_of_trade_date, status,
             coverage_ratio, source_run_id, last_error, updated_at
      from target_task_status
      ${whereSql}
      order by updated_at desc, symbol asc
      limit ?
      offset ?
    `,
    [...params, limit, offset]
  );

  const totalRow = await get<{ total: number }>(
    db,
    `
      select count(*) as total
      from target_task_status
      ${whereSql}
    `,
    params
  );

  return {
    items: rows.map(toTargetTaskStatusRow),
    total: Number(totalRow?.total ?? 0),
    limit,
    offset
  };
}

export async function previewTargetTaskCoverage(
  db: SqliteDatabase
): Promise<PreviewTargetTaskCoverageResult> {
  const rows = await all<PersistedTargetTaskStatusRow>(
    db,
    `
      select symbol, module_id, asset_class, as_of_trade_date, status,
             coverage_ratio, source_run_id, last_error, updated_at
      from target_task_status
      order by updated_at desc
    `
  );
  const symbols = new Set<string>();
  const modules = new Set<TargetTaskModuleId>();
  const byAssetClass = new Map<
    string,
    { complete: number; partial: number; missing: number; notApplicable: number }
  >();
  let complete = 0;
  let partial = 0;
  let missing = 0;
  let notApplicable = 0;
  let asOfTradeDate: string | null = null;

  rows.forEach((row) => {
    symbols.add(row.symbol);
    modules.add(row.module_id);
    if (!asOfTradeDate && row.as_of_trade_date) {
      asOfTradeDate = row.as_of_trade_date;
    }
    switch (row.status) {
      case "complete":
        complete += 1;
        break;
      case "partial":
        partial += 1;
        break;
      case "missing":
        missing += 1;
        break;
      case "not_applicable":
        notApplicable += 1;
        break;
      default:
        break;
    }
    const key = row.asset_class?.trim() || "unknown";
    const group = byAssetClass.get(key) ?? {
      complete: 0,
      partial: 0,
      missing: 0,
      notApplicable: 0
    };
    if (row.status === "complete") group.complete += 1;
    if (row.status === "partial") group.partial += 1;
    if (row.status === "missing") group.missing += 1;
    if (row.status === "not_applicable") group.notApplicable += 1;
    byAssetClass.set(key, group);
  });

  return {
    asOfTradeDate,
    totals: {
      symbols: symbols.size,
      modules: modules.size,
      complete,
      partial,
      missing,
      notApplicable
    },
    byAssetClass: Array.from(byAssetClass.entries()).map(([assetClass, value]) => ({
      assetClass: assetClass as AssetClass | "unknown",
      complete: value.complete,
      partial: value.partial,
      missing: value.missing,
      notApplicable: value.notApplicable
    }))
  };
}

export async function createTargetMaterializationRun(
  db: SqliteDatabase
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await run(
    db,
    `
      insert into target_materialization_runs (
        id, as_of_trade_date, status, symbol_count, complete_count, partial_count,
        missing_count, not_applicable_count, source_run_id, error_message,
        started_at, finished_at
      )
      values (?, null, 'running', 0, 0, 0, 0, 0, null, null, ?, null)
    `,
    [id, now]
  );
  return id;
}

export async function finishTargetMaterializationRun(
  db: SqliteDatabase,
  input: {
    id: string;
    status: "success" | "partial" | "failed";
    asOfTradeDate: string | null;
    symbolCount: number;
    completeCount: number;
    partialCount: number;
    missingCount: number;
    notApplicableCount: number;
    sourceRunId?: string | null;
    errorMessage?: string | null;
  }
): Promise<void> {
  await run(
    db,
    `
      update target_materialization_runs
      set as_of_trade_date = ?,
          status = ?,
          symbol_count = ?,
          complete_count = ?,
          partial_count = ?,
          missing_count = ?,
          not_applicable_count = ?,
          source_run_id = ?,
          error_message = ?,
          finished_at = ?
      where id = ?
    `,
    [
      input.asOfTradeDate,
      input.status,
      input.symbolCount,
      input.completeCount,
      input.partialCount,
      input.missingCount,
      input.notApplicableCount,
      input.sourceRunId ?? null,
      input.errorMessage ?? null,
      Date.now(),
      input.id
    ]
  );
}

function normalizeCoverageRatio(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toTargetTaskStatusRow(row: PersistedTargetTaskStatusRow): MarketTargetTaskStatusRow {
  return {
    symbol: row.symbol,
    moduleId: row.module_id,
    assetClass: (row.asset_class as AssetClass | null) ?? null,
    asOfTradeDate: row.as_of_trade_date ?? null,
    status: row.status,
    coverageRatio: row.coverage_ratio ?? null,
    sourceRunId: row.source_run_id ?? null,
    lastError: row.last_error ?? null,
    updatedAt: row.updated_at
  };
}

