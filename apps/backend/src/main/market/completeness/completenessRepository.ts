import crypto from "node:crypto";

import type {
  CompletenessBucketId,
  CompletenessScopeId,
  CompletenessStatus,
  ListCompletenessStatusInput,
  ListCompletenessStatusResult,
  MarketCompletenessStatusRow,
  PreviewCompletenessCoverageResult
} from "@mytrader/shared";

import { all, get, run, transaction } from "../../storage/sqlite";
import type { SqliteDatabase } from "../../storage/sqlite";
import { COMPLETENESS_BUCKET_ORDER } from "./checkRegistry";

type PersistedCompletenessRow = {
  scope_id: CompletenessScopeId;
  check_id: string;
  entity_type: MarketCompletenessStatusRow["entityType"];
  entity_id: string;
  bucket_id: CompletenessBucketId;
  domain_id: string | null;
  module_id: string | null;
  asset_class: string | null;
  as_of_trade_date: string | null;
  status: CompletenessStatus;
  coverage_ratio: number | null;
  source_run_id: string | null;
  detail_json: string | null;
  updated_at: number;
};

export interface UpsertCompletenessStatusInput {
  scopeId: CompletenessScopeId;
  checkId: string;
  entityType: MarketCompletenessStatusRow["entityType"];
  entityId: string;
  bucketId: CompletenessBucketId;
  domainId: string | null;
  moduleId: string | null;
  assetClass: MarketCompletenessStatusRow["assetClass"];
  asOfTradeDate: string | null;
  status: CompletenessStatus;
  coverageRatio: number | null;
  sourceRunId: string | null;
  detail: Record<string, unknown> | null;
}

export async function upsertCompletenessStatuses(
  db: SqliteDatabase,
  rows: UpsertCompletenessStatusInput[]
): Promise<void> {
  if (rows.length === 0) return;
  const now = Date.now();

  await transaction(db, async () => {
    for (const row of rows) {
      const entityId = row.entityId.trim();
      if (!entityId) continue;
      await run(
        db,
        `
          insert into completeness_status_v2 (
            scope_id,
            check_id,
            entity_type,
            entity_id,
            bucket_id,
            domain_id,
            module_id,
            asset_class,
            as_of_trade_date,
            status,
            coverage_ratio,
            source_run_id,
            detail_json,
            updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(scope_id, check_id, entity_type, entity_id) do update set
            bucket_id = excluded.bucket_id,
            domain_id = excluded.domain_id,
            module_id = excluded.module_id,
            asset_class = excluded.asset_class,
            as_of_trade_date = excluded.as_of_trade_date,
            status = excluded.status,
            coverage_ratio = excluded.coverage_ratio,
            source_run_id = excluded.source_run_id,
            detail_json = excluded.detail_json,
            updated_at = excluded.updated_at
        `,
        [
          row.scopeId,
          row.checkId,
          row.entityType,
          entityId,
          row.bucketId,
          row.domainId,
          row.moduleId,
          row.assetClass,
          row.asOfTradeDate,
          row.status,
          normalizeCoverageRatio(row.coverageRatio),
          row.sourceRunId,
          row.detail ? JSON.stringify(row.detail) : null,
          now
        ]
      );
    }
  });
}

