import crypto from "node:crypto";

import type {
  CloneBuiltinValuationMethodInput,
  ComputeValuationBySymbolInput,
  ComputeValuationBySymbolResult,
  CreateInsightFactInput,
  CreateCustomValuationMethodInput,
  CreateInsightInput,
  DataDomainId,
  DeleteValuationSubjectiveOverrideInput,
  GetInsightInput,
  GetValuationObjectiveRefreshStatusInput,
  GetValuationMethodInput,
  Insight,
  InsightFact,
  InsightDetail,
  InsightEffectChannel,
  InsightEffectOperator,
  InsightEffectPoint,
  InsightEffectStage,
  InsightMaterializedTarget,
  InsightScopeMode,
  InsightScopeRule,
  InsightScopeType,
  InsightStatus,
  InsightTargetExcludeInput,
  InsightTargetExclusion,
  InsightTargetUnexcludeInput,
  ListInsightsInput,
  ListInsightsResult,
  ListInsightFactsInput,
  ListInsightFactsResult,
  ListValuationMethodsInput,
  ListValuationMethodsResult,
  ListValuationObjectiveMetricSnapshotsInput,
  ListValuationSubjectiveDefaultsInput,
  ListValuationSubjectiveOverridesInput,
  MaterializeInsightTargetsInput,
  MaterializeInsightTargetsResult,
  PublishValuationMethodVersionInput,
  RemoveInsightEffectChannelInput,
  RemoveInsightEffectPointInput,
  RemoveInsightInput,
  RemoveInsightFactInput,
  RemoveInsightScopeRuleInput,
  SearchInsightsInput,
  SearchInsightsResult,
  SetActiveValuationMethodVersionInput,
  TriggerValuationObjectiveRefreshInput,
  UpdateCustomValuationMethodInput,
  UpdateInsightInput,
  UpsertInsightEffectChannelInput,
  UpsertInsightEffectPointInput,
  UpsertInsightScopeRuleInput,
  UpsertValuationMethodInputSchemaInput,
  UpsertValuationSubjectiveDefaultInput,
  UpsertValuationSubjectiveOverrideInput,
  ValuationAdjustmentPreview,
  ValuationAppliedEffect,
  ValuationConfidence,
  ValuationInputBreakdownItem,
  ValuationMethod,
  ValuationMethodAssetScope,
  ValuationMethodDetail,
  ValuationMethodInputField,
  ValuationMethodSpecV2,
  ValuationMethodVersion,
  ValuationMetricQuality,
  ValuationMetricSchedulerConfig,
  ValuationMetricNode,
  ValuationObjectiveMetricSnapshot,
  ValuationPreviewBySymbolInput,
  ValuationRefreshRunStatus,
  ValuationSubjectiveDefault,
  ValuationSubjectiveOverride
} from "@mytrader/shared";

