import crypto from "node:crypto";

import { all, get, run } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

export type IngestRunScope = "targets" | "universe";
export type IngestRunMode = "daily" | "bootstrap" | "manual" | "on_demand";
export type IngestRunStatus = "running" | "success" | "partial" | "failed" | "canceled";

export interface CreateIngestRunInput {
  scope: IngestRunScope;
  mode: IngestRunMode;
  status?: IngestRunStatus;
  asOfTradeDate?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface IngestRunRow {
  id: string;
  scope: IngestRunScope;
  mode: IngestRunMode;
  status: IngestRunStatus;
  as_of_trade_date: string | null;
  started_at: number;
  finished_at: number | null;
  symbol_count: number | null;
  inserted: number | null;
  updated: number | null;
  errors: number | null;
  error_message: string | null;
  meta_json: string | null;
}

export async function createIngestRun(
  db: SqliteDatabase,
  input: CreateIngestRunInput
): Promise<string> {
  const id = crypto.randomUUID();
  const startedAt = Date.now();
  const status = input.status ?? "running";
  const metaJson = input.meta ? JSON.stringify(input.meta) : null;
  await run(
    db,
    `
      insert into ingest_runs (
        id, scope, mode, status, as_of_trade_date,
        started_at, finished_at, symbol_count, inserted, updated, errors,
        error_message, meta_json
      )
      values (?, ?, ?, ?, ?, ?, null, null, null, null, null, null, ?)
    `,
    [
      id,
      input.scope,
      input.mode,
      status,
      input.asOfTradeDate ?? null,
      startedAt,
      metaJson
    ]
  );
  return id;
}

export async function finishIngestRun(
  db: SqliteDatabase,
  input: {
    id: string;
    status: Exclude<IngestRunStatus, "running">;
    asOfTradeDate?: string | null;
    symbolCount?: number | null;
    inserted?: number | null;
    updated?: number | null;
    errors?: number | null;
    errorMessage?: string | null;
    meta?: Record<string, unknown> | null;
  }
): Promise<void> {
  const finishedAt = Date.now();
  const metaJson = input.meta ? JSON.stringify(input.meta) : null;
  await run(
    db,
    `
      update ingest_runs
      set status = ?,
          as_of_trade_date = coalesce(?, as_of_trade_date),
          finished_at = ?,
          symbol_count = ?,
          inserted = ?,
          updated = ?,
          errors = ?,
          error_message = ?,
          meta_json = coalesce(?, meta_json)
      where id = ?
    `,
    [
      input.status,
      input.asOfTradeDate ?? null,
      finishedAt,
      input.symbolCount ?? null,
      input.inserted ?? null,
      input.updated ?? null,
      input.errors ?? null,
      input.errorMessage ?? null,
      metaJson,
      input.id
    ]
  );
}

export async function listIngestRuns(
  db: SqliteDatabase,
  limit = 100
): Promise<IngestRunRow[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  return await all<IngestRunRow>(
    db,
    `
      select *
      from ingest_runs
      order by started_at desc
      limit ?
    `,
    [safeLimit]
  );
}

export async function getIngestRunById(
  db: SqliteDatabase,
  id: string
): Promise<IngestRunRow | null> {
  const row = await get<IngestRunRow>(
    db,
    `
      select *
      from ingest_runs
      where id = ?
      limit 1
    `,
    [id]
  );
  return row ?? null;
}

export async function removeIngestRunById(
  db: SqliteDatabase,
  id: string
): Promise<void> {
  const existing = await getIngestRunById(db, id);
  if (!existing) return;
  if (existing.status === "running") {
    throw new Error("运行中的拉取记录不可删除。");
  }
  await run(
    db,
    `
      delete from ingest_runs
      where id = ?
    `,
    [id]
  );
}

export async function clearIngestRunsHistory(db: SqliteDatabase): Promise<void> {
  await run(
    db,
    `
      delete from ingest_runs
      where status <> 'running'
    `
  );
}

export async function getLatestIngestRun(
  db: SqliteDatabase,
  scope: IngestRunScope
): Promise<IngestRunRow | null> {
  const row = await get<IngestRunRow>(
    db,
    `
      select *
      from ingest_runs
      where scope = ?
      order by started_at desc
      limit 1
    `,
    [scope]
  );
  return row ?? null;
}

export async function convergeStaleRunningIngestRuns(
  db: SqliteDatabase,
  input?: {
    olderThanMs?: number;
    reason?: string;
  }
): Promise<number> {
  const now = Date.now();
  const olderThanMs = Math.max(0, input?.olderThanMs ?? 0);
  const cutoff = now - olderThanMs;
  const reason =
    input?.reason?.trim() ||
    "Ingest run was left in running state after process restart.";

  const countRow = await get<{ cnt: number }>(
    db,
    `
      select count(*) as cnt
      from ingest_runs
      where status = 'running'
        and started_at <= ?
    `,
    [cutoff]
  );
  const count = Number(countRow?.cnt ?? 0);
  if (count <= 0) return 0;

  await run(
    db,
    `
      update ingest_runs
      set status = 'failed',
          finished_at = ?,
          errors = coalesce(errors, 1),
          error_message = coalesce(error_message, ?)
      where status = 'running'
        and started_at <= ?
    `,
    [now, reason, cutoff]
  );

  return count;
}