export async function listCompletenessStatusRows(
  db: SqliteDatabase,
  input?: ListCompletenessStatusInput
): Promise<ListCompletenessStatusResult> {
  const where: string[] = [];
  const params: Array<string | number> = [];
  const keyword = input?.keyword?.trim() ?? "";
  const keywordFields = normalizeKeywordFields(input?.keywordFields);

  if (input?.scopeId) {
    where.push("scope_id = ?");
    params.push(input.scopeId);
  }
  if (input?.checkId?.trim()) {
    where.push("check_id = ?");
    params.push(input.checkId.trim());
  }
  if (input?.status) {
    where.push("status = ?");
    params.push(input.status);
  }
  if (input?.entityType) {
    where.push("entity_type = ?");
    params.push(input.entityType);
  }
  if (input?.bucketId) {
    where.push("bucket_id = ?");
    params.push(input.bucketId);
  }
  if (input?.domainId) {
    where.push("domain_id = ?");
    params.push(input.domainId);
  }
  if (input?.moduleId?.trim()) {
    where.push("module_id = ?");
    params.push(input.moduleId.trim());
  }
  if (input?.asOfTradeDate?.trim()) {
    where.push("as_of_trade_date = ?");
    params.push(input.asOfTradeDate.trim());
  }
  if (input?.onlyExceptions && !input.status) {
    where.push(`status in ('missing', 'partial', 'not_started')`);
  }
  if (keyword && keywordFields.length > 0) {
    const pattern = `%${escapeLikePattern(keyword.toLowerCase())}%`;
    const clauses: string[] = [];
    if (keywordFields.includes("entity")) {
      clauses.push(`lower(entity_id) like ? escape '\\'`);
      params.push(pattern);
    }
    if (keywordFields.includes("check")) {
      clauses.push(`lower(check_id) like ? escape '\\'`);
      params.push(pattern);
    }
    if (keywordFields.includes("module")) {
      clauses.push(`lower(ifnull(module_id, '')) like ? escape '\\'`);
      params.push(pattern);
    }
    if (clauses.length > 0) {
      where.push(`(${clauses.join(" or ")})`);
    }
  }
  if (where.length === 0) {
    throw new Error(
      "状态明细查询至少需要一个过滤条件；若需全局异常扫描，请开启 onlyExceptions。"
    );
  }

  const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";
  const limit = Math.max(1, Math.min(100_000, Math.floor(input?.limit ?? 200)));
  const offset = Math.max(0, Math.floor(input?.offset ?? 0));
  const sortBy = input?.sortBy ?? "updatedAt";
  const sortOrder = input?.sortOrder === "asc" ? "asc" : "desc";
  const orderBySql = resolveOrderBySql(sortBy, sortOrder);

  const rows = await all<PersistedCompletenessRow>(
    db,
    `
      select
        scope_id,
        check_id,
        entity_type,
        entity_id,
        bucket_id,
        domain_id,
        module_id,
        asset_class,
        as_of_trade_date,
        status,
        coverage_ratio,
        source_run_id,
        detail_json,
        updated_at
      from completeness_status_v2
      ${whereSql}
      order by ${orderBySql}
      limit ?
      offset ?
    `,
    [...params, limit, offset]
  );

  const totalRow = await get<{ total: number }>(
    db,
    `
      select count(*) as total
      from completeness_status_v2
      ${whereSql}
    `,
    params
  );

  return {
    items: rows.map(toCompletenessStatusRow),
    total: Number(totalRow?.total ?? 0),
    limit,
    offset
  };
}

function normalizeKeywordFields(
  raw: ListCompletenessStatusInput["keywordFields"] | undefined
): Array<"entity" | "check" | "module"> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return ["entity", "check", "module"];
  }
  const values = new Set<"entity" | "check" | "module">();
  raw.forEach((item) => {
    if (item === "entity" || item === "check" || item === "module") {
      values.add(item);
    }
  });
  if (values.size === 0) return ["entity", "check", "module"];
  return [...values];
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function resolveOrderBySql(
  sortBy: NonNullable<ListCompletenessStatusInput["sortBy"]>,
  sortOrder: "asc" | "desc"
): string {
  if (sortBy === "asOfTradeDate") {
    return `coalesce(as_of_trade_date, '') ${sortOrder}, updated_at desc, check_id asc, entity_id asc`;
  }
  if (sortBy === "status") {
    return `case status
      when 'missing' then 1
      when 'partial' then 2
      when 'not_started' then 3
      when 'complete' then 4
      when 'not_applicable' then 5
      else 6
    end ${sortOrder}, updated_at desc, check_id asc, entity_id asc`;
  }
  return `updated_at ${sortOrder}, check_id asc, entity_id asc`;
}

export async function previewCompletenessCoverage(
  db: SqliteDatabase,
  scopeId: CompletenessScopeId
): Promise<PreviewCompletenessCoverageResult> {
  const summary = await withTransientSqliteRetry(() =>
    get<{
      entities: number;
      checks: number;
      as_of_trade_date: string | null;
    }>(
      db,
      `
        select
          count(distinct entity_type || ':' || entity_id) as entities,
          count(distinct check_id) as checks,
          max(as_of_trade_date) as as_of_trade_date
        from completeness_status_v2
        where scope_id = ?
      `,
      [scopeId]
    )
  );

  const totals = {
    complete: 0,
    partial: 0,
    missing: 0,
    notApplicable: 0,
    notStarted: 0
  };

  const statusRows = await withTransientSqliteRetry(() =>
    all<{ status: CompletenessStatus; total: number }>(
      db,
      `
        select status, count(*) as total
        from completeness_status_v2
        where scope_id = ?
        group by status
      `,
      [scopeId]
    )
  );

  for (const row of statusRows) {
    applyStatusCount(totals, row.status, Number(row.total ?? 0));
  }

  const byBucketMap = new Map<
    CompletenessBucketId,
    PreviewCompletenessCoverageResult["byBucket"][number]
  >();
  const bucketStatusRows = await withTransientSqliteRetry(() =>
    all<{ bucket_id: CompletenessBucketId; status: CompletenessStatus; total: number }>(
      db,
      `
        select bucket_id, status, count(*) as total
        from completeness_status_v2
        where scope_id = ?
        group by bucket_id, status
      `,
      [scopeId]
    )
  );

  for (const row of bucketStatusRows) {
    const bucketId = row.bucket_id;
    const bucket =
      byBucketMap.get(bucketId) ?? {
        bucketId,
        complete: 0,
        partial: 0,
        missing: 0,
        notApplicable: 0,
        notStarted: 0
      };
    applyStatusCount(bucket, row.status, Number(row.total ?? 0));
    byBucketMap.set(bucketId, bucket);
  }

  return {
    scopeId,
    asOfTradeDate: summary?.as_of_trade_date ?? null,
    totals: {
      entities: Number(summary?.entities ?? 0),
      checks: Number(summary?.checks ?? 0),
      complete: totals.complete,
      partial: totals.partial,
      missing: totals.missing,
      notApplicable: totals.notApplicable,
      notStarted: totals.notStarted
    },
    byBucket: Array.from(byBucketMap.values()).sort((a, b) => {
      const aOrder = COMPLETENESS_BUCKET_ORDER[a.bucketId] ?? Number.MAX_SAFE_INTEGER;
      const bOrder = COMPLETENESS_BUCKET_ORDER[b.bucketId] ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.bucketId.localeCompare(b.bucketId);
    })
  };
}