import { listInstrumentSymbolsByTag } from "../market/instrumentCatalogRepository";
import { listInstrumentSymbolsByUserTag } from "../storage/instrumentTagRepository";
import { all, get, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const METHOD_KEY_RE = /^[A-Za-z0-9._-]+$/;
const SCOPE_TYPES = new Set<InsightScopeType>([
  "symbol",
  "tag",
  "kind",
  "asset_class",
  "market",
  "domain",
  "watchlist"
]);
const SCOPE_MODES = new Set<InsightScopeMode>(["include", "exclude"]);
const EFFECT_STAGES = new Set<InsightEffectStage>([
  "base",
  "first_order",
  "second_order",
  "output",
  "risk"
]);
const EFFECT_OPERATORS = new Set<InsightEffectOperator>([
  "set",
  "add",
  "mul",
  "min",
  "max"
]);
const INSIGHT_STATUSES = new Set<InsightStatus>([
  "draft",
  "active",
  "archived",
  "deleted"
]);
const STAGE_ORDER: InsightEffectStage[] = [
  "base",
  "first_order",
  "second_order",
  "output",
  "risk"
];
const STAGE_ORDER_INDEX: Record<InsightEffectStage, number> = {
  base: 0,
  first_order: 1,
  second_order: 2,
  output: 3,
  risk: 4
};
const VALUATION_SCHEDULER_KEY = "valuation_metric_scheduler_config_v1";
const DEFAULT_VALUATION_SCHEDULER_CONFIG: ValuationMetricSchedulerConfig = {
  enabled: true,
  intervalMinutes: 120,
  staleAfterMinutes: 24 * 60
};
const VALUATION_QUALITY_SET = new Set<ValuationMetricQuality>([
  "fresh",
  "stale",
  "fallback",
  "missing"
]);
const PRIMARY_VALUE_KEYS = ["output.fair_value", "valuation.fair_value", "market.price"];
const SUBJECTIVE_BASELINE_MAPPINGS: Array<{
  metricKey: "pe_ttm" | "pb" | "ps_ttm" | "ev_ebitda_ttm" | "dv_ttm";
  methodKey: string;
  inputKey: string;
}> = [
  {
    metricKey: "pe_ttm",
    methodKey: "builtin.stock.pe.relative.v1",
    inputKey: "targetPe"
  },
  {
    metricKey: "pb",
    methodKey: "builtin.stock.pb.relative.v1",
    inputKey: "targetPb"
  },
  {
    metricKey: "ps_ttm",
    methodKey: "builtin.stock.ps.relative.v1",
    inputKey: "targetPs"
  },
  {
    metricKey: "ev_ebitda_ttm",
    methodKey: "builtin.stock.ev_ebitda.relative.v1",
    inputKey: "targetEvEbitda"
  },
  {
    metricKey: "ps_ttm",
    methodKey: "builtin.stock.ev_sales.relative.v1",
    inputKey: "targetEvSales"
  },
  {
    metricKey: "dv_ttm",
    methodKey: "builtin.stock.ddm.gordon.v1",
    inputKey: "dividendYield"
  },
  {
    metricKey: "pe_ttm",
    methodKey: "builtin.etf.pe.relative.v1",
    inputKey: "targetPe"
  },
  {
    metricKey: "pb",
    methodKey: "builtin.etf.pb.relative.v1",
    inputKey: "targetPb"
  },
  {
    metricKey: "ps_ttm",
    methodKey: "builtin.etf.ps.relative.v1",
    inputKey: "targetPs"
  }
];

interface InsightRow {
  id: string;
  title: string;
  thesis: string;
  status: string;
  valid_from: string | null;
  valid_to: string | null;
  tags_json: string;
  meta_json: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface InsightFactRow {
  id: string;
  content: string;
  created_at: number;
  updated_at: number;
}

interface ScopeRuleRow {
  id: string;
  insight_id: string;
  scope_type: string;
  scope_key: string;
  mode: string;
  enabled: number;
  created_at: number;
  updated_at: number;
}

interface EffectChannelRow {
  id: string;
  insight_id: string;
  method_key: string;
  metric_key: string;
  stage: string;
  operator: string;
  priority: number;
  enabled: number;
  meta_json: string;
  created_at: number;
  updated_at: number;
}

interface EffectPointRow {
  id: string;
  channel_id: string;
  effect_date: string;
  effect_value: number;
  created_at: number;
  updated_at: number;
}

interface TargetExclusionRow {
  id: string;
  insight_id: string;
  symbol: string;
  reason: string | null;
  created_at: number;
  updated_at: number;
}

interface MaterializedTargetRow {
  id: string;
  insight_id: string;
  symbol: string;
  source_scope_type: string;
  source_scope_key: string;
  materialized_at: number;
}

interface ValuationMethodRow {
  id: string;
  method_key: string;
  name: string;
  description: string | null;
  is_builtin: number;
  status: string;
  asset_scope_json: string;
  active_version_id: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

interface ValuationMethodVersionRow {
  id: string;
  method_id: string;
  version: number;
  effective_from: string | null;
  effective_to: string | null;
  graph_json: string;
  param_schema_json: string;
  metric_schema_json: string;
  formula_manifest_json: string;
  input_schema_json: string | null;
  created_at: number;
  updated_at: number;
}

interface ValuationObjectiveMetricSnapshotRow {
  id: string;
  symbol: string;
  method_key: string;
  metric_key: string;
  as_of_date: string;
  value: number | null;
  quality: string;
  source: string | null;
  created_at: number;
  updated_at: number;
}

interface ValuationSubjectiveDefaultRow {
  id: string;
  method_key: string;
  input_key: string;
  market: string | null;
  industry_tag: string | null;
  value: number;
  source: string | null;
  created_at: number;
  updated_at: number;
}

interface ValuationSubjectiveOverrideRow {
  id: string;
  symbol: string;
  method_key: string;
  input_key: string;
  value: number;
  note: string | null;
  created_at: number;
  updated_at: number;
}

interface ValuationRefreshRunRow {
  id: string;
  status: string;
  reason: string | null;
  total_symbols: number;
  refreshed: number;
  failed: number;
  message: string | null;
  started_at: number;
  finished_at: number | null;
  created_at: number;
  updated_at: number;
}

interface ChannelCandidateRow {
  channel_id: string;
  metric_key: string;
  stage: string;
  operator: string;
  priority: number;
  channel_created_at: number;
  insight_id: string;
  insight_title: string;
}

interface ChannelPointValueRow {
  channel_id: string;
  effect_date: string;
  effect_value: number;
}

interface CompiledValuationRuntimeSource {
  formulaId: string;
  formulaManifest: Record<string, unknown>;
  inputSchema: ValuationMethodInputField[];
  paramSchema: Record<string, unknown>;
  metricSchema: Record<string, unknown>;
  spec: ValuationMethodSpecV2;
}

interface ProfileLookupRow {
  kind: string | null;
  asset_class: string | null;
  market: string | null;
  tags_json: string | null;
}

interface PriceSeriesRow {
  trade_date: string;
  close: number | null;
}

interface DailyBasicSnapshotRow {
  trade_date: string;
  circ_mv: number | null;
  pe_ttm: number | null;
  pb: number | null;
  ps_ttm: number | null;
  ev_ebitda_ttm: number | null;
  ev_sales_ttm: number | null;
  dv_ttm: number | null;
  turnover_rate: number | null;
}

interface SubjectiveBaselineSeedRow {
  market: string | null;
  tags_json: string | null;
  pe_ttm: number | null;
  pb: number | null;
  ps_ttm: number | null;
  ev_ebitda_ttm: number | null;
  dv_ttm: number | null;
}

interface SymbolScopeRow {
  insight_id: string;
  source_scope_type: string;
  source_scope_key: string;
}

export async function listInsightFacts(
  businessDb: SqliteDatabase,
  input?: ListInsightFactsInput
): Promise<ListInsightFactsResult> {
  const limit = Math.max(1, Math.min(500, Math.floor(input?.limit ?? 200)));
  const offset = Math.max(0, Math.floor(input?.offset ?? 0));
  const rows = await all<InsightFactRow>(
    businessDb,
    `
      select id, content, created_at, updated_at
      from insight_facts
      order by created_at desc, id asc
      limit ?
      offset ?
    `,
    [limit, offset]
  );
  const totalRow = await get<{ total: number }>(
    businessDb,
    `select count(*) as total from insight_facts`
  );
  return {
    items: rows.map(toInsightFact),
    total: Number(totalRow?.total ?? 0),
    limit,
    offset
  };
}

export async function createInsightFact(
  businessDb: SqliteDatabase,
  input: CreateInsightFactInput
): Promise<InsightFact> {
  const id = crypto.randomUUID();
  const content = normalizeRequiredString(input.content, "content");
  const now = Date.now();
  await run(
    businessDb,
    `
      insert into insight_facts (id, content, created_at, updated_at)
      values (?, ?, ?, ?)
    `,
    [id, content, now, now]
  );
  const row = await get<InsightFactRow>(
    businessDb,
    `
      select id, content, created_at, updated_at
      from insight_facts
      where id = ?
      limit 1
    `,
    [id]
  );
  if (!row) throw new Error("Failed to read created insight fact.");
  return toInsightFact(row);
}

export async function removeInsightFact(
  businessDb: SqliteDatabase,
  input: RemoveInsightFactInput
): Promise<void> {
  const id = normalizeRequiredString(input.id, "id");
  await run(businessDb, `delete from insight_facts where id = ?`, [id]);
}

export async function listInsights(
  businessDb: SqliteDatabase,
  input?: ListInsightsInput
): Promise<ListInsightsResult> {
  const query = normalizeOptionalString(input?.query)?.toLowerCase() ?? null;
  const status = normalizeInsightStatusFilter(input?.status);
  const limit = Math.max(1, Math.min(500, Math.floor(input?.limit ?? 100)));
  const offset = Math.max(0, Math.floor(input?.offset ?? 0));
  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (status === "deleted") {
    whereClauses.push(`deleted_at is not null`);
  } else {
    whereClauses.push(`deleted_at is null`);
    if (status && status !== "all") {
      whereClauses.push(`status = ?`);
      params.push(status);
    }
  }

  if (query) {
    whereClauses.push(`(lower(title) like ? or lower(thesis) like ?)`);
    const pattern = `%${escapeLike(query)}%`;
    params.push(pattern, pattern);
  }

  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(" and ")}` : "";

  const rows = await all<InsightRow>(
    businessDb,
    `
      select
        id, title, thesis, status, valid_from, valid_to,
        tags_json, meta_json, created_at, updated_at, deleted_at
      from insights
      ${whereSql}
      order by updated_at desc
      limit ?
      offset ?
    `,
    [...params, limit, offset]
  );
  const totalRow = await get<{ total: number }>(
    businessDb,
    `select count(*) as total from insights ${whereSql}`,
    params
  );

  return {
    items: rows.map(toInsight),
    total: Number(totalRow?.total ?? 0),
    limit,
    offset
  };
}

export async function getInsightDetail(
  businessDb: SqliteDatabase,
  input: GetInsightInput
): Promise<InsightDetail | null> {
  const insightId = normalizeRequiredString(input.id, "id");
  const insightRow = await get<InsightRow>(
    businessDb,
    `
      select
        id, title, thesis, status, valid_from, valid_to,
        tags_json, meta_json, created_at, updated_at, deleted_at
      from insights
      where id = ?
      limit 1
    `,
    [insightId]
  );
  if (!insightRow) return null;

  const [scopeRows, channelRows, pointRows, exclusionRows, targetRows] = await Promise.all([
    all<ScopeRuleRow>(
      businessDb,
      `
        select id, insight_id, scope_type, scope_key, mode, enabled, created_at, updated_at
        from insight_scope_rules
        where insight_id = ?
        order by created_at asc
      `,
      [insightId]
    ),
    all<EffectChannelRow>(
      businessDb,
      `
        select
          id, insight_id, method_key, metric_key, stage, operator,
          priority, enabled, meta_json, created_at, updated_at
        from insight_effect_channels
        where insight_id = ?
        order by created_at asc
      `,
      [insightId]
    ),
    all<EffectPointRow>(
      businessDb,
      `
        select p.id, p.channel_id, p.effect_date, p.effect_value, p.created_at, p.updated_at
        from insight_effect_points p
        join insight_effect_channels c on c.id = p.channel_id
        where c.insight_id = ?
        order by p.effect_date asc, p.created_at asc
      `,
      [insightId]
    ),
    all<TargetExclusionRow>(
      businessDb,
      `
        select id, insight_id, symbol, reason, created_at, updated_at
        from insight_target_exclusions
        where insight_id = ?
        order by symbol asc
      `,
      [insightId]
    ),
    all<MaterializedTargetRow>(
      businessDb,
      `
        select
          id, insight_id, symbol, source_scope_type, source_scope_key, materialized_at
        from insight_materialized_targets
        where insight_id = ?
        order by symbol asc, source_scope_type asc, source_scope_key asc
      `,
      [insightId]
    )
  ]);

  return {
    ...toInsight(insightRow),
    scopeRules: scopeRows.map(toScopeRule),
    effectChannels: channelRows.map(toEffectChannel),
    effectPoints: pointRows.map(toEffectPoint),
    targetExclusions: exclusionRows.map(toTargetExclusion),
    materializedTargets: targetRows.map(toMaterializedTarget)
  };
}

export async function createInsight(
  businessDb: SqliteDatabase,
  input: CreateInsightInput
): Promise<InsightDetail> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const title = normalizeRequiredString(input.title, "title");
  const thesis = normalizeOptionalString(input.thesis) ?? "";
  const status = normalizeInsightStatus(input.status ?? "draft");
  const validFrom = normalizeOptionalDate(input.validFrom, "validFrom");
  const validTo = normalizeOptionalDate(input.validTo, "validTo");
  const tags = normalizeStringArray(input.tags);
  const meta = normalizeRecord(input.meta);

  await run(
    businessDb,
    `
      insert into insights (
        id, title, thesis, status, valid_from, valid_to,
        tags_json, meta_json, created_at, updated_at, deleted_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      title,
      thesis,
      status,
      validFrom,
      validTo,
      JSON.stringify(tags),
      JSON.stringify(meta),
      now,
      now,
      status === "deleted" ? now : null
    ]
  );
  const detail = await getInsightDetail(businessDb, { id });
  if (!detail) throw new Error("Failed to read created insight.");
  return detail;
}

export async function updateInsight(
  businessDb: SqliteDatabase,
  input: UpdateInsightInput
): Promise<InsightDetail> {
  const insightId = normalizeRequiredString(input.id, "id");
  const existing = await getInsightDetail(businessDb, { id: insightId });
  if (!existing) throw new Error("未找到观点。");
  const now = Date.now();
  const title =
    input.title === undefined
      ? existing.title
      : normalizeRequiredString(input.title, "title");
  const thesis =
    input.thesis === undefined
      ? existing.thesis
      : normalizeOptionalString(input.thesis) ?? "";
  const status =
    input.status === undefined || input.status === null
      ? existing.status
      : normalizeInsightStatus(input.status);
  const validFrom =
    input.validFrom === undefined
      ? existing.validFrom
      : normalizeOptionalDate(input.validFrom, "validFrom");
  const validTo =
    input.validTo === undefined
      ? existing.validTo
      : normalizeOptionalDate(input.validTo, "validTo");
  const tags =
    input.tags === undefined ? existing.tags : normalizeStringArray(input.tags);
  const meta =
    input.meta === undefined ? existing.meta : normalizeRecord(input.meta);
  const deletedAt =
    status === "deleted" ? (existing.deletedAt ?? now) : null;

  await run(
    businessDb,
    `
      update insights
      set
        title = ?,
        thesis = ?,
        status = ?,
        valid_from = ?,
        valid_to = ?,
        tags_json = ?,
        meta_json = ?,
        updated_at = ?,
        deleted_at = ?
      where id = ?
    `,
    [
      title,
      thesis,
      status,
      validFrom,
      validTo,
      JSON.stringify(tags),
      JSON.stringify(meta),
      now,
      deletedAt,
      insightId
    ]
  );

  const detail = await getInsightDetail(businessDb, { id: insightId });
  if (!detail) throw new Error("未找到更新后的观点。");
  return detail;
}

export async function removeInsight(
  businessDb: SqliteDatabase,
  input: RemoveInsightInput
): Promise<void> {
  const insightId = normalizeRequiredString(input.id, "id");
  const now = Date.now();
  await run(
    businessDb,
    `
      update insights
      set status = 'deleted', deleted_at = ?, updated_at = ?
      where id = ?
    `,
    [now, now, insightId]
  );
}

export async function searchInsights(
  businessDb: SqliteDatabase,
  input: SearchInsightsInput
): Promise<SearchInsightsResult> {
  const query = normalizeRequiredString(input.query, "query");
  const limit = Math.max(1, Math.min(200, Math.floor(input.limit ?? 20)));
  const offset = Math.max(0, Math.floor(input.offset ?? 0));

  const rows = await all<InsightRow & { snippet: string | null; score: number | null }>(
    businessDb,
    `
      select
        i.id,
        i.title,
        i.thesis,
        i.status,
        i.valid_from,
        i.valid_to,
        i.tags_json,
        i.meta_json,
        i.created_at,
        i.updated_at,
        i.deleted_at,
        snippet(insight_fts, 2, '<mark>', '</mark>', ' … ', 16) as snippet,
        bm25(insight_fts) as score
      from insight_fts
      join insights i on i.id = insight_fts.insight_id
      where insight_fts match ?
        and i.deleted_at is null
      order by score asc, i.updated_at desc
      limit ?
      offset ?
    `,
    [query, limit, offset]
  );
  const totalRow = await get<{ total: number }>(
    businessDb,
    `
      select count(*) as total
      from insight_fts
      join insights i on i.id = insight_fts.insight_id
      where insight_fts match ?
        and i.deleted_at is null
    `,
    [query]
  );

  return {
    items: rows.map((row) => ({
      insight: toInsight(row),
      snippet: row.snippet ?? null,
      score: toFiniteNumber(row.score)
    })),
    total: Number(totalRow?.total ?? 0),
    limit,
    offset
  };
}

export async function upsertInsightScopeRule(
  businessDb: SqliteDatabase,
  input: UpsertInsightScopeRuleInput
): Promise<InsightScopeRule> {
  const now = Date.now();
  const id = normalizeOptionalString(input.id) ?? crypto.randomUUID();
  const insightId = normalizeRequiredString(input.insightId, "insightId");
  const scopeType = normalizeScopeType(input.scopeType);
  const scopeKey = normalizeRequiredString(input.scopeKey, "scopeKey");
  const mode = normalizeScopeMode(input.mode);
  const enabled = input.enabled ?? true ? 1 : 0;

  const exists = await get<{ id: string }>(
    businessDb,
    `select id from insight_scope_rules where id = ?`,
    [id]
  );
  if (exists) {
    await run(
      businessDb,
      `
        update insight_scope_rules
        set
          insight_id = ?,
          scope_type = ?,
          scope_key = ?,
          mode = ?,
          enabled = ?,
          updated_at = ?
        where id = ?
      `,
      [insightId, scopeType, scopeKey, mode, enabled, now, id]
    );
  } else {
    await run(
      businessDb,
      `
        insert into insight_scope_rules (
          id, insight_id, scope_type, scope_key, mode, enabled, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(insight_id, scope_type, scope_key, mode) do update set
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `,
      [id, insightId, scopeType, scopeKey, mode, enabled, now, now]
    );
  }
  const row = await get<ScopeRuleRow>(
    businessDb,
    `
      select id, insight_id, scope_type, scope_key, mode, enabled, created_at, updated_at
      from insight_scope_rules
      where insight_id = ? and scope_type = ? and scope_key = ? and mode = ?
      limit 1
    `,
    [insightId, scopeType, scopeKey, mode]
  );
  if (!row) throw new Error("Failed to read insight scope rule.");
  return toScopeRule(row);
}

export async function removeInsightScopeRule(
  businessDb: SqliteDatabase,
  input: RemoveInsightScopeRuleInput
): Promise<void> {
  const id = normalizeRequiredString(input.id, "id");
  await run(businessDb, `delete from insight_scope_rules where id = ?`, [id]);
}

export async function upsertInsightEffectChannel(
  businessDb: SqliteDatabase,
  input: UpsertInsightEffectChannelInput
): Promise<InsightEffectChannel> {
  const now = Date.now();
  const id = normalizeOptionalString(input.id) ?? crypto.randomUUID();
  const insightId = normalizeRequiredString(input.insightId, "insightId");
  const methodKey = normalizeRequiredString(input.methodKey, "methodKey");
  const metricKey = normalizeRequiredString(input.metricKey, "metricKey");
  const stage = normalizeEffectStage(input.stage);
  const operator = normalizeEffectOperator(input.operator);
  const priority = normalizePriority(input.priority);
  const enabled = input.enabled ?? true ? 1 : 0;
  const meta = normalizeRecord(input.meta);

  const exists = await get<{ id: string }>(
    businessDb,
    `select id from insight_effect_channels where id = ?`,
    [id]
  );
  if (exists) {
    await run(
      businessDb,
      `
        update insight_effect_channels
        set
          insight_id = ?,
          method_key = ?,
          metric_key = ?,
          stage = ?,
          operator = ?,
          priority = ?,
          enabled = ?,
          meta_json = ?,
          updated_at = ?
        where id = ?
      `,
      [
        insightId,
        methodKey,
        metricKey,
        stage,
        operator,
        priority,
        enabled,
        JSON.stringify(meta),
        now,
        id
      ]
    );
  } else {
    await run(
      businessDb,
      `
        insert into insight_effect_channels (
          id, insight_id, method_key, metric_key, stage, operator, priority,
          enabled, meta_json, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        insightId,
        methodKey,
        metricKey,
        stage,
        operator,
        priority,
        enabled,
        JSON.stringify(meta),
        now,
        now
      ]
    );
  }
  const row = await get<EffectChannelRow>(
    businessDb,
    `
      select
        id, insight_id, method_key, metric_key, stage, operator,
        priority, enabled, meta_json, created_at, updated_at
      from insight_effect_channels
      where id = ?
      limit 1
    `,
    [id]
  );
  if (!row) throw new Error("Failed to read insight effect channel.");
  return toEffectChannel(row);
}

export async function removeInsightEffectChannel(
  businessDb: SqliteDatabase,
  input: RemoveInsightEffectChannelInput
): Promise<void> {
  const id = normalizeRequiredString(input.id, "id");
  await run(businessDb, `delete from insight_effect_channels where id = ?`, [id]);
}

export async function upsertInsightEffectPoint(
  businessDb: SqliteDatabase,
  input: UpsertInsightEffectPointInput
): Promise<InsightEffectPoint> {
  const now = Date.now();
  const channelId = normalizeRequiredString(input.channelId, "channelId");
  const effectDate = normalizeRequiredDate(input.effectDate, "effectDate");
  const effectValue = normalizeFiniteNumber(input.effectValue, "effectValue");
  const existingByKey = await get<{ id: string }>(
    businessDb,
    `
      select id
      from insight_effect_points
      where channel_id = ? and effect_date = ?
      limit 1
    `,
    [channelId, effectDate]
  );
  const id = normalizeOptionalString(input.id) ?? existingByKey?.id ?? crypto.randomUUID();
  const exists = await get<{ id: string }>(
    businessDb,
    `select id from insight_effect_points where id = ?`,
    [id]
  );
  if (exists) {
    await run(
      businessDb,
      `
        update insight_effect_points
        set channel_id = ?, effect_date = ?, effect_value = ?, updated_at = ?
        where id = ?
      `,
      [channelId, effectDate, effectValue, now, id]
    );
  } else {
    await run(
      businessDb,
      `
        insert into insight_effect_points (
          id, channel_id, effect_date, effect_value, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?)
        on conflict(channel_id, effect_date) do update set
          effect_value = excluded.effect_value,
          updated_at = excluded.updated_at
      `,
      [id, channelId, effectDate, effectValue, now, now]
    );
  }
  const row = await get<EffectPointRow>(
    businessDb,
    `
      select id, channel_id, effect_date, effect_value, created_at, updated_at
      from insight_effect_points
      where channel_id = ? and effect_date = ?
      limit 1
    `,
    [channelId, effectDate]
  );
  if (!row) throw new Error("Failed to read insight effect point.");
  return toEffectPoint(row);
}

export async function removeInsightEffectPoint(
  businessDb: SqliteDatabase,
  input: RemoveInsightEffectPointInput
): Promise<void> {
  const id = normalizeRequiredString(input.id, "id");
  await run(businessDb, `delete from insight_effect_points where id = ?`, [id]);
}

export async function previewMaterializeInsightTargets(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: MaterializeInsightTargetsInput
): Promise<MaterializeInsightTargetsResult> {
  const insightId = normalizeRequiredString(input.insightId, "insightId");
  const previewLimit = Math.max(1, Math.min(2000, Math.floor(input.previewLimit ?? 200)));
  const persist = input.persist ?? true;

  const rules = await all<ScopeRuleRow>(
    businessDb,
    `
      select id, insight_id, scope_type, scope_key, mode, enabled, created_at, updated_at
      from insight_scope_rules
      where insight_id = ? and enabled = 1
      order by created_at asc
    `,
    [insightId]
  );

  const includeRules = rules.filter((rule) => rule.mode === "include");
  const excludeRules = rules.filter((rule) => rule.mode === "exclude");
  const includeSources = new Map<string, Set<string>>();
  for (const rule of includeRules) {
    const symbols = await resolveScopeRuleSymbols(businessDb, marketDb, rule);
    const source = `${rule.scope_type}:${rule.scope_key}`;
    symbols.forEach((symbol) => {
      const existing = includeSources.get(symbol) ?? new Set<string>();
      existing.add(source);
      includeSources.set(symbol, existing);
    });
  }

  const excluded = new Set<string>();
  for (const rule of excludeRules) {
    const symbols = await resolveScopeRuleSymbols(businessDb, marketDb, rule);
    symbols.forEach((symbol) => excluded.add(symbol));
  }
  const exclusions = await all<{ symbol: string }>(
    businessDb,
    `
      select symbol
      from insight_target_exclusions
      where insight_id = ?
    `,
    [insightId]
  );
  exclusions.forEach((row) => {
    const symbol = row.symbol?.trim();
    if (symbol) excluded.add(symbol);
  });

  const symbols = Array.from(includeSources.keys())
    .filter((symbol) => !excluded.has(symbol))
    .sort((a, b) => a.localeCompare(b));

  const materializedAt = Date.now();
  if (persist) {
    await transaction(businessDb, async () => {
      await run(
        businessDb,
        `delete from insight_materialized_targets where insight_id = ?`,
        [insightId]
      );
      for (const symbol of symbols) {
        const sources = includeSources.get(symbol) ?? new Set<string>();
        if (sources.size === 0) continue;
        for (const source of sources) {
          const separator = source.indexOf(":");
          const scopeType = source.slice(0, separator);
          const scopeKey = source.slice(separator + 1);
          await run(
            businessDb,
            `
              insert into insight_materialized_targets (
                id, insight_id, symbol, source_scope_type, source_scope_key, materialized_at
              )
              values (?, ?, ?, ?, ?, ?)
            `,
            [
              crypto.randomUUID(),
              insightId,
              symbol,
              scopeType,
              scopeKey,
              materializedAt
            ]
          );
        }
      }
    });
  }

  return {
    insightId,
    total: symbols.length,
    symbols: symbols.slice(0, previewLimit),
    truncated: symbols.length > previewLimit,
    rulesApplied: rules.length,
    updatedAt: materializedAt
  };
}

export async function excludeInsightTarget(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: InsightTargetExcludeInput
): Promise<void> {
  const insightId = normalizeRequiredString(input.insightId, "insightId");
  const symbol = normalizeRequiredString(input.symbol, "symbol");
  const reason = normalizeOptionalString(input.reason);
  const now = Date.now();
  await run(
    businessDb,
    `
      insert into insight_target_exclusions (
        id, insight_id, symbol, reason, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?)
      on conflict(insight_id, symbol) do update set
        reason = excluded.reason,
        updated_at = excluded.updated_at
    `,
    [crypto.randomUUID(), insightId, symbol, reason, now, now]
  );
  await previewMaterializeInsightTargets(businessDb, marketDb, {
    insightId,
    persist: true
  });
}

export async function unexcludeInsightTarget(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: InsightTargetUnexcludeInput
): Promise<void> {
  const insightId = normalizeRequiredString(input.insightId, "insightId");
  const symbol = normalizeRequiredString(input.symbol, "symbol");
  await run(
    businessDb,
    `
      delete from insight_target_exclusions
      where insight_id = ? and symbol = ?
    `,
    [insightId, symbol]
  );
  await previewMaterializeInsightTargets(businessDb, marketDb, {
    insightId,
    persist: true
  });
}

export async function refreshAllInsightMaterializations(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase
): Promise<void> {
  const rows = await all<{ id: string }>(
    businessDb,
    `
      select id
      from insights
      where deleted_at is null
        and status in ('active', 'draft', 'archived')
      order by updated_at desc
    `
  );
  for (const row of rows) {
    const id = row.id?.trim();
    if (!id) continue;
    await previewMaterializeInsightTargets(businessDb, marketDb, {
      insightId: id,
      persist: true
    });
  }
}

export async function listValuationMethods(
  businessDb: SqliteDatabase,
  input?: ListValuationMethodsInput
): Promise<ListValuationMethodsResult> {
  const query = normalizeOptionalString(input?.query)?.toLowerCase() ?? null;
  const includeArchived = input?.includeArchived ?? false;
  const includeBuiltin = input?.includeBuiltin ?? true;
  const limit = Math.max(1, Math.min(500, Math.floor(input?.limit ?? 200)));
  const offset = Math.max(0, Math.floor(input?.offset ?? 0));
  const whereClauses: string[] = [`deleted_at is null`];
  const params: Array<string | number> = [];
  if (!includeArchived) {
    whereClauses.push(`status = 'active'`);
  }
  if (!includeBuiltin) {
    whereClauses.push(`is_builtin = 0`);
  }
  if (query) {
    whereClauses.push(`(lower(method_key) like ? or lower(name) like ? or lower(coalesce(description,'')) like ?)`);
    const pattern = `%${escapeLike(query)}%`;
    params.push(pattern, pattern, pattern);
  }
  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(" and ")}` : "";
  const rows = await all<ValuationMethodRow>(
    businessDb,
    `
      select
        id, method_key, name, description, is_builtin, status,
        asset_scope_json, active_version_id, created_at, updated_at, deleted_at
      from valuation_methods
      ${whereSql}
      order by is_builtin desc, updated_at desc
      limit ?
      offset ?
    `,
    [...params, limit, offset]
  );
  const totalRow = await get<{ total: number }>(
    businessDb,
    `select count(*) as total from valuation_methods ${whereSql}`,
    params
  );
  return {
    items: rows.map(toValuationMethod),
    total: Number(totalRow?.total ?? 0),
    limit,
    offset
  };
}

export async function getValuationMethodDetail(
  businessDb: SqliteDatabase,
  input: GetValuationMethodInput
): Promise<ValuationMethodDetail | null> {
  const methodKey = normalizeRequiredString(input.methodKey, "methodKey");
  const methodRow = await get<ValuationMethodRow>(
    businessDb,
    `
      select
        id, method_key, name, description, is_builtin, status,
        asset_scope_json, active_version_id, created_at, updated_at, deleted_at
      from valuation_methods
      where method_key = ?
        and deleted_at is null
      limit 1
    `,
    [methodKey]
  );
  if (!methodRow) return null;
  const versions = await all<ValuationMethodVersionRow>(
    businessDb,
    `
      select
        id, method_id, version, effective_from, effective_to,
        graph_json, param_schema_json, metric_schema_json, formula_manifest_json, input_schema_json,
        created_at, updated_at
      from valuation_method_versions
      where method_id = ?
      order by version desc
    `,
    [methodRow.id]
  );
  const method = toValuationMethod(methodRow);
  return {
    method,
    versions: versions.map((version) => toValuationMethodVersion(version, method))
  };
}

export async function createCustomValuationMethod(
  businessDb: SqliteDatabase,
  input: CreateCustomValuationMethodInput
): Promise<ValuationMethodDetail> {
  const now = Date.now();
  const methodKey = normalizeMethodKey(input.methodKey, "methodKey");
  const name = normalizeRequiredString(input.name, "name");
  const description = normalizeOptionalString(input.description);
  const assetScope = normalizeAssetScope(input.assetScope);
  const templateMethodKey = normalizeOptionalString(input.templateMethodKey);
  const existing = await get<ValuationMethodRow>(
    businessDb,
    `select * from valuation_methods where method_key = ? limit 1`,
    [methodKey]
  );
  if (existing) {
    throw new Error(`估值方法已存在: ${methodKey}`);
  }

  const methodId = methodKey;
  let graph: ValuationMetricNode[] = buildDefaultMetricGraph("generic_factor_v1");
  let paramSchema: Record<string, unknown> = {
    momentumWeight: 0.5,
    volatilityPenalty: 0.15
  };
  let metricSchema: Record<string, unknown> = {
    required: ["market.price"],
    outputs: ["output.fair_value", "output.return_gap"]
  };
  let formulaManifest: Record<string, unknown> = { formulaId: "generic_factor_v1", locked: true };
  let inputSchema: ValuationMethodInputField[] = buildDefaultInputSchemaForFormula(
    "generic_factor_v1"
  );

  if (templateMethodKey) {
    const template = await getValuationMethodDetail(businessDb, {
      methodKey: templateMethodKey
    });
    if (!template) throw new Error(`模板方法不存在: ${templateMethodKey}`);
    const active = pickPreferredVersion(template.method, template.versions, null);
    if (active) {
      graph = active.graph;
      paramSchema = active.paramSchema;
      metricSchema = active.metricSchema;
      formulaManifest = active.formulaManifest;
      inputSchema = active.inputSchema;
    }
  }

  const normalizedSpec = normalizeValuationMethodSpecV2(
    normalizeRecord(formulaManifest).specV2,
    {
      methodKey,
      version: 1,
      assetScope,
      formulaManifest,
      inputSchema,
      paramSchema,
      metricSchema
    }
  );
  formulaManifest = {
    ...stripSpecFromFormulaManifest(formulaManifest),
    formulaId: normalizedSpec.formula.formulaId,
    locked: normalizedSpec.formula.locked,
    specV2: normalizedSpec
  };
  if (normalizedSpec.formula.executorRef) {
    formulaManifest.executorRef = normalizedSpec.formula.executorRef;
  }
  paramSchema = normalizedSpec.parameters;
  metricSchema = {
    ...metricSchema,
    required: normalizedSpec.outputs.required,
    outputs: normalizedSpec.outputs.outputs,
    primaryValueKeys: normalizedSpec.outputs.primaryValueKeys
  };
  inputSchema = normalizedSpec.inputs.fields;
  graph = buildMetricGraphFromSpec(normalizedSpec);

  const versionId = `${methodKey}.v1.${now}`;
  await transaction(businessDb, async () => {
    await run(
      businessDb,
      `
        insert into valuation_methods (
          id, method_key, name, description, is_builtin, status,
          asset_scope_json, active_version_id, created_at, updated_at, deleted_at
        )
        values (?, ?, ?, ?, 0, 'active', ?, ?, ?, ?, null)
      `,
      [
        methodId,
        methodKey,
        name,
        description,
        JSON.stringify(assetScope),
        versionId,
        now,
        now
      ]
    );
    await run(
      businessDb,
      `
        insert into valuation_method_versions (
          id, method_id, version, effective_from, effective_to,
          graph_json, param_schema_json, metric_schema_json, formula_manifest_json, input_schema_json,
          created_at, updated_at
        )
        values (?, ?, 1, null, null, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        versionId,
        methodId,
        JSON.stringify(graph),
        JSON.stringify(paramSchema),
        JSON.stringify(metricSchema),
        JSON.stringify(formulaManifest),
        JSON.stringify(inputSchema),
        now,
        now
      ]
    );
  });
  const detail = await getValuationMethodDetail(businessDb, { methodKey });
  if (!detail) throw new Error("Failed to read created valuation method.");
  return detail;
}

export async function updateCustomValuationMethod(
  businessDb: SqliteDatabase,
  input: UpdateCustomValuationMethodInput
): Promise<ValuationMethodDetail> {
  const now = Date.now();
  const methodKey = normalizeMethodKey(input.methodKey, "methodKey");
  const detail = await getValuationMethodDetail(businessDb, { methodKey });
  if (!detail) throw new Error("估值方法不存在。");
  if (detail.method.isBuiltin) {
    throw new Error("内置方法不可直接编辑，请先克隆。");
  }

  const name =
    input.name === undefined || input.name === null
      ? detail.method.name
      : normalizeRequiredString(input.name, "name");
  const description =
    input.description === undefined
      ? detail.method.description
      : normalizeOptionalString(input.description);
  const status =
    input.status === undefined || input.status === null
      ? detail.method.status
      : input.status;
  const assetScope =
    input.assetScope === undefined || input.assetScope === null
      ? detail.method.assetScope
      : normalizeAssetScope(input.assetScope);
  if (status !== "active" && status !== "archived") {
    throw new Error("status must be active/archived.");
  }

  await run(
    businessDb,
    `
      update valuation_methods
      set name = ?, description = ?, status = ?, asset_scope_json = ?, updated_at = ?
      where method_key = ? and is_builtin = 0 and deleted_at is null
    `,
    [name, description, status, JSON.stringify(assetScope), now, methodKey]
  );
  const updated = await getValuationMethodDetail(businessDb, { methodKey });
  if (!updated) throw new Error("Failed to read updated valuation method.");
  return updated;
}

export async function cloneBuiltinValuationMethod(
  businessDb: SqliteDatabase,
  input: CloneBuiltinValuationMethodInput
): Promise<ValuationMethodDetail> {
  const sourceKey = normalizeMethodKey(input.sourceMethodKey, "sourceMethodKey");
  const targetKey = normalizeMethodKey(input.targetMethodKey, "targetMethodKey");
  const source = await getValuationMethodDetail(businessDb, { methodKey: sourceKey });
  if (!source) throw new Error("源方法不存在。");
  if (!source.method.isBuiltin) {
    throw new Error("仅支持克隆内置方法。");
  }
  const active = pickPreferredVersion(source.method, source.versions, null);
  if (!active) throw new Error("源方法缺少可用版本。");

  return createCustomValuationMethod(businessDb, {
    methodKey: targetKey,
    name: normalizeOptionalString(input.name) ?? `${source.method.name} (克隆)`,
    description:
      normalizeOptionalString(input.description) ?? source.method.description ?? null,
    assetScope:
      input.assetScope !== undefined && input.assetScope !== null
        ? normalizeAssetScope(input.assetScope)
        : source.method.assetScope,
    templateMethodKey: sourceKey
  });
}

export async function publishValuationMethodVersion(
  businessDb: SqliteDatabase,
  input: PublishValuationMethodVersionInput
): Promise<ValuationMethodDetail> {
  const now = Date.now();
  const methodKey = normalizeMethodKey(input.methodKey, "methodKey");
  const detail = await getValuationMethodDetail(businessDb, { methodKey });
  if (!detail) throw new Error("估值方法不存在。");
  if (detail.method.isBuiltin) {
    throw new Error("内置方法不可发布新版本，请先克隆。");
  }

  const nextVersion =
    detail.versions.reduce((max, item) => Math.max(max, item.version), 0) + 1;
  const providedGraph = normalizeMetricGraph(input.graph);
  let graph: ValuationMetricNode[] = [];
  let paramSchema = normalizeRecord(input.paramSchema);
  let metricSchema = normalizeRecord(input.metricSchema);
  const templateVersion =
    pickPreferredVersion(detail.method, detail.versions, null) ?? detail.versions[0] ?? null;
  let formulaManifest: Record<string, unknown> =
    templateVersion?.formulaManifest ?? { formulaId: "generic_factor_v1", locked: true };
  const normalizedInputSchema =
    input.inputSchema === undefined || input.inputSchema === null
      ? null
      : normalizeInputSchema(input.inputSchema);
  let inputSchema =
    normalizedInputSchema && normalizedInputSchema.length > 0
      ? normalizedInputSchema
      : templateVersion?.inputSchema && templateVersion.inputSchema.length > 0
        ? templateVersion.inputSchema
        : buildDefaultInputSchemaForFormula(resolveFormulaId(formulaManifest));
  const spec = normalizeValuationMethodSpecV2(
    input.spec ?? normalizeRecord(formulaManifest).specV2,
    {
      methodKey,
      version: nextVersion,
      assetScope: detail.method.assetScope,
      formulaManifest,
      inputSchema,
      paramSchema,
      metricSchema
    }
  );
  formulaManifest = {
    ...stripSpecFromFormulaManifest(formulaManifest),
    formulaId: spec.formula.formulaId,
    locked: spec.formula.locked,
    specV2: spec
  };
  if (spec.formula.executorRef) {
    formulaManifest.executorRef = spec.formula.executorRef;
  }
  paramSchema = spec.parameters;
  metricSchema = {
    ...metricSchema,
    required: spec.outputs.required,
    outputs: spec.outputs.outputs,
    primaryValueKeys: spec.outputs.primaryValueKeys
  };
  inputSchema = spec.inputs.fields;
  graph = buildMetricGraphFromSpec(spec);
  assertGraphConsistentWithSpec(providedGraph, graph);
  const effectiveFrom = normalizeOptionalDate(input.effectiveFrom, "effectiveFrom");
  const effectiveTo = normalizeOptionalDate(input.effectiveTo, "effectiveTo");
  const versionId = `${methodKey}.v${nextVersion}.${now}`;

  await run(
    businessDb,
    `
      insert into valuation_method_versions (
        id, method_id, version, effective_from, effective_to,
        graph_json, param_schema_json, metric_schema_json, formula_manifest_json, input_schema_json,
        created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      versionId,
      detail.method.id,
      nextVersion,
      effectiveFrom,
      effectiveTo,
      JSON.stringify(graph),
      JSON.stringify(paramSchema),
      JSON.stringify(metricSchema),
      JSON.stringify(formulaManifest),
      JSON.stringify(inputSchema),
      now,
      now
    ]
  );

  const refreshed = await getValuationMethodDetail(businessDb, { methodKey });
  if (!refreshed) throw new Error("Failed to read published valuation method.");
  return refreshed;
}

export async function setActiveValuationMethodVersion(
  businessDb: SqliteDatabase,
  input: SetActiveValuationMethodVersionInput
): Promise<ValuationMethodDetail> {
  const now = Date.now();
  const methodKey = normalizeMethodKey(input.methodKey, "methodKey");
  const versionId = normalizeRequiredString(input.versionId, "versionId");
  const method = await getValuationMethodDetail(businessDb, { methodKey });
  if (!method) throw new Error("估值方法不存在。");
  const owned = method.versions.some((version) => version.id === versionId);
  if (!owned) throw new Error("versionId 不属于指定方法。");
  await run(
    businessDb,
    `
      update valuation_methods
      set active_version_id = ?, updated_at = ?
      where method_key = ? and deleted_at is null
    `,
    [versionId, now, methodKey]
  );
  const refreshed = await getValuationMethodDetail(businessDb, { methodKey });
  if (!refreshed) throw new Error("Failed to read updated active version.");
  return refreshed;
}

export async function upsertValuationMethodInputSchema(
  businessDb: SqliteDatabase,
  input: UpsertValuationMethodInputSchemaInput
): Promise<ValuationMethodDetail> {
  const now = Date.now();
  const methodKey = normalizeMethodKey(input.methodKey, "methodKey");
  const detail = await getValuationMethodDetail(businessDb, { methodKey });
  if (!detail) throw new Error("估值方法不存在。");
  if (detail.method.isBuiltin) {
    throw new Error("内置方法不可直接编辑输入定义，请先克隆。");
  }

  const versionId = normalizeOptionalString(input.versionId);
  const targetVersion =
    (versionId
      ? detail.versions.find((item) => item.id === versionId) ?? null
      : null) ??
    (detail.method.activeVersionId
      ? detail.versions.find((item) => item.id === detail.method.activeVersionId) ?? null
      : null) ??
    [...detail.versions].sort((a, b) => b.version - a.version)[0] ??
    null;
  if (!targetVersion) throw new Error("目标版本不存在。");

  const normalized = normalizeInputSchema(input.inputSchema);
  const nextSpec = normalizeValuationMethodSpecV2(
    targetVersion.spec,
    {
      methodKey: detail.method.methodKey,
      version: targetVersion.version,
      assetScope: detail.method.assetScope,
      formulaManifest: targetVersion.formulaManifest,
      inputSchema: normalized,
      paramSchema: targetVersion.paramSchema,
      metricSchema: targetVersion.metricSchema
    }
  );
  nextSpec.inputs.fields = normalized;
  const derivedGraph = buildMetricGraphFromSpec(nextSpec);
  const formulaManifest: Record<string, unknown> = {
    ...stripSpecFromFormulaManifest(targetVersion.formulaManifest),
    formulaId: nextSpec.formula.formulaId,
    locked: nextSpec.formula.locked,
    specV2: nextSpec
  };
  if (nextSpec.formula.executorRef) {
    formulaManifest.executorRef = nextSpec.formula.executorRef;
  }
  await run(
    businessDb,
    `
      update valuation_method_versions
      set input_schema_json = ?, formula_manifest_json = ?, graph_json = ?, updated_at = ?
      where id = ?
    `,
    [
      JSON.stringify(normalized),
      JSON.stringify(formulaManifest),
      JSON.stringify(derivedGraph),
      now,
      targetVersion.id
    ]
  );

  const refreshed = await getValuationMethodDetail(businessDb, { methodKey });
  if (!refreshed) throw new Error("Failed to read updated method.");
  return refreshed;
}

export async function listValuationSubjectiveDefaults(
  businessDb: SqliteDatabase,
  input?: ListValuationSubjectiveDefaultsInput
): Promise<ValuationSubjectiveDefault[]> {
  const where: string[] = [];
  const params: Array<string | number> = [];
  const methodKey = normalizeOptionalString(input?.methodKey);
  const market = normalizeOptionalString(input?.market);
  const industryTag = normalizeOptionalString(input?.industryTag);
  if (methodKey) {
    where.push("method_key = ?");
    params.push(methodKey);
  }
  if (market) {
    where.push("upper(ifnull(market, '')) = upper(?)");
    params.push(market);
  }
  if (industryTag) {
    where.push("industry_tag = ?");
    params.push(industryTag);
  }
  const limit = normalizePaginationLimit(input?.limit, 500);
  const offset = normalizePaginationOffset(input?.offset);
  const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";
  const rows = await all<ValuationSubjectiveDefaultRow>(
    businessDb,
    `
      select *
      from valuation_subjective_defaults
      ${whereSql}
      order by method_key asc, input_key asc, ifnull(market, '') asc, ifnull(industry_tag, '') asc
      limit ? offset ?
    `,
    [...params, limit, offset]
  );
  return rows.map(toValuationSubjectiveDefault);
}

export async function upsertValuationSubjectiveDefault(
  businessDb: SqliteDatabase,
  input: UpsertValuationSubjectiveDefaultInput
): Promise<ValuationSubjectiveDefault> {
  const now = Date.now();
  const methodKey = normalizeMethodKey(input.methodKey, "methodKey");
  const inputKey = normalizeRequiredString(input.inputKey, "inputKey");
  const market = normalizeOptionalString(input.market);
  const industryTag = normalizeOptionalString(input.industryTag);
  const value = Number(input.value);
  if (!Number.isFinite(value)) {
    throw new Error("value must be finite.");
  }
  const source = normalizeOptionalString(input.source);

  const existing = await get<ValuationSubjectiveDefaultRow>(
    businessDb,
    `
      select *
      from valuation_subjective_defaults
      where method_key = ?
        and input_key = ?
        and ifnull(market, '') = ifnull(?, '')
        and ifnull(industry_tag, '') = ifnull(?, '')
      limit 1
    `,
    [methodKey, inputKey, market, industryTag]
  );

  const id = existing?.id ?? crypto.randomUUID();
  if (existing) {
    await run(
      businessDb,
      `
        update valuation_subjective_defaults
        set value = ?, source = ?, updated_at = ?
        where id = ?
      `,
      [value, source, now, id]
    );
  } else {
    await run(
      businessDb,
      `
        insert into valuation_subjective_defaults (
          id, method_key, input_key, market, industry_tag, value, source, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, methodKey, inputKey, market, industryTag, value, source, now, now]
    );
  }

  const row = await get<ValuationSubjectiveDefaultRow>(
    businessDb,
    `select * from valuation_subjective_defaults where id = ? limit 1`,
    [id]
  );
  if (!row) throw new Error("Failed to read subjective default.");
  return toValuationSubjectiveDefault(row);
}

export async function listValuationSubjectiveOverrides(
  businessDb: SqliteDatabase,
  input: ListValuationSubjectiveOverridesInput
): Promise<ValuationSubjectiveOverride[]> {
  const symbol = normalizeRequiredString(input.symbol, "symbol");
  const methodKey = normalizeOptionalString(input.methodKey);
  const rows = await all<ValuationSubjectiveOverrideRow>(
    businessDb,
    `
      select *
      from valuation_subjective_symbol_overrides
      where symbol = ?
        and (? is null or method_key = ?)
      order by method_key asc, input_key asc
    `,
    [symbol, methodKey, methodKey]
  );
  return rows.map(toValuationSubjectiveOverride);
}

export async function upsertValuationSubjectiveOverride(
  businessDb: SqliteDatabase,
  input: UpsertValuationSubjectiveOverrideInput
): Promise<ValuationSubjectiveOverride> {
  const now = Date.now();
  const symbol = normalizeRequiredString(input.symbol, "symbol");
  const methodKey = normalizeMethodKey(input.methodKey, "methodKey");
  const inputKey = normalizeRequiredString(input.inputKey, "inputKey");
  const value = Number(input.value);
  if (!Number.isFinite(value)) throw new Error("value must be finite.");
  const note = normalizeOptionalString(input.note);
  const id = crypto.randomUUID();
  await run(
    businessDb,
    `
      insert into valuation_subjective_symbol_overrides (
        id, symbol, method_key, input_key, value, note, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(symbol, method_key, input_key) do update set
        value = excluded.value,
        note = excluded.note,
        updated_at = excluded.updated_at
    `,
    [id, symbol, methodKey, inputKey, value, note, now, now]
  );

  const row = await get<ValuationSubjectiveOverrideRow>(
    businessDb,
    `
      select *
      from valuation_subjective_symbol_overrides
      where symbol = ? and method_key = ? and input_key = ?
      limit 1
    `,
    [symbol, methodKey, inputKey]
  );
  if (!row) throw new Error("Failed to read subjective override.");
  return toValuationSubjectiveOverride(row);
}

export async function deleteValuationSubjectiveOverride(
  businessDb: SqliteDatabase,
  input: DeleteValuationSubjectiveOverrideInput
): Promise<void> {
  const symbol = normalizeRequiredString(input.symbol, "symbol");
  const methodKey = normalizeMethodKey(input.methodKey, "methodKey");
  const inputKey = normalizeRequiredString(input.inputKey, "inputKey");
  await run(
    businessDb,
    `
      delete from valuation_subjective_symbol_overrides
      where symbol = ? and method_key = ? and input_key = ?
    `,
    [symbol, methodKey, inputKey]
  );
}

export async function listValuationObjectiveMetricSnapshots(
  businessDb: SqliteDatabase,
  input: ListValuationObjectiveMetricSnapshotsInput
): Promise<ValuationObjectiveMetricSnapshot[]> {
  const symbol = normalizeRequiredString(input.symbol, "symbol");
  const methodKey = normalizeOptionalString(input.methodKey);
  const asOfDate = normalizeOptionalDate(input.asOfDate, "asOfDate");
  const rows = await all<ValuationObjectiveMetricSnapshotRow>(
    businessDb,
    `
      select *
      from valuation_objective_metric_snapshots
      where symbol = ?
        and (? is null or method_key = ?)
        and (? is null or as_of_date <= ?)
      order by as_of_date desc, metric_key asc
      limit 500
    `,
    [symbol, methodKey, methodKey, asOfDate, asOfDate]
  );
  return rows.map(toValuationObjectiveMetricSnapshot);
}

export async function getValuationMetricSchedulerConfig(
  businessDb: SqliteDatabase
): Promise<ValuationMetricSchedulerConfig> {
  const row = await get<{ value_json: string }>(
    businessDb,
    `select value_json from market_settings where key = ?`,
    [VALUATION_SCHEDULER_KEY]
  );
  if (!row?.value_json) {
    return await setValuationMetricSchedulerConfig(
      businessDb,
      DEFAULT_VALUATION_SCHEDULER_CONFIG
    );
  }
  try {
    const parsed = JSON.parse(row.value_json) as Partial<ValuationMetricSchedulerConfig>;
    return normalizeValuationMetricSchedulerConfig(parsed);
  } catch {
    return await setValuationMetricSchedulerConfig(
      businessDb,
      DEFAULT_VALUATION_SCHEDULER_CONFIG
    );
  }
}

export async function setValuationMetricSchedulerConfig(
  businessDb: SqliteDatabase,
  input: ValuationMetricSchedulerConfig
): Promise<ValuationMetricSchedulerConfig> {
  const normalized = normalizeValuationMetricSchedulerConfig(input);
  await run(
    businessDb,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [VALUATION_SCHEDULER_KEY, JSON.stringify(normalized)]
  );
  return normalized;
}

export async function triggerValuationObjectiveRefresh(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input?: TriggerValuationObjectiveRefreshInput
): Promise<ValuationRefreshRunStatus> {
  const now = Date.now();
  const runId = crypto.randomUUID();
  const asOfDate = normalizeOptionalDate(input?.asOfDate, "asOfDate") ?? todayIsoDate();
  const explicitSymbols = Array.isArray(input?.symbols)
    ? input?.symbols.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const symbols =
    explicitSymbols.length > 0
      ? Array.from(new Set(explicitSymbols))
      : (
          await all<{ symbol: string }>(
            marketDb,
            `
              select symbol
              from instrument_profiles
              order by symbol asc
              limit 1000
            `
          )
        ).map((row) => row.symbol);

  await run(
    businessDb,
    `
      insert into valuation_refresh_runs (
        id, status, reason, total_symbols, refreshed, failed, message,
        started_at, finished_at, created_at, updated_at
      )
      values (?, 'running', ?, ?, 0, 0, null, ?, null, ?, ?)
    `,
    [runId, normalizeOptionalString(input?.reason), symbols.length, now, now, now]
  );

  let refreshed = 0;
  let failed = 0;
  for (const symbol of symbols) {
    try {
      const profile = await getProfileForSymbol(marketDb, symbol);
      const methodKey = await resolveMethodKeyForSymbol(profile);
      const objective = await collectObjectiveMetricsForSymbol(marketDb, symbol, asOfDate);
      await upsertObjectiveSnapshotsForSymbol(businessDb, {
        symbol,
        methodKey,
        asOfDate,
        metrics: objective.metrics,
        qualities: objective.qualities
      });
      refreshed += 1;
    } catch {
      failed += 1;
    }
  }

  let baselineUpserts = 0;
  let baselineError: string | null = null;
  try {
    baselineUpserts = await refreshValuationSubjectiveBaselines(
      businessDb,
      marketDb,
      asOfDate
    );
  } catch (error) {
    baselineError = error instanceof Error ? error.message : String(error);
  }

  const status =
    failed === 0 && baselineError === null
      ? "success"
      : refreshed > 0 || baselineUpserts > 0
        ? "partial"
        : "failed";
  const message = baselineError
    ? `objective refreshed ${refreshed}/${symbols.length}; subjective defaults refresh failed: ${baselineError}`
    : `objective refreshed ${refreshed}/${symbols.length}; subjective defaults upserted ${baselineUpserts}`;
  const finishedAt = Date.now();
  await run(
    businessDb,
    `
      update valuation_refresh_runs
      set status = ?, refreshed = ?, failed = ?, message = ?, finished_at = ?, updated_at = ?
      where id = ?
    `,
    [status, refreshed, failed, message, finishedAt, finishedAt, runId]
  );

  const row = await get<ValuationRefreshRunRow>(
    businessDb,
    `select * from valuation_refresh_runs where id = ? limit 1`,
    [runId]
  );
  if (!row) throw new Error("Failed to read refresh run.");
  return toValuationRefreshRunStatus(row);
}

export async function getValuationObjectiveRefreshStatus(
  businessDb: SqliteDatabase,
  input?: GetValuationObjectiveRefreshStatusInput
): Promise<ValuationRefreshRunStatus | null> {
  const runId = normalizeOptionalString(input?.runId);
  const row = runId
    ? await get<ValuationRefreshRunRow>(
        businessDb,
        `select * from valuation_refresh_runs where id = ? limit 1`,
        [runId]
      )
    : await get<ValuationRefreshRunRow>(
        businessDb,
        `select * from valuation_refresh_runs order by started_at desc limit 1`
      );
  if (!row) return null;
  return toValuationRefreshRunStatus(row);
}

async function refreshValuationSubjectiveBaselines(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  asOfDate: string
): Promise<number> {
  const rows = await all<SubjectiveBaselineSeedRow>(
    marketDb,
    `
      with latest as (
        select symbol, max(trade_date) as trade_date
        from daily_basics
        where trade_date <= ?
        group by symbol
      )
      select
        p.market,
        p.tags_json,
        b.pe_ttm,
        b.pb,
        b.ps_ttm,
        b.ev_ebitda_ttm,
        b.dv_ttm
      from instrument_profiles p
      left join latest l on l.symbol = p.symbol
      left join daily_basics b
        on b.symbol = l.symbol
       and b.trade_date = l.trade_date
      where lower(coalesce(p.kind, '')) in ('stock', 'fund')
    `,
    [asOfDate]
  );
  if (rows.length === 0) return 0;

  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const market = normalizeOptionalString(row.market)?.toUpperCase() ?? null;
    const industryTag = resolveIndustryTagFromTags(parseJsonArray(row.tags_json ?? ""));
    for (const mapping of SUBJECTIVE_BASELINE_MAPPINGS) {
      const value = toFiniteNumber(row[mapping.metricKey] ?? null);
      if (value === null || value <= 0) continue;
      recordSubjectiveBaselineGroup(
        grouped,
        mapping.methodKey,
        mapping.inputKey,
        market,
        industryTag,
        value
      );
    }
  }

  let upserted = 0;
  const source = `scheduler.baseline.${asOfDate}`;
  for (const [key, values] of grouped.entries()) {
    const median = computeMedianValue(values);
    if (median === null) continue;
    const [methodKey, inputKey, marketRaw, industryRaw] = decodeSubjectiveBaselineGroupKey(key);
    await upsertValuationSubjectiveDefault(businessDb, {
      methodKey,
      inputKey,
      market: marketRaw || null,
      industryTag: industryRaw || null,
      value: median,
      source
    });
    upserted += 1;
  }
  return upserted;
}

function resolveIndustryTagFromTags(tags: string[]): string | null {
  for (const tag of tags) {
    if (tag.startsWith("industry:")) return tag;
    if (tag.startsWith("sw_l1:")) return tag;
    if (tag.startsWith("sw_l2:")) return tag;
  }
  return null;
}

function encodeSubjectiveBaselineGroupKey(
  methodKey: string,
  inputKey: string,
  market: string | null,
  industryTag: string | null
): string {
  return [methodKey, inputKey, market ?? "", industryTag ?? ""].join("\u0001");
}

function decodeSubjectiveBaselineGroupKey(key: string): [string, string, string, string] {
  const parts = key.split("\u0001");
  return [
    parts[0] ?? "",
    parts[1] ?? "",
    parts[2] ?? "",
    parts[3] ?? ""
  ];
}

function recordSubjectiveBaselineGroup(
  grouped: Map<string, number[]>,
  methodKey: string,
  inputKey: string,
  market: string | null,
  industryTag: string | null,
  value: number
): void {
  const push = (m: string | null, i: string | null): void => {
    const groupKey = encodeSubjectiveBaselineGroupKey(methodKey, inputKey, m, i);
    const bucket = grouped.get(groupKey);
    if (bucket) {
      bucket.push(value);
      return;
    }
    grouped.set(groupKey, [value]);
  };

  if (market && industryTag) push(market, industryTag);
  if (industryTag) push(null, industryTag);
  if (market) push(market, null);
  push(null, null);
}

function computeMedianValue(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

async function collectObjectiveMetricsForSymbol(
  marketDb: SqliteDatabase,
  symbol: string,
  asOfDate: string
): Promise<{
  metrics: Record<string, number | null>;
  qualities: Record<string, ValuationMetricQuality>;
}> {
  const priceRows = await all<PriceSeriesRow>(
    marketDb,
    `
      select trade_date, close
      from daily_prices
      where symbol = ?
        and trade_date <= ?
        and close is not null
      order by trade_date desc
      limit 64
    `,
    [symbol, asOfDate]
  );
  const closes = priceRows
    .map((row) => ({
      date: row.trade_date,
      close: toFiniteNumber(row.close)
    }))
    .filter((row): row is { date: string; close: number } => row.close !== null);
  const latestClose = closes[0]?.close ?? null;
  const momentum20 =
    closes.length >= 21 && closes[20].close !== 0
      ? latestClose !== null
        ? latestClose / closes[20].close - 1
        : null
      : null;
  const volatility20 = computeVolatility(closes, 20);

  const basics = await get<DailyBasicSnapshotRow>(
    marketDb,
    `
      select
        trade_date,
        circ_mv,
        pe_ttm,
        pb,
        ps_ttm,
        ev_ebitda_ttm,
        ev_sales_ttm,
        dv_ttm,
        turnover_rate
      from daily_basics
      where symbol = ?
        and trade_date <= ?
      order by trade_date desc
      limit 1
    `,
    [symbol, asOfDate]
  );

  const stale =
    basics?.trade_date && basics.trade_date !== asOfDate ? "stale" : "fresh";
  const metrics: Record<string, number | null> = {
    "market.price": latestClose,
    "factor.momentum.20d": momentum20,
    "risk.volatility.20d": volatility20,
    "risk.beta": null,
    "risk.alpha": null,
    "factor.basis": null,
    "factor.carry.annualized": momentum20,
    "factor.ppp_gap": null,
    "risk.duration": null,
    "risk.yield_shift": null,
    "liquidity.circ_mv": toFiniteNumber(basics?.circ_mv ?? null),
    "valuation.pe_ttm": toFiniteNumber(basics?.pe_ttm ?? null),
    "valuation.pb": toFiniteNumber(basics?.pb ?? null),
    "valuation.ps_ttm": toFiniteNumber(basics?.ps_ttm ?? null),
    "valuation.ev_ebitda_ttm": toFiniteNumber(basics?.ev_ebitda_ttm ?? null),
    "valuation.ev_sales_ttm": toFiniteNumber(basics?.ev_sales_ttm ?? null),
    "valuation.dv_ttm": toFiniteNumber(basics?.dv_ttm ?? null),
    "valuation.turnover_rate": toFiniteNumber(basics?.turnover_rate ?? null)
  };

  const qualities: Record<string, ValuationMetricQuality> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (value === null) {
      qualities[key] = "missing";
      continue;
    }
    if (key === "market.price") {
      qualities[key] =
        priceRows[0]?.trade_date === asOfDate ? "fresh" : "stale";
      continue;
    }
    if (key.startsWith("valuation.") || key.startsWith("liquidity.")) {
      qualities[key] = stale;
      continue;
    }
    qualities[key] = "fresh";
  }
  return { metrics, qualities };
}

async function upsertObjectiveSnapshotsForSymbol(
  businessDb: SqliteDatabase,
  input: {
    symbol: string;
    methodKey: string;
    asOfDate: string;
    metrics: Record<string, number | null>;
    qualities: Record<string, ValuationMetricQuality>;
  }
): Promise<void> {
  const now = Date.now();
  for (const [metricKey, value] of Object.entries(input.metrics)) {
    const existing = await get<{ id: string }>(
      businessDb,
      `
        select id
        from valuation_objective_metric_snapshots
        where symbol = ?
          and method_key = ?
          and metric_key = ?
          and as_of_date = ?
        limit 1
      `,
      [input.symbol, input.methodKey, metricKey, input.asOfDate]
    );
    const id = existing?.id ?? crypto.randomUUID();
    await run(
      businessDb,
      `
        insert into valuation_objective_metric_snapshots (
          id, symbol, method_key, metric_key, as_of_date, value, quality, source, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(symbol, method_key, metric_key, as_of_date) do update set
          value = excluded.value,
          quality = excluded.quality,
          source = excluded.source,
          updated_at = excluded.updated_at
      `,
      [
        id,
        input.symbol,
        input.methodKey,
        metricKey,
        input.asOfDate,
        value,
        input.qualities[metricKey] ?? "missing",
        "market.cache",
        now,
        now
      ]
    );
  }
}

function resolveIndustryTagFromProfile(profile: ProfileLookupRow | null): string | null {
  return resolveIndustryTagFromTags(parseJsonArray(profile?.tags_json ?? ""));
}

function computeConfidence(
  requiredMetricKeys: string[],
  qualities: Record<string, ValuationMetricQuality>,
  values: Record<string, number | null>
): { confidence: ValuationConfidence; reasons: string[] } {
  const reasons: string[] = [];
  let missingCount = 0;
  let staleOrFallbackCount = 0;
  for (const key of requiredMetricKeys) {
    const value = toFiniteNumber(values[key] ?? null);
    const quality = qualities[key] ?? (value === null ? "missing" : "fresh");
    if (quality === "missing" || value === null) {
      missingCount += 1;
      reasons.push(`缺少关键输入: ${key}`);
      continue;
    }
    if (quality === "stale" || quality === "fallback") {
      staleOrFallbackCount += 1;
      reasons.push(`输入降级(${quality}): ${key}`);
    }
  }

  if (missingCount > 0) {
    return {
      confidence: staleOrFallbackCount > 0 ? "low" : "not_applicable",
      reasons
    };
  }
  if (staleOrFallbackCount >= 2) {
    return { confidence: "low", reasons };
  }
  if (staleOrFallbackCount === 1) {
    return { confidence: "medium", reasons };
  }
  return { confidence: "high", reasons };
}

export async function previewValuationBySymbol(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: ValuationPreviewBySymbolInput
): Promise<ValuationAdjustmentPreview> {
  const symbol = normalizeRequiredString(input.symbol, "symbol");
  const asOfDate = normalizeOptionalDate(input.asOfDate, "asOfDate") ?? todayIsoDate();
  const preferredMethodKey = normalizeOptionalString(input.methodKey);
  const profile = await getProfileForSymbol(marketDb, symbol);
  const methodKey = preferredMethodKey ?? (await resolveMethodKeyForSymbol(profile));
  const methodDetail = methodKey
    ? await getValuationMethodDetail(businessDb, { methodKey })
    : null;
  const method = methodDetail?.method ?? null;
  const version =
    method && methodDetail
      ? pickPreferredVersion(method, methodDetail.versions, asOfDate)
      : null;

  if (!method || !version) {
    return {
      symbol,
      asOfDate,
      methodKey: methodKey ?? null,
      methodVersionId: null,
      baseMetrics: {},
      adjustedMetrics: {},
      baseValue: null,
      adjustedValue: null,
      appliedEffects: [],
      notApplicable: true,
      reason: methodKey
        ? `估值方法不可用: ${methodKey}`
        : "未找到可用估值方法",
      computedAt: Date.now()
    };
  }

  const objective = await collectObjectiveMetricsForSymbol(marketDb, symbol, asOfDate);
  if (objective.metrics["market.price"] === null) {
    const runtimeSource = compileValuationRuntimeSource(method, version);
    return {
      symbol,
      asOfDate,
      methodKey: method.methodKey,
      methodVersionId: version.id,
      baseMetrics: {},
      adjustedMetrics: {},
      baseValue: null,
      adjustedValue: null,
      appliedEffects: [],
      notApplicable: true,
      reason: runtimeSource.spec.degradation.missingPriceReason,
      computedAt: Date.now()
    };
  }

  const runtimeSource = compileValuationRuntimeSource(method, version);
  const formulaId = runtimeSource.formulaId;
  const inputSchema = runtimeSource.inputSchema;
  const subjectiveKeys = Array.from(
    new Set(
      inputSchema
        .filter((field) => field.kind === "subjective")
        .map((field) => field.key)
    )
  );
  const subjectivePlaceholders = subjectiveKeys.map(() => "?").join(", ");
  const profileMarket = normalizeOptionalString(profile?.market)?.toUpperCase() ?? null;
  const industryTag = resolveIndustryTagFromProfile(profile);
  const defaultRows =
    subjectiveKeys.length === 0
      ? []
      : await all<ValuationSubjectiveDefaultRow>(
          businessDb,
          `
            select *
            from valuation_subjective_defaults
            where method_key = ?
              and input_key in (${subjectivePlaceholders})
          `,
          [method.methodKey, ...subjectiveKeys]
        );
  const overrideRows =
    subjectiveKeys.length === 0
      ? []
      : await all<ValuationSubjectiveOverrideRow>(
          businessDb,
          `
            select *
            from valuation_subjective_symbol_overrides
            where symbol = ?
              and method_key = ?
              and input_key in (${subjectivePlaceholders})
          `,
          [symbol, method.methodKey, ...subjectiveKeys]
        );
  const overrideMap = new Map(overrideRows.map((row) => [row.input_key, row]));

  const baseMetrics: Record<string, number | null> = { ...objective.metrics };
  const qualityByMetric: Record<string, ValuationMetricQuality> = { ...objective.qualities };
  const runtimeParamSchema: Record<string, unknown> = { ...runtimeSource.paramSchema };
  for (const key of subjectiveKeys) {
    const override = overrideMap.get(key) ?? null;
    if (override) {
      baseMetrics[key] = Number(override.value);
      qualityByMetric[key] = "fresh";
      runtimeParamSchema[key] = Number(override.value);
      continue;
    }

    const candidates = defaultRows.filter((row) => row.input_key === key);
    const exactIndustry = candidates.find(
      (row) =>
        row.industry_tag === industryTag &&
        (row.market ?? null) === profileMarket
    );
    const industryOnly = candidates.find(
      (row) => row.industry_tag === industryTag && row.market === null
    );
    const marketOnly = candidates.find(
      (row) => row.industry_tag === null && (row.market ?? null) === profileMarket
    );
    const globalOnly = candidates.find(
      (row) => row.industry_tag === null && row.market === null
    );
    const picked = exactIndustry ?? industryOnly ?? marketOnly ?? globalOnly ?? null;
    if (picked) {
      const value = Number(picked.value);
      baseMetrics[key] = Number.isFinite(value) ? value : null;
      qualityByMetric[key] = Number.isFinite(value) ? "fresh" : "missing";
      if (Number.isFinite(value)) runtimeParamSchema[key] = value;
      continue;
    }

    if (!runtimeSource.spec.quality.allowSubjectiveFallback) {
      baseMetrics[key] = null;
      qualityByMetric[key] = "missing";
      continue;
    }

    const fromVersionParam = toFiniteNumber(runtimeParamSchema[key] ?? null);
    if (fromVersionParam !== null) {
      baseMetrics[key] = fromVersionParam;
      qualityByMetric[key] = "fallback";
      continue;
    }
    const fromFieldDefault =
      inputSchema.find((field) => field.key === key)?.defaultValue ?? null;
    const fieldDefaultValue = toFiniteNumber(fromFieldDefault);
    baseMetrics[key] = fieldDefaultValue;
    qualityByMetric[key] = fieldDefaultValue === null ? "missing" : "fallback";
    if (fieldDefaultValue !== null) runtimeParamSchema[key] = fieldDefaultValue;
  }

  await upsertObjectiveSnapshotsForSymbol(businessDb, {
    symbol,
    methodKey: method.methodKey,
    asOfDate,
    metrics: objective.metrics,
    qualities: objective.qualities
  });
  recomputeDerivedOutputs(baseMetrics, formulaId, runtimeParamSchema);

  const adjustedMetrics: Record<string, number | null> = { ...baseMetrics };
  const sourceScopeRows = await all<SymbolScopeRow>(
    businessDb,
    `
      select insight_id, source_scope_type, source_scope_key
      from insight_materialized_targets
      where symbol = ?
    `,
    [symbol]
  );
  const scopesByInsight = new Map<string, string[]>();
  sourceScopeRows.forEach((row) => {
    const key = row.insight_id;
    const value = `${row.source_scope_type}:${row.source_scope_key}`;
    const list = scopesByInsight.get(key) ?? [];
    if (!list.includes(value)) list.push(value);
    scopesByInsight.set(key, list);
  });

  const channelRows = await all<ChannelCandidateRow>(
    businessDb,
    `
      select distinct
        c.id as channel_id,
        c.metric_key,
        c.stage,
        c.operator,
        c.priority,
        c.created_at as channel_created_at,
        i.id as insight_id,
        i.title as insight_title
      from insight_materialized_targets mt
      join insights i on i.id = mt.insight_id
      join insight_effect_channels c on c.insight_id = i.id
      where mt.symbol = ?
        and i.deleted_at is null
        and i.status = 'active'
        and c.enabled = 1
        and (i.valid_from is null or i.valid_from <= ?)
        and (i.valid_to is null or i.valid_to >= ?)
        and (c.method_key = ? or c.method_key = '*')
        and not exists (
          select 1
          from insight_target_exclusions ex
          where ex.insight_id = i.id
            and ex.symbol = ?
        )
    `,
    [symbol, asOfDate, asOfDate, method.methodKey, symbol]
  );

  const channelIds = Array.from(new Set(channelRows.map((row) => row.channel_id)));
  const pointsByChannel = new Map<string, Array<{ date: string; value: number }>>();
  if (channelIds.length > 0) {
    const rows = await all<ChannelPointValueRow>(
      businessDb,
      `
        select channel_id, effect_date, effect_value
        from insight_effect_points
        where channel_id in (${channelIds.map(() => "?").join(",")})
        order by channel_id asc, effect_date asc
      `,
      channelIds
    );
    rows.forEach((row) => {
      const list = pointsByChannel.get(row.channel_id) ?? [];
      const value = toFiniteNumber(row.effect_value);
      if (value !== null) list.push({ date: row.effect_date, value });
      pointsByChannel.set(row.channel_id, list);
    });
  }

  const sortedChannels = [...channelRows].sort((a, b) => {
    const byStage =
      stageIndexFromString(a.stage) - stageIndexFromString(b.stage);
    if (byStage !== 0) return byStage;
    const byPriority = Number(a.priority) - Number(b.priority);
    if (byPriority !== 0) return byPriority;
    const byCreated = Number(a.channel_created_at) - Number(b.channel_created_at);
    if (byCreated !== 0) return byCreated;
    return a.insight_id.localeCompare(b.insight_id);
  });

  const appliedEffects: ValuationAppliedEffect[] = [];
  for (const stage of STAGE_ORDER) {
    const rows = sortedChannels.filter((row) => row.stage === stage);
    for (const row of rows) {
      const metricKey = normalizeRequiredString(row.metric_key, "metric_key");
      const operator = normalizeEffectOperator(row.operator);
      const timeline = pointsByChannel.get(row.channel_id) ?? [];
      const interpolated = interpolateEffect(timeline, asOfDate);
      if (interpolated === null) continue;
      const beforeValue = toFiniteNumber(adjustedMetrics[metricKey] ?? null);
      const afterValue = applyEffectOperator(beforeValue, operator, interpolated);
      adjustedMetrics[metricKey] = afterValue;
      appliedEffects.push({
        insightId: row.insight_id,
        insightTitle: row.insight_title,
        channelId: row.channel_id,
        metricKey,
        stage,
        operator,
        priority: Number(row.priority),
        value: interpolated,
        beforeValue,
        afterValue,
        scopes: scopesByInsight.get(row.insight_id) ?? []
      });
    }
    if (stage === "base" || stage === "first_order" || stage === "second_order") {
      recomputeDerivedOutputs(adjustedMetrics, formulaId, runtimeParamSchema);
    }
  }

  const requiredMetrics = normalizeStringArray(runtimeSource.metricSchema.required);
  const confidenceResult = computeConfidence(requiredMetrics, qualityByMetric, baseMetrics);
  const baseValue = pickPrimaryValue(baseMetrics, runtimeSource.spec.outputs.primaryValueKeys);
  const adjustedValue = pickPrimaryValue(
    adjustedMetrics,
    runtimeSource.spec.outputs.primaryValueKeys
  );
  const notApplicable = baseValue === null || adjustedValue === null;
  const reason =
    notApplicable && confidenceResult.reasons.length > 0
      ? confidenceResult.reasons[0]
      : notApplicable
        ? runtimeSource.spec.degradation.missingInputReason
        : null;
  const inputBreakdown: ValuationInputBreakdownItem[] = Object.keys(baseMetrics)
    .sort()
    .map((key) => ({
      key,
      kind: key.startsWith("output.")
        ? "derived"
        : subjectiveKeys.includes(key)
          ? "subjective"
          : "objective",
      value: toFiniteNumber(baseMetrics[key] ?? null),
      quality: qualityByMetric[key] ?? "fresh",
      source: subjectiveKeys.includes(key)
        ? overrideMap.has(key)
          ? "subjective.override"
          : "subjective.default"
        : "market.cache"
    }));
  const computedAt = Date.now();
  await upsertValuationSnapshot(businessDb, {
    symbol,
    asOfDate,
    methodKey: method.methodKey,
    baseMetrics,
    adjustedMetrics,
    appliedEffects,
    confidence: notApplicable ? "not_applicable" : confidenceResult.confidence,
    degradationReasons: confidenceResult.reasons,
    inputBreakdown,
    computedAt
  });

  return {
    symbol,
    asOfDate,
    methodKey: method.methodKey,
    methodVersionId: version.id,
    baseMetrics,
    adjustedMetrics,
    baseValue,
    adjustedValue,
    appliedEffects,
    confidence: notApplicable ? "not_applicable" : confidenceResult.confidence,
    degradationReasons: confidenceResult.reasons,
    inputBreakdown,
    notApplicable,
    reason,
    computedAt
  };
}

export async function computeValuationBySymbol(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: ComputeValuationBySymbolInput
): Promise<ComputeValuationBySymbolResult> {
  return await previewValuationBySymbol(businessDb, marketDb, input);
}

async function upsertValuationSnapshot(
  businessDb: SqliteDatabase,
  input: {
    symbol: string;
    asOfDate: string;
    methodKey: string;
    baseMetrics: Record<string, number | null>;
    adjustedMetrics: Record<string, number | null>;
    appliedEffects: ValuationAppliedEffect[];
    confidence: ValuationConfidence;
    degradationReasons: string[];
    inputBreakdown: ValuationInputBreakdownItem[];
    computedAt: number;
  }
): Promise<void> {
  const existing = await get<{ id: string }>(
    businessDb,
    `
      select id
      from valuation_adjustment_snapshots
      where symbol = ? and as_of_date = ? and method_key = ?
      limit 1
    `,
    [input.symbol, input.asOfDate, input.methodKey]
  );
  const id = existing?.id ?? crypto.randomUUID();
  await run(
    businessDb,
    `
      insert into valuation_adjustment_snapshots (
        id, symbol, as_of_date, method_key,
        base_metrics_json, adjusted_metrics_json, applied_effects_json,
        confidence, degradation_reasons_json, input_breakdown_json,
        created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(symbol, as_of_date, method_key) do update set
        base_metrics_json = excluded.base_metrics_json,
        adjusted_metrics_json = excluded.adjusted_metrics_json,
        applied_effects_json = excluded.applied_effects_json,
        confidence = excluded.confidence,
        degradation_reasons_json = excluded.degradation_reasons_json,
        input_breakdown_json = excluded.input_breakdown_json,
        updated_at = excluded.updated_at
    `,
    [
      id,
      input.symbol,
      input.asOfDate,
      input.methodKey,
      JSON.stringify(input.baseMetrics),
      JSON.stringify(input.adjustedMetrics),
      JSON.stringify(input.appliedEffects),
      input.confidence,
      JSON.stringify(input.degradationReasons),
      JSON.stringify(input.inputBreakdown),
      input.computedAt,
      input.computedAt
    ]
  );
}

async function resolveScopeRuleSymbols(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  rule: ScopeRuleRow
): Promise<Set<string>> {
  const scopeType = normalizeScopeType(rule.scope_type);
  const scopeKey = normalizeRequiredString(rule.scope_key, "scope_key");
  switch (scopeType) {
    case "symbol":
      return new Set([scopeKey]);
    case "tag": {
      const [providerSymbols, userSymbols] = await Promise.all([
        listInstrumentSymbolsByTag(marketDb, scopeKey, 50000),
        listInstrumentSymbolsByUserTag(businessDb, scopeKey)
      ]);
      return new Set([...providerSymbols, ...userSymbols]);
    }
    case "kind": {
      const rows = await all<{ symbol: string }>(
        marketDb,
        `
          select symbol
          from instrument_profiles
          where lower(kind) = lower(?)
          order by symbol asc
        `,
        [scopeKey]
      );
      return new Set(rows.map((row) => row.symbol));
    }
    case "asset_class": {
      const rows = await all<{ symbol: string }>(
        marketDb,
        `
          select symbol
          from instrument_profiles
          where lower(asset_class) = lower(?)
          order by symbol asc
        `,
        [scopeKey]
      );
      return new Set(rows.map((row) => row.symbol));
    }
    case "market": {
      const rows = await all<{ symbol: string }>(
        marketDb,
        `
          select symbol
          from instrument_profiles
          where upper(coalesce(market, '')) = upper(?)
          order by symbol asc
        `,
        [scopeKey]
      );
      return new Set(rows.map((row) => row.symbol));
    }
    case "watchlist": {
      if (scopeKey === "all") {
        const rows = await all<{ symbol: string }>(
          businessDb,
          `select symbol from watchlist_items order by symbol asc`
        );
        return new Set(rows.map((row) => row.symbol));
      }
      const rows = await all<{ symbol: string }>(
        businessDb,
        `
          select symbol
          from watchlist_items
          where group_name = ?
             or (? = 'default' and (group_name is null or group_name = ''))
          order by symbol asc
        `,
        [scopeKey, scopeKey]
      );
      return new Set(rows.map((row) => row.symbol));
    }
    case "domain":
      return resolveDomainSymbols(marketDb, scopeKey as DataDomainId);
    default:
      return new Set<string>();
  }
}

async function resolveDomainSymbols(
  marketDb: SqliteDatabase,
  domain: DataDomainId
): Promise<Set<string>> {
  const queryBySql = async (
    whereClause: string,
    params: Array<string | number> = []
  ): Promise<Set<string>> => {
    const rows = await all<{ symbol: string }>(
      marketDb,
      `
        select symbol
        from instrument_profiles
        where ${whereClause}
        order by symbol asc
      `,
      params
    );
    return new Set(rows.map((row) => row.symbol));
  };

  switch (domain) {
    case "stock":
      return queryBySql(`lower(kind) = 'stock'`);
    case "etf":
      return queryBySql(`lower(asset_class) = 'etf' or lower(kind) = 'fund'`);
    case "index":
      return queryBySql(`lower(kind) = 'index'`);
    case "public_fund":
      return queryBySql(`lower(kind) = 'fund'`);
    case "futures":
      return queryBySql(`lower(kind) = 'futures'`);
    case "spot":
      return queryBySql(`lower(kind) = 'spot'`);
    case "fx":
      return queryBySql(`lower(kind) = 'forex'`);
    case "hk_stock":
      return queryBySql(`lower(kind) = 'stock' and upper(coalesce(market, '')) = 'HK'`);
    case "us_stock":
      return queryBySql(`lower(kind) = 'stock' and upper(coalesce(market, '')) = 'US'`);
    case "bond": {
      const rows = await all<{ symbol: string }>(
        marketDb,
        `
          select distinct symbol
          from instrument_profile_tags
          where tag in ('kind:bond', 'domain:bond')
          order by symbol asc
        `
      );
      return new Set(rows.map((row) => row.symbol));
    }
    default:
      return new Set<string>();
  }
}

async function getProfileForSymbol(
  marketDb: SqliteDatabase,
  symbol: string
): Promise<ProfileLookupRow | null> {
  const profile = await get<ProfileLookupRow>(
    marketDb,
    `
      select kind, asset_class, market, tags_json
      from instrument_profiles
      where symbol = ?
      limit 1
    `,
    [symbol]
  );
  if (profile) return profile;
  const fallback = await get<{
    asset_class: string | null;
    market: string | null;
  }>(
    marketDb,
    `
      select asset_class, market
      from instruments
      where symbol = ?
      limit 1
    `,
    [symbol]
  );
  if (!fallback) return null;
  return {
    kind: null,
    asset_class: fallback.asset_class,
    market: fallback.market,
    tags_json: null
  };
}

async function resolveMethodKeyForSymbol(
  profile: ProfileLookupRow | null
): Promise<string> {
  const kind = normalizeOptionalString(profile?.kind)?.toLowerCase() ?? null;
  const assetClass = normalizeOptionalString(profile?.asset_class)?.toLowerCase() ?? null;
  const tags = parseJsonArray(profile?.tags_json ?? "");
  if (kind === "futures" || assetClass === "futures") return "builtin.futures.basis";
  if (kind === "spot" || assetClass === "spot") return "builtin.spot.carry";
  if (kind === "forex") return "builtin.forex.ppp";
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
  const isEtf =
    kind === "fund" ||
    assetClass === "etf" ||
    tagSet.has("domain:etf") ||
    tagSet.has("kind:etf");
  if (isEtf) return "builtin.etf.pe.relative.v1";
  if (kind === "stock" || assetClass === "stock") {
    return "builtin.stock.pe.relative.v1";
  }
  if (tags.some((tag) => tag.includes("bond"))) return "builtin.bond.yield";
  return "builtin.generic.factor";
}

function pickPreferredVersion(
  method: ValuationMethod,
  versions: ValuationMethodVersion[],
  asOfDate: string | null
): ValuationMethodVersion | null {
  if (versions.length === 0) return null;
  if (asOfDate) {
    const inWindow = versions
      .filter((version) => isDateInRange(asOfDate, version.effectiveFrom, version.effectiveTo))
      .sort((a, b) => b.version - a.version);
    if (inWindow.length > 0) return inWindow[0];
  }
  if (method.activeVersionId) {
    const active = versions.find((version) => version.id === method.activeVersionId);
    if (active) return active;
  }
  return [...versions].sort((a, b) => b.version - a.version)[0] ?? null;
}

function isDateInRange(
  date: string,
  start: string | null,
  end: string | null
): boolean {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function computeVolatility(
  closes: Array<{ date: string; close: number }>,
  windowSize: number
): number | null {
  if (closes.length < 2) return null;
  const returns: number[] = [];
  const maxPoints = Math.min(windowSize + 1, closes.length);
  for (let idx = 0; idx < maxPoints - 1; idx += 1) {
    const current = closes[idx].close;
    const prev = closes[idx + 1].close;
    if (!Number.isFinite(current) || !Number.isFinite(prev) || prev === 0) continue;
    returns.push(current / prev - 1);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (returns.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function resolveFormulaId(formulaManifest: Record<string, unknown>): string {
  const formulaId = formulaManifest?.formulaId;
  if (typeof formulaId === "string" && formulaId.trim()) return formulaId.trim();
  return "generic_factor_v1";
}

function recomputeDerivedOutputs(
  metrics: Record<string, number | null>,
  formulaId: string,
  paramSchema: Record<string, unknown> = {}
): void {
  const price = metrics["market.price"] ?? null;
  const momentum = metrics["factor.momentum.20d"] ?? 0;
  const vol = metrics["risk.volatility.20d"] ?? 0;
  const basis = metrics["factor.basis"] ?? 0;
  const carry = metrics["factor.carry.annualized"] ?? 0;
  const ppp = metrics["factor.ppp_gap"] ?? 0;
  const duration = metrics["risk.duration"] ?? 0;
  const yieldShift = metrics["risk.yield_shift"] ?? 0;
  const peTtm = metrics["valuation.pe_ttm"] ?? null;
  const pb = metrics["valuation.pb"] ?? null;
  const psTtm = metrics["valuation.ps_ttm"] ?? null;
  const evEbitdaTtm = metrics["valuation.ev_ebitda_ttm"] ?? null;

  const runtimeTargetMultiple = toFiniteNumber(metrics["target.multiple"] ?? null);
  const runtimeGrowthRate = toFiniteNumber(metrics["growthRate"] ?? null);
  const targetPe = toFiniteNumber(
    runtimeTargetMultiple ??
      paramSchema.targetPe ??
      (runtimeGrowthRate !== null ? runtimeGrowthRate * 100 : null)
  );
  const targetPb = toFiniteNumber(runtimeTargetMultiple ?? paramSchema.targetPb);
  const targetPs = toFiniteNumber(runtimeTargetMultiple ?? paramSchema.targetPs);
  const targetPeg = toFiniteNumber(paramSchema.targetPeg ?? 1);
  const targetEvEbitda = toFiniteNumber(
    runtimeTargetMultiple ?? paramSchema.targetEvEbitda
  );
  const targetEvSales = toFiniteNumber(
    runtimeTargetMultiple ?? paramSchema.targetEvSales
  );
  const dividendYield = toFiniteNumber(
    metrics["dividendYield"] ?? paramSchema.dividendYield ?? metrics["valuation.dv_ttm"]
  );
  const ddmGrowthRate = toFiniteNumber(runtimeGrowthRate ?? paramSchema.growthRate);
  const discountRate = toFiniteNumber(paramSchema.discountRate ?? 0.1);
  const fcffYield = toFiniteNumber(metrics["fcffYield"] ?? paramSchema.fcffYield);
  const highGrowthYears = Math.max(1, Number(paramSchema.highGrowthYears ?? 5));
  const highGrowthRate = toFiniteNumber(paramSchema.highGrowthRate ?? 0.1);
  const terminalGrowthRate = toFiniteNumber(paramSchema.terminalGrowthRate ?? 0.03);
  const wacc = toFiniteNumber(paramSchema.wacc ?? 0.1);
  const momentumWeight = toFiniteNumber(paramSchema.momentumWeight ?? 0.6);
  const volatilityPenalty = toFiniteNumber(paramSchema.volatilityPenalty ?? 0.3);
  const volatilityDiscountWeight = toFiniteNumber(paramSchema.volatilityDiscountWeight ?? 0.6);
  const impliedVolatility = toFiniteNumber(
    metrics["impliedVolatility"] ?? paramSchema.impliedVolatility
  );
  const vrpBeta = toFiniteNumber(paramSchema.vrpBeta ?? 0.8);
  const volatilityPercentile = toFiniteNumber(
    metrics["volatilityPercentile"] ?? paramSchema.volatilityPercentile
  );
  const percentileAnchor = toFiniteNumber(paramSchema.percentileAnchor ?? 0.5);
  const percentileSensitivity = toFiniteNumber(paramSchema.percentileSensitivity ?? 0.4);
  const expectedBasisPct = toFiniteNumber(paramSchema.expectedBasisPct ?? 0.01);
  const rollYieldPct = toFiniteNumber(paramSchema.rollYieldPct ?? 0.005);
  const reversionStrength = toFiniteNumber(paramSchema.reversionStrength ?? 0.35);
  const inventoryPremium = toFiniteNumber(paramSchema.inventoryPremium ?? 0.04);
  const carryDifferential = toFiniteNumber(paramSchema.carryDifferential ?? 0.01);
  const horizonYears = toFiniteNumber(paramSchema.horizonYears ?? 1);
  const reerGap = toFiniteNumber(paramSchema.reerGap ?? 0.03);
  const reversionSpeed = toFiniteNumber(paramSchema.reversionSpeed ?? 0.45);
  const spreadDuration = toFiniteNumber(paramSchema.duration ?? 6);
  const spreadChange = toFiniteNumber(paramSchema.spreadChange ?? 0.002);
  const convexity = toFiniteNumber(paramSchema.convexity ?? 0.5);
  const realRateGap = toFiniteNumber(paramSchema.realRateGap ?? -0.005);
  const rateSensitivity = toFiniteNumber(paramSchema.sensitivity ?? 4);

  let fairValue: number | null = price;
  switch (formulaId) {
    case "equity_factor_v1":
      if (price !== null) {
        fairValue =
          price * (1 + clamp(momentum, -0.5, 0.5)) * (1 - clamp(vol, -1, 1) * 0.2);
      }
      break;
    case "futures_basis_v1":
      fairValue = price === null ? null : price + basis;
      break;
    case "futures_trend_vol_v1":
      fairValue =
        price === null || momentumWeight === null || volatilityPenalty === null
          ? null
          : price *
            (1 +
              clamp(momentum, -0.8, 0.8) * momentumWeight -
              clamp(vol, -1, 1) * volatilityPenalty);
      break;
    case "futures_term_structure_v1":
      fairValue =
        price === null || expectedBasisPct === null || rollYieldPct === null
          ? null
          : price * (1 + expectedBasisPct + rollYieldPct);
      break;
    case "volatility_discount_v1":
      fairValue =
        price === null || volatilityDiscountWeight === null
          ? null
          : price * Math.max(0.05, 1 - clamp(vol, 0, 2) * volatilityDiscountWeight);
      break;
    case "volatility_risk_premium_v1": {
      const rv = toFiniteNumber(vol);
      const iv = impliedVolatility;
      fairValue =
        price === null || rv === null || iv === null || vrpBeta === null
          ? null
          : price * (1 + vrpBeta * (iv - rv));
      break;
    }
    case "volatility_percentile_band_v1":
      fairValue =
        price === null ||
        volatilityPercentile === null ||
        percentileAnchor === null ||
        percentileSensitivity === null
          ? null
          : price * (1 - percentileSensitivity * (volatilityPercentile - percentileAnchor));
      break;
    case "spot_carry_v1":
      fairValue = price === null ? null : price * (1 + carry);
      break;
    case "spot_mean_reversion_v1":
      fairValue =
        price === null || reversionStrength === null
          ? null
          : price * (1 - clamp(momentum, -0.8, 0.8) * reversionStrength);
      break;
    case "spot_inventory_risk_v1":
      fairValue =
        price === null || inventoryPremium === null || volatilityPenalty === null
          ? null
          : price * (1 + inventoryPremium - clamp(vol, -1, 1) * volatilityPenalty);
      break;
    case "forex_ppp_v1":
      fairValue = price === null ? null : price * (1 + ppp);
      break;
    case "forex_rate_differential_v1":
      fairValue =
        price === null || carryDifferential === null || horizonYears === null
          ? null
          : price * (1 + carryDifferential * horizonYears);
      break;
    case "forex_reer_reversion_v1":
      fairValue =
        price === null || reerGap === null || reversionSpeed === null
          ? null
          : price * (1 + reerGap - clamp(momentum, -0.8, 0.8) * reversionSpeed);
      break;
    case "bond_yield_v1":
      fairValue = price === null ? null : price * (1 - duration * yieldShift);
      break;
    case "bond_spread_duration_v1":
      fairValue =
        price === null || spreadDuration === null || spreadChange === null || convexity === null
          ? null
          : price *
            (1 - spreadDuration * spreadChange + convexity * spreadChange * spreadChange);
      break;
    case "bond_real_rate_v1":
      fairValue =
        price === null || realRateGap === null || rateSensitivity === null
          ? null
          : price * (1 - rateSensitivity * realRateGap);
      break;
    case "stock_pe_relative_v1":
      fairValue =
        price === null || peTtm === null || peTtm === 0 || targetPe === null
          ? null
          : price * (targetPe / peTtm);
      break;
    case "stock_pb_relative_v1":
      fairValue =
        price === null || pb === null || pb === 0 || targetPb === null
          ? null
          : price * (targetPb / pb);
      break;
    case "stock_ps_relative_v1":
      fairValue =
        price === null || psTtm === null || psTtm === 0 || targetPs === null
          ? null
          : price * (targetPs / psTtm);
      break;
    case "stock_peg_relative_v1": {
      const growth = toFiniteNumber(runtimeGrowthRate ?? paramSchema.growthRate);
      const target =
        growth !== null ? growth * 100 * (targetPeg ?? 1) : targetPe;
      fairValue =
        price === null || peTtm === null || peTtm === 0 || target === null
          ? null
          : price * (target / peTtm);
      break;
    }
    case "stock_ev_ebitda_relative_v1":
      fairValue =
        price === null ||
        evEbitdaTtm === null ||
        evEbitdaTtm === 0 ||
        targetEvEbitda === null
          ? null
          : price * (targetEvEbitda / evEbitdaTtm);
      break;
    case "stock_ev_sales_relative_v1":
      fairValue =
        price === null || psTtm === null || psTtm === 0 || targetEvSales === null
          ? null
          : price * (targetEvSales / psTtm);
      break;
    case "stock_ddm_gordon_v1": {
      const d = dividendYield;
      const g = ddmGrowthRate;
      const r = discountRate;
      fairValue =
        price === null || d === null || g === null || r === null || r <= g
          ? null
          : price * (d * (1 + g)) / (r - g);
      break;
    }
    case "stock_fcff_twostage_v1": {
      const y = fcffYield;
      const g1 = highGrowthRate;
      const g2 = terminalGrowthRate;
      const discount = wacc;
      if (
        price === null ||
        y === null ||
        g1 === null ||
        g2 === null ||
        discount === null ||
        discount <= g2
      ) {
        fairValue = null;
      } else {
        const stage1 = y * (1 + g1) * highGrowthYears;
        const terminal = (y * (1 + g2)) / (discount - g2);
        fairValue = price * (stage1 + terminal) / Math.max(1, highGrowthYears + 1);
      }
      break;
    }
    default:
      if (price !== null) {
        fairValue =
          price * (1 + clamp(momentum, -0.5, 0.5) * 0.5) * (1 - clamp(vol, -1, 1) * 0.15);
      }
      break;
  }

  metrics["output.fair_value"] = toFiniteNumber(fairValue);
  const returnGap =
    fairValue !== null && price !== null && price !== 0 ? fairValue / price - 1 : null;
  metrics["output.return_gap"] = toFiniteNumber(returnGap);
}

function applyEffectOperator(
  current: number | null,
  operator: InsightEffectOperator,
  value: number
): number | null {
  switch (operator) {
    case "set":
      return value;
    case "add":
      return (current ?? 0) + value;
    case "mul":
      return (current ?? 1) * value;
    case "min":
      return current === null ? value : Math.min(current, value);
    case "max":
      return current === null ? value : Math.max(current, value);
    default:
      return current;
  }
}

function interpolateEffect(
  points: Array<{ date: string; value: number }>,
  asOfDate: string
): number | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (asOfDate < first.date || asOfDate > last.date) return null;
  if (asOfDate === first.date) return first.value;
  if (asOfDate === last.date) return last.value;
  for (let idx = 0; idx < sorted.length - 1; idx += 1) {
    const left = sorted[idx];
    const right = sorted[idx + 1];
    if (asOfDate === left.date) return left.value;
    if (asOfDate === right.date) return right.value;
    if (asOfDate > left.date && asOfDate < right.date) {
      const leftDay = toEpochDay(left.date);
      const rightDay = toEpochDay(right.date);
      const targetDay = toEpochDay(asOfDate);
      if (leftDay === null || rightDay === null || targetDay === null || rightDay <= leftDay) {
        return null;
      }
      const ratio = (targetDay - leftDay) / (rightDay - leftDay);
      return left.value + (right.value - left.value) * ratio;
    }
  }
  return null;
}

function pickPrimaryValue(
  metrics: Record<string, number | null>,
  primaryValueKeys?: string[]
): number | null {
  const keys =
    primaryValueKeys && primaryValueKeys.length > 0
      ? primaryValueKeys
      : PRIMARY_VALUE_KEYS;
  for (const key of keys) {
    const value = toFiniteNumber(metrics[key] ?? null);
    if (value !== null) return value;
  }
  return null;
}

function toInsightFact(row: InsightFactRow): InsightFact {
  return {
    id: row.id,
    content: row.content,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toInsight(row: InsightRow): Insight {
  return {
    id: row.id,
    title: row.title,
    thesis: row.thesis ?? "",
    status: normalizeInsightStatus(row.status),
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    tags: parseJsonArray(row.tags_json),
    meta: parseJsonObject(row.meta_json),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
    deletedAt: toFiniteInteger(row.deleted_at)
  };
}

function toScopeRule(row: ScopeRuleRow): InsightScopeRule {
  return {
    id: row.id,
    insightId: row.insight_id,
    scopeType: normalizeScopeType(row.scope_type),
    scopeKey: row.scope_key,
    mode: normalizeScopeMode(row.mode),
    enabled: Number(row.enabled) === 1,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toEffectChannel(row: EffectChannelRow): InsightEffectChannel {
  return {
    id: row.id,
    insightId: row.insight_id,
    methodKey: row.method_key,
    metricKey: row.metric_key,
    stage: normalizeEffectStage(row.stage),
    operator: normalizeEffectOperator(row.operator),
    priority: Number(row.priority ?? 0),
    enabled: Number(row.enabled) === 1,
    meta: parseJsonObject(row.meta_json),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toEffectPoint(row: EffectPointRow): InsightEffectPoint {
  return {
    id: row.id,
    channelId: row.channel_id,
    effectDate: row.effect_date,
    effectValue: Number(row.effect_value),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toTargetExclusion(row: TargetExclusionRow): InsightTargetExclusion {
  return {
    id: row.id,
    insightId: row.insight_id,
    symbol: row.symbol,
    reason: row.reason ?? null,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toMaterializedTarget(row: MaterializedTargetRow): InsightMaterializedTarget {
  return {
    id: row.id,
    insightId: row.insight_id,
    symbol: row.symbol,
    sourceScopeType: normalizeScopeType(row.source_scope_type),
    sourceScopeKey: row.source_scope_key,
    materializedAt: Number(row.materialized_at ?? 0)
  };
}

function toValuationMethod(row: ValuationMethodRow): ValuationMethod {
  return {
    id: row.id,
    methodKey: row.method_key,
    name: row.name,
    description: row.description ?? null,
    isBuiltin: Number(row.is_builtin) === 1,
    status: row.status === "archived" ? "archived" : "active",
    assetScope: normalizeAssetScope(parseJsonObject(row.asset_scope_json)),
    activeVersionId: row.active_version_id ?? null,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toValuationMethodVersion(
  row: ValuationMethodVersionRow,
  method?: ValuationMethod
): ValuationMethodVersion {
  const formulaManifest = normalizeRecord(parseJsonObject(row.formula_manifest_json));
  const formulaId = resolveFormulaId(formulaManifest);
  const inputSchema = normalizeInputSchema(parseJsonArrayOfObjects(row.input_schema_json ?? "[]"));
  const fallbackInputSchema =
    inputSchema.length > 0 ? inputSchema : buildDefaultInputSchemaForFormula(formulaId);
  const paramSchema = normalizeRecord(parseJsonObject(row.param_schema_json));
  const metricSchema = normalizeRecord(parseJsonObject(row.metric_schema_json));
  const fallbackScope: ValuationMethodAssetScope = {
    kinds: [],
    assetClasses: [],
    markets: [],
    domains: []
  };
  const spec = normalizeValuationMethodSpecV2(
    formulaManifest.specV2,
    {
      methodKey: method?.methodKey ?? row.method_id,
      version: Number(row.version ?? 0),
      assetScope: method?.assetScope ?? fallbackScope,
      formulaManifest,
      inputSchema: fallbackInputSchema,
      paramSchema,
      metricSchema
    }
  );
  const normalizedFormulaManifest: Record<string, unknown> = {
    ...stripSpecFromFormulaManifest(formulaManifest),
    formulaId: spec.formula.formulaId,
    locked: spec.formula.locked,
    specV2: spec
  };
  if (spec.formula.executorRef) {
    normalizedFormulaManifest.executorRef = spec.formula.executorRef;
  }
  return {
    id: row.id,
    methodId: row.method_id,
    version: Number(row.version ?? 0),
    effectiveFrom: row.effective_from ?? null,
    effectiveTo: row.effective_to ?? null,
    graph: buildMetricGraphFromSpec(spec),
    paramSchema: spec.parameters,
    metricSchema: {
      ...metricSchema,
      required: spec.outputs.required,
      outputs: spec.outputs.outputs,
      primaryValueKeys: spec.outputs.primaryValueKeys
    },
    formulaManifest: normalizedFormulaManifest,
    inputSchema: spec.inputs.fields,
    spec,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toValuationObjectiveMetricSnapshot(
  row: ValuationObjectiveMetricSnapshotRow
): ValuationObjectiveMetricSnapshot {
  return {
    id: row.id,
    symbol: row.symbol,
    methodKey: row.method_key,
    metricKey: row.metric_key,
    asOfDate: row.as_of_date,
    value: toFiniteNumber(row.value),
    quality: normalizeMetricQuality(row.quality),
    source: row.source ?? null,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toValuationSubjectiveDefault(
  row: ValuationSubjectiveDefaultRow
): ValuationSubjectiveDefault {
  return {
    id: row.id,
    methodKey: row.method_key,
    inputKey: row.input_key,
    market: row.market ?? null,
    industryTag: row.industry_tag ?? null,
    value: Number(row.value),
    source: row.source ?? null,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toValuationSubjectiveOverride(
  row: ValuationSubjectiveOverrideRow
): ValuationSubjectiveOverride {
  return {
    id: row.id,
    symbol: row.symbol,
    methodKey: row.method_key,
    inputKey: row.input_key,
    value: Number(row.value),
    note: row.note ?? null,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
  };
}

function toValuationRefreshRunStatus(row: ValuationRefreshRunRow): ValuationRefreshRunStatus {
  const status =
    row.status === "running" ||
    row.status === "success" ||
    row.status === "partial" ||
    row.status === "failed"
      ? row.status
      : "failed";
  return {
    runId: row.id,
    status,
    startedAt: Number(row.started_at ?? 0),
    finishedAt: toFiniteInteger(row.finished_at),
    totalSymbols: Number(row.total_symbols ?? 0),
    refreshed: Number(row.refreshed ?? 0),
    failed: Number(row.failed ?? 0),
    message: row.message ?? null
  };
}

function normalizeInsightStatusFilter(
  value: ListInsightsInput["status"]
): InsightStatus | "all" {
  if (value === null || value === undefined || value === "all") return "all";
  return normalizeInsightStatus(value);
}

function normalizeInsightStatus(value: unknown): InsightStatus {
  const status = normalizeRequiredString(String(value), "status") as InsightStatus;
  if (!INSIGHT_STATUSES.has(status)) {
    throw new Error("status must be draft/active/archived/deleted.");
  }
  return status;
}

function normalizeScopeType(value: unknown): InsightScopeType {
  const scopeType = normalizeRequiredString(String(value), "scopeType") as InsightScopeType;
  if (!SCOPE_TYPES.has(scopeType)) {
    throw new Error("scopeType is invalid.");
  }
  return scopeType;
}

function normalizeScopeMode(value: unknown): InsightScopeMode {
  const mode = normalizeRequiredString(String(value), "mode") as InsightScopeMode;
  if (!SCOPE_MODES.has(mode)) {
    throw new Error("mode is invalid.");
  }
  return mode;
}

function normalizeEffectStage(value: unknown): InsightEffectStage {
  const stage = normalizeRequiredString(String(value), "stage") as InsightEffectStage;
  if (!EFFECT_STAGES.has(stage)) {
    throw new Error("stage is invalid.");
  }
  return stage;
}

function stageIndexFromString(value: string): number {
  const stage = normalizeEffectStage(value);
  return STAGE_ORDER_INDEX[stage];
}

function normalizeEffectOperator(value: unknown): InsightEffectOperator {
  const operator = normalizeRequiredString(String(value), "operator") as InsightEffectOperator;
  if (!EFFECT_OPERATORS.has(operator)) {
    throw new Error("operator is invalid.");
  }
  return operator;
}

function normalizePriority(value: unknown): number {
  if (value === undefined || value === null) return 100;
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error("priority must be a finite number.");
  return Math.floor(num);
}

function normalizePaginationLimit(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(2000, Math.floor(num)));
}

function normalizePaginationOffset(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function normalizeMethodKey(value: unknown, field: string): string {
  const key = normalizeRequiredString(value, field);
  if (!METHOD_KEY_RE.test(key)) {
    throw new Error(`${field} is invalid.`);
  }
  return key;
}

function normalizeMetricQuality(value: unknown): ValuationMetricQuality {
  const raw = normalizeOptionalString(value) ?? "missing";
  return VALUATION_QUALITY_SET.has(raw as ValuationMetricQuality)
    ? (raw as ValuationMetricQuality)
    : "missing";
}

function normalizeValuationMetricSchedulerConfig(
  input: Partial<ValuationMetricSchedulerConfig>
): ValuationMetricSchedulerConfig {
  const intervalMinutes = Number(input.intervalMinutes);
  const staleAfterMinutes = Number(input.staleAfterMinutes);
  return {
    enabled: Boolean(input.enabled ?? DEFAULT_VALUATION_SCHEDULER_CONFIG.enabled),
    intervalMinutes:
      Number.isFinite(intervalMinutes) && intervalMinutes > 0
        ? Math.min(24 * 60, Math.floor(intervalMinutes))
        : DEFAULT_VALUATION_SCHEDULER_CONFIG.intervalMinutes,
    staleAfterMinutes:
      Number.isFinite(staleAfterMinutes) && staleAfterMinutes > 0
        ? Math.min(14 * 24 * 60, Math.floor(staleAfterMinutes))
        : DEFAULT_VALUATION_SCHEDULER_CONFIG.staleAfterMinutes
  };
}

function normalizeAssetScope(value: unknown): ValuationMethodAssetScope {
  const obj = normalizeRecord(value);
  const kinds = normalizeStringArray(obj.kinds as unknown);
  const assetClasses = normalizeStringArray(obj.assetClasses as unknown);
  const markets = normalizeStringArray(obj.markets as unknown).map((item) => item.toUpperCase());
  const domains = normalizeStringArray(obj.domains as unknown) as DataDomainId[];
  return { kinds, assetClasses, markets, domains };
}

function normalizeMetricGraph(value: unknown): ValuationMetricNode[] {
  if (!Array.isArray(value)) {
    throw new Error("graph must be an array.");
  }
  return value.map((raw, index) => {
    const node = normalizeRecord(raw);
    const key = normalizeRequiredString(node.key, `graph[${index}].key`);
    const label = normalizeRequiredString(node.label, `graph[${index}].label`);
    const layerRaw = normalizeRequiredString(node.layer, `graph[${index}].layer`);
    const layer = (
      ["top", "first_order", "second_order", "output", "risk"].includes(layerRaw)
        ? layerRaw
        : "top"
    ) as ValuationMetricNode["layer"];
    const unitRaw = normalizeOptionalString(node.unit) ?? "unknown";
    const unit = (
      ["number", "pct", "currency", "score", "unknown"].includes(unitRaw)
        ? unitRaw
        : "unknown"
    ) as ValuationMetricNode["unit"];
    const dependsOn = normalizeStringArray(node.dependsOn as unknown);
    const formulaId = normalizeOptionalString(node.formulaId) ?? "generic_factor_v1";
    const editable = Boolean(node.editable ?? true);
    return {
      key,
      label,
      layer,
      unit,
      dependsOn,
      formulaId,
      editable
    };
  });
}

function normalizeInputSchema(value: unknown): ValuationMethodInputField[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const node = normalizeRecord(raw);
    const key = normalizeRequiredString(node.key, `inputSchema[${index}].key`);
    const label = normalizeRequiredString(node.label, `inputSchema[${index}].label`);
    const kindRaw = normalizeRequiredString(node.kind, `inputSchema[${index}].kind`);
    const kind = (
      ["objective", "subjective", "derived"].includes(kindRaw)
        ? kindRaw
        : "subjective"
    ) as ValuationMethodInputField["kind"];
    const unitRaw = normalizeOptionalString(node.unit) ?? "unknown";
    const unit = (
      ["number", "pct", "currency", "score", "unknown"].includes(unitRaw)
        ? unitRaw
        : "unknown"
    ) as ValuationMethodInputField["unit"];
    const editable = Boolean(node.editable ?? kind !== "derived");
    const objectiveSource = normalizeOptionalString(node.objectiveSource);
    const defaultPolicyRaw = normalizeOptionalString(node.defaultPolicy) ?? "none";
    const defaultPolicy = (
      [
        "none",
        "industry_median",
        "market_median",
        "global_median",
        "constant"
      ].includes(defaultPolicyRaw)
        ? defaultPolicyRaw
        : "none"
    ) as ValuationMethodInputField["defaultPolicy"];
    const defaultValue = toFiniteNumber(node.defaultValue ?? null);
    const displayOrder = Number.isFinite(Number(node.displayOrder))
      ? Number(node.displayOrder)
      : index + 1;
    const description = normalizeOptionalString(node.description);
    return {
      key,
      label,
      kind,
      unit,
      editable,
      objectiveSource: objectiveSource ?? null,
      defaultPolicy,
      defaultValue,
      displayOrder,
      description: description ?? null
    };
  });
}

function stripSpecFromFormulaManifest(
  formulaManifest: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...normalizeRecord(formulaManifest) };
  delete next.specV2;
  return next;
}

function buildValuationMethodSpecFromLegacy(input: {
  methodKey: string;
  version: number;
  assetScope: ValuationMethodAssetScope;
  formulaManifest: Record<string, unknown>;
  inputSchema: ValuationMethodInputField[];
  paramSchema: Record<string, unknown>;
  metricSchema: Record<string, unknown>;
}): ValuationMethodSpecV2 {
  const formulaManifest = stripSpecFromFormulaManifest(input.formulaManifest);
  const formulaId = resolveFormulaId(formulaManifest);
  const locked = Boolean(formulaManifest.locked ?? true);
  const executorRef = normalizeOptionalString(formulaManifest.executorRef);
  const required = normalizeStringArray(input.metricSchema.required);
  const outputs = normalizeStringArray(input.metricSchema.outputs);
  const primaryValueKeys =
    normalizeStringArray(input.metricSchema.primaryValueKeys).length > 0
      ? normalizeStringArray(input.metricSchema.primaryValueKeys)
      : [...PRIMARY_VALUE_KEYS];
  return {
    schemaVersion: 2,
    meta: {
      methodKey: input.methodKey,
      version: Number.isFinite(Number(input.version)) ? Number(input.version) : 1,
      assetScope: input.assetScope
    },
    formula: {
      formulaId,
      executorRef: executorRef ?? null,
      locked
    },
    inputs: {
      fields: normalizeInputSchema(input.inputSchema)
    },
    parameters: normalizeRecord(input.paramSchema),
    outputs: {
      required,
      outputs: outputs.length > 0 ? outputs : ["output.fair_value", "output.return_gap"],
      primaryValueKeys
    },
    quality: {
      allowSubjectiveFallback: true
    },
    confidence: {
      minFreshRatio: 0.6
    },
    degradation: {
      missingInputReason: "关键输入缺失",
      missingPriceReason: "缺少可用价格数据"
    }
  };
}

function normalizeValuationMethodSpecV2(
  value: unknown,
  fallback: {
    methodKey: string;
    version: number;
    assetScope: ValuationMethodAssetScope;
    formulaManifest: Record<string, unknown>;
    inputSchema: ValuationMethodInputField[];
    paramSchema: Record<string, unknown>;
    metricSchema: Record<string, unknown>;
  }
): ValuationMethodSpecV2 {
  const fallbackSpec = buildValuationMethodSpecFromLegacy(fallback);
  const record = normalizeRecord(value);
  if (Object.keys(record).length === 0) return fallbackSpec;

  const formula = normalizeRecord(record.formula);
  const inputs = normalizeRecord(record.inputs);
  const outputs = normalizeRecord(record.outputs);
  const quality = normalizeRecord(record.quality);
  const confidence = normalizeRecord(record.confidence);
  const degradation = normalizeRecord(record.degradation);

  const metaMethodKey = fallbackSpec.meta.methodKey;
  const metaVersion = fallbackSpec.meta.version;
  const metaAssetScope = fallbackSpec.meta.assetScope;

  const formulaId =
    normalizeOptionalString(formula.formulaId) ?? fallbackSpec.formula.formulaId;
  const executorRef =
    normalizeOptionalString(formula.executorRef) ?? fallbackSpec.formula.executorRef;
  const locked = Boolean(formula.locked ?? fallbackSpec.formula.locked);

  const rawInputFields = Array.isArray(inputs.fields) ? inputs.fields : fallbackSpec.inputs.fields;
  const normalizedInputFields = normalizeInputSchema(rawInputFields);
  const fields =
    normalizedInputFields.length > 0
      ? normalizedInputFields
      : fallbackSpec.inputs.fields;

  const parameters = normalizeRecord(record.parameters);
  const finalParameters =
    Object.keys(parameters).length > 0 ? parameters : fallbackSpec.parameters;

  const required = normalizeStringArray(outputs.required);
  const outputKeys = normalizeStringArray(outputs.outputs);
  const primaryValueKeys = normalizeStringArray(outputs.primaryValueKeys);

  const minFreshRatioRaw = Number(confidence.minFreshRatio);
  const minFreshRatio = Number.isFinite(minFreshRatioRaw)
    ? Math.min(1, Math.max(0, minFreshRatioRaw))
    : fallbackSpec.confidence.minFreshRatio;

  return {
    schemaVersion: 2,
    meta: {
      methodKey: metaMethodKey,
      version: metaVersion,
      assetScope: metaAssetScope
    },
    formula: {
      formulaId,
      executorRef,
      locked
    },
    inputs: {
      fields
    },
    parameters: finalParameters,
    outputs: {
      required: required.length > 0 ? required : fallbackSpec.outputs.required,
      outputs: outputKeys.length > 0 ? outputKeys : fallbackSpec.outputs.outputs,
      primaryValueKeys:
        primaryValueKeys.length > 0
          ? primaryValueKeys
          : fallbackSpec.outputs.primaryValueKeys
    },
    quality: {
      allowSubjectiveFallback: Boolean(
        quality.allowSubjectiveFallback ?? fallbackSpec.quality.allowSubjectiveFallback
      )
    },
    confidence: {
      minFreshRatio
    },
    degradation: {
      missingInputReason:
        normalizeOptionalString(degradation.missingInputReason) ??
        fallbackSpec.degradation.missingInputReason,
      missingPriceReason:
        normalizeOptionalString(degradation.missingPriceReason) ??
        fallbackSpec.degradation.missingPriceReason
    }
  };
}

function compileValuationRuntimeSource(
  method: ValuationMethod,
  version: ValuationMethodVersion
): CompiledValuationRuntimeSource {
  const formulaManifest = normalizeRecord(version.formulaManifest);
  const formulaId = resolveFormulaId(formulaManifest);
  const fallbackInputSchema =
    version.inputSchema.length > 0
      ? version.inputSchema
      : buildDefaultInputSchemaForFormula(formulaId);
  const fallbackParamSchema = normalizeRecord(version.paramSchema);
  const fallbackMetricSchema = normalizeRecord(version.metricSchema);
  const embeddedSpec = formulaManifest.specV2;
  const normalizedSpec = normalizeValuationMethodSpecV2(
    version.spec ?? embeddedSpec,
    {
      methodKey: method.methodKey,
      version: version.version,
      assetScope: method.assetScope,
      formulaManifest,
      inputSchema: fallbackInputSchema,
      paramSchema: fallbackParamSchema,
      metricSchema: fallbackMetricSchema
    }
  );

  const compiledFormulaManifest: Record<string, unknown> = {
    ...stripSpecFromFormulaManifest(formulaManifest),
    formulaId: normalizedSpec.formula.formulaId,
    locked: normalizedSpec.formula.locked,
    specV2: normalizedSpec
  };
  if (normalizedSpec.formula.executorRef) {
    compiledFormulaManifest.executorRef = normalizedSpec.formula.executorRef;
  }

  return {
    formulaId: normalizedSpec.formula.formulaId,
    formulaManifest: compiledFormulaManifest,
    inputSchema: normalizedSpec.inputs.fields,
    paramSchema: normalizeRecord(normalizedSpec.parameters),
    metricSchema: {
      ...fallbackMetricSchema,
      required: normalizedSpec.outputs.required,
      outputs: normalizedSpec.outputs.outputs,
      primaryValueKeys: normalizedSpec.outputs.primaryValueKeys
    },
    spec: normalizedSpec
  };
}

function inferGraphLayerFromKeyAndKind(
  key: string,
  kind?: ValuationMethodInputField["kind"]
): ValuationMetricNode["layer"] {
  const normalizedKey = key.toLowerCase();
  if (
    normalizedKey.startsWith("output.") ||
    normalizedKey.endsWith(".fair_value") ||
    normalizedKey.endsWith(".return_gap")
  ) {
    return "output";
  }
  if (normalizedKey.startsWith("risk.")) {
    return "risk";
  }
  if (kind === "objective") return "top";
  if (kind === "subjective") return "first_order";
  if (kind === "derived") return "second_order";
  if (normalizedKey.startsWith("market.")) return "top";
  if (normalizedKey.startsWith("factor.")) return "first_order";
  if (normalizedKey.startsWith("valuation.") || normalizedKey.startsWith("liquidity.")) {
    return "second_order";
  }
  return "top";
}

function inferGraphUnitFromKey(key: string): ValuationMetricNode["unit"] {
  const normalizedKey = key.toLowerCase();
  if (
    normalizedKey.endsWith(".price") ||
    normalizedKey.includes("fair_value")
  ) {
    return "currency";
  }
  if (
    normalizedKey.includes("return_gap") ||
    normalizedKey.includes("volatility") ||
    normalizedKey.includes("momentum") ||
    normalizedKey.includes("yield") ||
    normalizedKey.includes("rate") ||
    normalizedKey.includes("carry") ||
    normalizedKey.includes("basis") ||
    normalizedKey.includes("spread") ||
    normalizedKey.includes("gap") ||
    normalizedKey.includes("pct")
  ) {
    return "pct";
  }
  if (normalizedKey.includes("score")) return "score";
  return "number";
}

function buildGraphLabelFromKey(key: string): string {
  switch (key) {
    case "market.price":
      return "市场价格";
    case "output.fair_value":
      return "公允价值";
    case "output.return_gap":
      return "收益偏离";
    default:
      return key;
  }
}

function buildMetricGraphFromSpec(spec: ValuationMethodSpecV2): ValuationMetricNode[] {
  const formulaId = normalizeOptionalString(spec.formula.formulaId) ?? "generic_factor_v1";
  const normalizedFields = normalizeInputSchema(spec.inputs.fields).sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.key.localeCompare(b.key);
  });
  const inputKeys = normalizedFields.map((field) => field.key);
  const sourceKeys = normalizedFields
    .filter((field) => field.kind !== "derived")
    .map((field) => field.key);
  const derivedKeys = normalizedFields
    .filter((field) => field.kind === "derived")
    .map((field) => field.key);
  const nodes: ValuationMetricNode[] = normalizedFields.map((field) => ({
    key: field.key,
    label: field.label,
    layer: inferGraphLayerFromKeyAndKind(field.key, field.kind),
    unit: field.unit,
    dependsOn: field.kind === "derived" ? sourceKeys : [],
    formulaId,
    editable: field.kind !== "derived" && Boolean(field.editable)
  }));

  const completionKeys = Array.from(
    new Set([
      ...normalizeStringArray(spec.outputs.required),
      ...normalizeStringArray(spec.outputs.outputs),
      ...normalizeStringArray(spec.outputs.primaryValueKeys)
    ])
  );
  for (const key of completionKeys) {
    if (!key || inputKeys.includes(key) || nodes.some((node) => node.key === key)) continue;
    nodes.push({
      key,
      label: buildGraphLabelFromKey(key),
      layer: inferGraphLayerFromKeyAndKind(key, undefined),
      unit: inferGraphUnitFromKey(key),
      dependsOn: derivedKeys.length > 0 ? derivedKeys : sourceKeys,
      formulaId,
      editable: false
    });
  }

  const layerOrder: Record<ValuationMetricNode["layer"], number> = {
    top: 0,
    first_order: 1,
    second_order: 2,
    output: 3,
    risk: 4
  };
  return normalizeMetricGraph(
    nodes
      .map((node) => ({
        ...node,
        dependsOn: Array.from(new Set(node.dependsOn)).filter((key) => key !== node.key)
      }))
      .sort((a, b) => {
        const byLayer = layerOrder[a.layer] - layerOrder[b.layer];
        if (byLayer !== 0) return byLayer;
        return a.key.localeCompare(b.key);
      })
  );
}

function canonicalizeGraphForCompare(
  graph: ValuationMetricNode[]
): Array<{
  key: string;
  layer: ValuationMetricNode["layer"];
  unit: ValuationMetricNode["unit"];
  formulaId: string;
  editable: boolean;
  dependsOn: string[];
}> {
  return graph
    .map((node) => ({
      key: node.key,
      layer: node.layer,
      unit: node.unit,
      formulaId: normalizeOptionalString(node.formulaId) ?? "",
      editable: Boolean(node.editable),
      dependsOn: Array.from(new Set(node.dependsOn)).sort()
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function assertGraphConsistentWithSpec(
  providedGraph: ValuationMetricNode[],
  derivedGraph: ValuationMetricNode[]
): void {
  if (providedGraph.length === 0) return;
  const provided = canonicalizeGraphForCompare(providedGraph);
  const derived = canonicalizeGraphForCompare(derivedGraph);
  if (JSON.stringify(provided) !== JSON.stringify(derived)) {
    throw new Error("指标层级图与输入定义不一致，请先同步后再发布。");
  }
}

function buildDefaultMetricGraph(formulaId: string): ValuationMetricNode[] {
  return normalizeMetricGraph([
    {
      key: "market.price",
      label: "市场价格",
      layer: "top",
      unit: "currency",
      dependsOn: [],
      formulaId,
      editable: false
    },
    {
      key: "factor.momentum.20d",
      label: "20日动量",
      layer: "first_order",
      unit: "pct",
      dependsOn: ["market.price"],
      formulaId,
      editable: true
    },
    {
      key: "risk.volatility.20d",
      label: "20日波动率",
      layer: "first_order",
      unit: "pct",
      dependsOn: ["market.price"],
      formulaId,
      editable: true
    },
    {
      key: "output.fair_value",
      label: "估计公允值",
      layer: "output",
      unit: "currency",
      dependsOn: ["factor.momentum.20d", "risk.volatility.20d"],
      formulaId,
      editable: false
    },
    {
      key: "output.return_gap",
      label: "收益偏离",
      layer: "output",
      unit: "pct",
      dependsOn: ["output.fair_value", "market.price"],
      formulaId,
      editable: false
    }
  ]);
}

function buildDefaultInputSchemaForFormula(
  formulaId: string
): ValuationMethodInputField[] {
  const common = normalizeInputSchema([
    {
      key: "market.price",
      label: "市场价格",
      kind: "objective",
      unit: "currency",
      editable: false,
      objectiveSource: "market.daily_prices.close",
      defaultPolicy: "none",
      defaultValue: null,
      displayOrder: 1
    },
    {
      key: "output.fair_value",
      label: "公允价值",
      kind: "derived",
      unit: "currency",
      editable: false,
      objectiveSource: null,
      defaultPolicy: "none",
      defaultValue: null,
      displayOrder: 999
    },
    {
      key: "output.return_gap",
      label: "收益偏离",
      kind: "derived",
      unit: "pct",
      editable: false,
      objectiveSource: null,
      defaultPolicy: "none",
      defaultValue: null,
      displayOrder: 1000
    }
  ]);

  const objectivePe: ValuationMethodInputField = {
    key: "valuation.pe_ttm",
    label: "PE(TTM)",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.daily_basics.pe_ttm",
    defaultPolicy: "none",
    defaultValue: null,
    displayOrder: 10,
    description: null
  };
  const objectivePb: ValuationMethodInputField = {
    key: "valuation.pb",
    label: "PB",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.daily_basics.pb",
    defaultPolicy: "none",
    defaultValue: null,
    displayOrder: 11,
    description: null
  };
  const objectivePs: ValuationMethodInputField = {
    key: "valuation.ps_ttm",
    label: "PS(TTM)",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.daily_basics.ps_ttm",
    defaultPolicy: "none",
    defaultValue: null,
    displayOrder: 12,
    description: null
  };
  const objectiveEvEbitda: ValuationMethodInputField = {
    key: "valuation.ev_ebitda_ttm",
    label: "EV/EBITDA(TTM)",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.daily_basics.ev_ebitda_ttm",
    defaultPolicy: "none",
    defaultValue: null,
    displayOrder: 12,
    description: null
  };
  const objectiveDv: ValuationMethodInputField = {
    key: "valuation.dv_ttm",
    label: "股息率(TTM)",
    kind: "objective",
    unit: "pct",
    editable: false,
    objectiveSource: "market.daily_basics.dv_ttm",
    defaultPolicy: "none",
    defaultValue: null,
    displayOrder: 13,
    description: null
  };
  const objectiveMomentum: ValuationMethodInputField = {
    key: "factor.momentum.20d",
    label: "20日动量",
    kind: "objective",
    unit: "pct",
    editable: false,
    objectiveSource: "market.daily_prices.derived.momentum_20d",
    defaultPolicy: "none",
    defaultValue: null,
    displayOrder: 14,
    description: null
  };
  const objectiveVolatility: ValuationMethodInputField = {
    key: "risk.volatility.20d",
    label: "20日波动率",
    kind: "objective",
    unit: "pct",
    editable: false,
    objectiveSource: "market.daily_prices.derived.volatility_20d",
    defaultPolicy: "none",
    defaultValue: null,
    displayOrder: 15,
    description: null
  };
  const objectiveBasis: ValuationMethodInputField = {
    key: "factor.basis",
    label: "基差",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.derived.basis",
    defaultPolicy: "none",
    defaultValue: null,
    displayOrder: 16,
    description: null
  };

  switch (formulaId) {
    case "stock_pe_relative_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectivePe, displayOrder: 10 },
        {
          key: "targetPe",
          label: "目标PE",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 18,
          displayOrder: 20
        }
      ]);
    case "stock_pb_relative_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectivePb, displayOrder: 10 },
        {
          key: "targetPb",
          label: "目标PB",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 2.5,
          displayOrder: 20
        }
      ]);
    case "stock_ps_relative_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectivePs, displayOrder: 10 },
        {
          key: "targetPs",
          label: "目标PS",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 3,
          displayOrder: 20
        }
      ]);
    case "stock_peg_relative_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectivePe, displayOrder: 10 },
        {
          key: "growthRate",
          label: "增长率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.12,
          displayOrder: 20
        },
        {
          key: "targetPeg",
          label: "目标PEG",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 1,
          displayOrder: 21
        }
      ]);
    case "stock_ev_ebitda_relative_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveEvEbitda, displayOrder: 10 },
        {
          key: "targetEvEbitda",
          label: "目标EV/EBITDA",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 12,
          displayOrder: 20
        }
      ]);
    case "stock_ev_sales_relative_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectivePs, displayOrder: 10 },
        {
          key: "targetEvSales",
          label: "目标EV/Sales",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 4,
          displayOrder: 20
        }
      ]);
    case "stock_ddm_gordon_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveDv, displayOrder: 10 },
        {
          key: "dividendYield",
          label: "股息率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.03,
          displayOrder: 20
        },
        {
          key: "growthRate",
          label: "长期增长率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.05,
          displayOrder: 21
        },
        {
          key: "discountRate",
          label: "折现率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.1,
          displayOrder: 22
        }
      ]);
    case "stock_fcff_twostage_v1":
      return normalizeInputSchema([
        ...common,
        {
          key: "fcffYield",
          label: "FCFF收益率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.05,
          displayOrder: 20
        },
        {
          key: "highGrowthYears",
          label: "高增阶段年数",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 5,
          displayOrder: 21
        },
        {
          key: "highGrowthRate",
          label: "高增阶段增速",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 0.1,
          displayOrder: 22
        },
        {
          key: "terminalGrowthRate",
          label: "永续增长率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.03,
          displayOrder: 23
        },
        {
          key: "wacc",
          label: "WACC",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.1,
          displayOrder: 24
        }
      ]);
    case "futures_basis_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveBasis, displayOrder: 10 },
        { ...objectiveVolatility, displayOrder: 11 },
        {
          key: "basisWeight",
          label: "基差权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.7,
          displayOrder: 20
        },
        {
          key: "volPenalty",
          label: "波动惩罚",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.3,
          displayOrder: 21
        }
      ]);
    case "futures_trend_vol_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveMomentum, displayOrder: 10 },
        { ...objectiveVolatility, displayOrder: 11 },
        {
          key: "momentumWeight",
          label: "动量权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.65,
          displayOrder: 20
        },
        {
          key: "volatilityPenalty",
          label: "波动惩罚",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.3,
          displayOrder: 21
        }
      ]);
    case "futures_term_structure_v1":
      return normalizeInputSchema([
        ...common,
        {
          key: "expectedBasisPct",
          label: "预期基差(%)",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.01,
          displayOrder: 20
        },
        {
          key: "rollYieldPct",
          label: "展期收益(%)",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.005,
          displayOrder: 21
        }
      ]);
    case "volatility_discount_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveVolatility, displayOrder: 10 },
        {
          key: "volatilityDiscountWeight",
          label: "波动率折价系数",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.6,
          displayOrder: 20
        }
      ]);
    case "volatility_risk_premium_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveVolatility, displayOrder: 10 },
        {
          key: "impliedVolatility",
          label: "隐含波动率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.28,
          displayOrder: 20
        },
        {
          key: "vrpBeta",
          label: "风险溢价系数",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.8,
          displayOrder: 21
        }
      ]);
    case "volatility_percentile_band_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveVolatility, displayOrder: 10 },
        {
          key: "volatilityPercentile",
          label: "波动率分位数",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.5,
          displayOrder: 20
        },
        {
          key: "percentileAnchor",
          label: "分位锚点",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "constant",
          defaultValue: 0.5,
          displayOrder: 21
        },
        {
          key: "percentileSensitivity",
          label: "分位敏感度",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.4,
          displayOrder: 22
        }
      ]);
    case "spot_carry_v1":
      return normalizeInputSchema([
        ...common,
        {
          key: "factor.carry.annualized",
          label: "Carry 年化",
          kind: "objective",
          unit: "pct",
          editable: false,
          objectiveSource: "market.daily_prices.derived.carry_annualized",
          defaultPolicy: "none",
          defaultValue: null,
          displayOrder: 10
        },
        {
          key: "carryWeight",
          label: "Carry 权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 1,
          displayOrder: 20
        }
      ]);
    case "spot_mean_reversion_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveMomentum, displayOrder: 10 },
        {
          key: "reversionStrength",
          label: "回归强度",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.35,
          displayOrder: 20
        }
      ]);
    case "spot_inventory_risk_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveVolatility, displayOrder: 10 },
        {
          key: "inventoryPremium",
          label: "库存溢价",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 0.04,
          displayOrder: 20
        },
        {
          key: "volatilityPenalty",
          label: "波动惩罚",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.35,
          displayOrder: 21
        }
      ]);
    case "forex_ppp_v1":
      return normalizeInputSchema([
        ...common,
        {
          key: "factor.ppp_gap",
          label: "PPP 偏离",
          kind: "objective",
          unit: "pct",
          editable: false,
          objectiveSource: "macro.ppp_gap",
          defaultPolicy: "none",
          defaultValue: null,
          displayOrder: 10
        },
        {
          key: "pppWeight",
          label: "PPP 权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.8,
          displayOrder: 20
        },
        {
          key: "momentumWeight",
          label: "动量权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.2,
          displayOrder: 21
        }
      ]);
    case "forex_rate_differential_v1":
      return normalizeInputSchema([
        ...common,
        {
          key: "carryDifferential",
          label: "利差(年化)",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.01,
          displayOrder: 20
        },
        {
          key: "horizonYears",
          label: "持有期(年)",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "constant",
          defaultValue: 1,
          displayOrder: 21
        }
      ]);
    case "forex_reer_reversion_v1":
      return normalizeInputSchema([
        ...common,
        { ...objectiveMomentum, displayOrder: 10 },
        {
          key: "reerGap",
          label: "REER 偏离",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.03,
          displayOrder: 20
        },
        {
          key: "reversionSpeed",
          label: "回归速度",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.45,
          displayOrder: 21
        }
      ]);
    case "bond_yield_v1":
      return normalizeInputSchema([
        ...common,
        {
          key: "risk.duration",
          label: "久期",
          kind: "objective",
          unit: "number",
          editable: false,
          objectiveSource: "bond.curve.duration",
          defaultPolicy: "none",
          defaultValue: null,
          displayOrder: 10
        },
        {
          key: "risk.yield_shift",
          label: "收益率冲击",
          kind: "objective",
          unit: "pct",
          editable: false,
          objectiveSource: "bond.curve.yield_shift",
          defaultPolicy: "none",
          defaultValue: null,
          displayOrder: 11
        },
        {
          key: "durationWeight",
          label: "久期权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "constant",
          defaultValue: 1,
          displayOrder: 20
        }
      ]);
    case "bond_spread_duration_v1":
      return normalizeInputSchema([
        ...common,
        {
          key: "duration",
          label: "久期",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 6,
          displayOrder: 20
        },
        {
          key: "spreadChange",
          label: "利差变动",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.002,
          displayOrder: 21
        },
        {
          key: "convexity",
          label: "凸性",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.5,
          displayOrder: 22
        }
      ]);
    case "bond_real_rate_v1":
      return normalizeInputSchema([
        ...common,
        {
          key: "realRateGap",
          label: "实际利率偏离",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: -0.005,
          displayOrder: 20
        },
        {
          key: "sensitivity",
          label: "敏感度",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 4,
          displayOrder: 21
        }
      ]);
    default:
      if (formulaId.startsWith("stock_")) {
        return normalizeInputSchema([
          ...common,
          { ...objectivePe, displayOrder: 10 },
          { ...objectivePb, displayOrder: 11 },
          { ...objectivePs, displayOrder: 12 }
        ]);
      }
      return common;
  }
}

function normalizeRequiredDate(value: unknown, field: string): string {
  const date = normalizeRequiredString(value, field);
  if (!DATE_RE.test(date)) {
    throw new Error(`${field} must be YYYY-MM-DD.`);
  }
  return date;
}

function normalizeOptionalDate(value: unknown, field: string): string | null {
  const date = normalizeOptionalString(value);
  if (!date) return null;
  if (!DATE_RE.test(date)) {
    throw new Error(`${field} must be YYYY-MM-DD.`);
  }
  return date;
}

function normalizeRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} must not be empty.`);
  return trimmed;
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const normalized = normalizeOptionalString(item);
    if (!normalized) continue;
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeFiniteNumber(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${field} must be a finite number.`);
  }
  return num;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item)).map((item) => item.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function parseJsonArrayOfObjects(value: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => item as Record<string, unknown>);
  } catch {
    return [];
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toFiniteInteger(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toEpochDay(date: string): number | null {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time)) return null;
  return Math.floor(time / 86_400_000);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
