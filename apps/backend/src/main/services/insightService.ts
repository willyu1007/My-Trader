import crypto from "node:crypto";

import type {
  CloneBuiltinValuationMethodInput,
  CreateInsightFactInput,
  CreateCustomValuationMethodInput,
  CreateInsightInput,
  DataDomainId,
  GetInsightInput,
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
  UpdateCustomValuationMethodInput,
  UpdateInsightInput,
  UpsertInsightEffectChannelInput,
  UpsertInsightEffectPointInput,
  UpsertInsightScopeRuleInput,
  ValuationAdjustmentPreview,
  ValuationAppliedEffect,
  ValuationMethod,
  ValuationMethodAssetScope,
  ValuationMethodDetail,
  ValuationMethodVersion,
  ValuationMetricNode,
  ValuationPreviewBySymbolInput
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

interface CircMvRow {
  trade_date: string;
  circ_mv: number | null;
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
        graph_json, param_schema_json, metric_schema_json, formula_manifest_json,
        created_at, updated_at
      from valuation_method_versions
      where method_id = ?
      order by version desc
    `,
    [methodRow.id]
  );
  return {
    method: toValuationMethod(methodRow),
    versions: versions.map(toValuationMethodVersion)
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
    }
  }

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
          graph_json, param_schema_json, metric_schema_json, formula_manifest_json,
          created_at, updated_at
        )
        values (?, ?, 1, null, null, ?, ?, ?, ?, ?, ?)
      `,
      [
        versionId,
        methodId,
        JSON.stringify(graph),
        JSON.stringify(paramSchema),
        JSON.stringify(metricSchema),
        JSON.stringify(formulaManifest),
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
  const graph = normalizeMetricGraph(input.graph);
  const paramSchema = normalizeRecord(input.paramSchema);
  const metricSchema = normalizeRecord(input.metricSchema);
  const templateVersion =
    pickPreferredVersion(detail.method, detail.versions, null) ?? detail.versions[0] ?? null;
  const formulaManifest =
    templateVersion?.formulaManifest ?? { formulaId: "generic_factor_v1", locked: true };
  const effectiveFrom = normalizeOptionalDate(input.effectiveFrom, "effectiveFrom");
  const effectiveTo = normalizeOptionalDate(input.effectiveTo, "effectiveTo");
  const versionId = `${methodKey}.v${nextVersion}.${now}`;

  await run(
    businessDb,
    `
      insert into valuation_method_versions (
        id, method_id, version, effective_from, effective_to,
        graph_json, param_schema_json, metric_schema_json, formula_manifest_json,
        created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  if (priceRows.length === 0 || !Number.isFinite(Number(priceRows[0]?.close))) {
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
      reason: "缺少可用价格数据",
      computedAt: Date.now()
    };
  }

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
  const circMvRow = await get<CircMvRow>(
    marketDb,
    `
      select trade_date, circ_mv
      from daily_basics
      where symbol = ?
        and trade_date <= ?
      order by trade_date desc
      limit 1
    `,
    [symbol, asOfDate]
  );
  const circMv = toFiniteNumber(circMvRow?.circ_mv ?? null);

  const baseMetrics: Record<string, number | null> = {
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
    "liquidity.circ_mv": circMv
  };
  const formulaId = resolveFormulaId(version.formulaManifest);
  recomputeDerivedOutputs(baseMetrics, formulaId);

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
      recomputeDerivedOutputs(adjustedMetrics, formulaId);
    }
  }

  const baseValue = pickPrimaryValue(baseMetrics);
  const adjustedValue = pickPrimaryValue(adjustedMetrics);
  const computedAt = Date.now();
  await upsertValuationSnapshot(businessDb, {
    symbol,
    asOfDate,
    methodKey: method.methodKey,
    baseMetrics,
    adjustedMetrics,
    appliedEffects,
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
    notApplicable: false,
    reason: null,
    computedAt
  };
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
        created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(symbol, as_of_date, method_key) do update set
        base_metrics_json = excluded.base_metrics_json,
        adjusted_metrics_json = excluded.adjusted_metrics_json,
        applied_effects_json = excluded.applied_effects_json,
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
  if (kind === "stock" || kind === "fund" || assetClass === "stock" || assetClass === "etf") {
    return "builtin.equity.factor";
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
  formulaId: string
): void {
  const price = metrics["market.price"] ?? null;
  const momentum = metrics["factor.momentum.20d"] ?? 0;
  const vol = metrics["risk.volatility.20d"] ?? 0;
  const basis = metrics["factor.basis"] ?? 0;
  const carry = metrics["factor.carry.annualized"] ?? 0;
  const ppp = metrics["factor.ppp_gap"] ?? 0;
  const duration = metrics["risk.duration"] ?? 0;
  const yieldShift = metrics["risk.yield_shift"] ?? 0;

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
    case "spot_carry_v1":
      fairValue = price === null ? null : price * (1 + carry);
      break;
    case "forex_ppp_v1":
      fairValue = price === null ? null : price * (1 + ppp);
      break;
    case "bond_yield_v1":
      fairValue = price === null ? null : price * (1 - duration * yieldShift);
      break;
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

function pickPrimaryValue(metrics: Record<string, number | null>): number | null {
  const keys = ["output.fair_value", "valuation.fair_value", "market.price"];
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

function toValuationMethodVersion(row: ValuationMethodVersionRow): ValuationMethodVersion {
  return {
    id: row.id,
    methodId: row.method_id,
    version: Number(row.version ?? 0),
    effectiveFrom: row.effective_from ?? null,
    effectiveTo: row.effective_to ?? null,
    graph: normalizeMetricGraph(parseJsonArrayOfObjects(row.graph_json)),
    paramSchema: normalizeRecord(parseJsonObject(row.param_schema_json)),
    metricSchema: normalizeRecord(parseJsonObject(row.metric_schema_json)),
    formulaManifest: normalizeRecord(parseJsonObject(row.formula_manifest_json)),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0)
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

function normalizeMethodKey(value: unknown, field: string): string {
  const key = normalizeRequiredString(value, field);
  if (!METHOD_KEY_RE.test(key)) {
    throw new Error(`${field} is invalid.`);
  }
  return key;
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