function applyStatusCount(
  target: {
    complete: number;
    partial: number;
    missing: number;
    notApplicable: number;
    notStarted: number;
  },
  status: CompletenessStatus,
  count: number
): void {
  if (!Number.isFinite(count) || count <= 0) return;
  const n = Math.floor(count);
  if (status === "complete") target.complete += n;
  if (status === "partial") target.partial += n;
  if (status === "missing") target.missing += n;
  if (status === "not_applicable") target.notApplicable += n;
  if (status === "not_started") target.notStarted += n;
}

async function withTransientSqliteRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isTransientSqliteError(error)) throw error;
    await delay(30);
    return await fn();
  }
}

function isTransientSqliteError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!message) return false;
  const text = message.toLowerCase();
  return text.includes("disk i/o error") || text.includes("database is locked");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createCompletenessRun(
  db: SqliteDatabase,
  scopeId: CompletenessScopeId
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await run(
    db,
    `
      insert into completeness_runs_v2 (
        id,
        scope_id,
        status,
        as_of_trade_date,
        entity_count,
        complete_count,
        partial_count,
        missing_count,
        not_applicable_count,
        not_started_count,
        source_run_id,
        error_message,
        started_at,
        finished_at
      )
      values (?, ?, 'running', null, 0, 0, 0, 0, 0, 0, null, null, ?, null)
    `,
    [id, scopeId, now]
  );
  return id;
}

export async function finishCompletenessRun(
  db: SqliteDatabase,
  input: {
    id: string;
    status: "success" | "partial" | "failed";
    asOfTradeDate: string | null;
    entityCount: number;
    completeCount: number;
    partialCount: number;
    missingCount: number;
    notApplicableCount: number;
    notStartedCount: number;
    sourceRunId?: string | null;
    errorMessage?: string | null;
  }
): Promise<void> {
  await run(
    db,
    `
      update completeness_runs_v2
      set status = ?,
          as_of_trade_date = ?,
          entity_count = ?,
          complete_count = ?,
          partial_count = ?,
          missing_count = ?,
          not_applicable_count = ?,
          not_started_count = ?,
          source_run_id = ?,
          error_message = ?,
          finished_at = ?
      where id = ?
    `,
    [
      input.status,
      input.asOfTradeDate,
      Math.max(0, Math.floor(input.entityCount)),
      Math.max(0, Math.floor(input.completeCount)),
      Math.max(0, Math.floor(input.partialCount)),
      Math.max(0, Math.floor(input.missingCount)),
      Math.max(0, Math.floor(input.notApplicableCount)),
      Math.max(0, Math.floor(input.notStartedCount)),
      input.sourceRunId ?? null,
      input.errorMessage ?? null,
      Date.now(),
      input.id
    ]
  );
}

function toCompletenessStatusRow(
  row: PersistedCompletenessRow
): MarketCompletenessStatusRow {
  return {
    scopeId: row.scope_id,
    checkId: row.check_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    bucketId: row.bucket_id,
    domainId: row.domain_id as MarketCompletenessStatusRow["domainId"],
    moduleId: row.module_id,
    assetClass: (row.asset_class as MarketCompletenessStatusRow["assetClass"]) ?? null,
    asOfTradeDate: row.as_of_trade_date,
    status: row.status,
    coverageRatio: normalizeCoverageRatio(row.coverage_ratio),
    sourceRunId: row.source_run_id,
    detail: safeParseDetail(row.detail_json),
    updatedAt: row.updated_at
  };
}

function safeParseDetail(
  raw: string | null
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeCoverageRatio(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.round(value * 10_000) / 10_000;
}
