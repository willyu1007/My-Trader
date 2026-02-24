import type {
  MarketDataSourceConfigV2,
  CompletenessStatus,
  ListCompletenessStatusInput,
  ListCompletenessStatusResult,
  ListTargetTaskStatusInput,
  ListTargetTaskStatusResult,
  MarketCompletenessConfig,
  MarketCompletenessStatusRow,
  MarketTargetTaskStatusRow,
  PreviewCompletenessCoverageInput,
  PreviewCompletenessCoverageResult,
  PreviewTargetTaskCoverageResult,
  RunCompletenessMaterializationInput,
  TargetTaskStatus
} from "@mytrader/shared";

import { all, get } from "../../storage/sqlite";
import type { SqliteDatabase } from "../../storage/sqlite";
import {
  getMarketCompletenessConfig,
  setMarketCompletenessConfig
} from "../../storage/marketSettingsRepository";
import { getMarketDataSourceConfig } from "../../storage/marketDataSourceRepository";
import { getMarketRolloutFlags } from "../../storage/marketSettingsRepository";
import { getLatestIngestRun } from "../ingestRunsRepository";
import { resolveMarketExecutionPlan } from "../executionPlanResolver";
import { materializeTargetsFromSsot } from "../targetMaterializationService";
import {
  COMPLETENESS_BUCKET_ORDER,
  getTargetModuleFromCompletenessCheckId,
  listCompletenessChecks,
  listCompletenessChecksByScope
} from "./checkRegistry";
import {
  createCompletenessRun,
  finishCompletenessRun,
  listCompletenessStatusRows,
  previewCompletenessCoverage as previewCompletenessCoverageInRepository,
  upsertCompletenessStatuses,
  type UpsertCompletenessStatusInput
} from "./completenessRepository";
import {
  resolveCompletenessEntities,
  type CompletenessEntity
} from "./entityResolver";
import { evaluateCompletenessStatus } from "./statusEvaluator";

export async function getCompletenessConfig(input: {
  businessDb: SqliteDatabase;
}): Promise<MarketCompletenessConfig> {
  const [config, dataSourceConfig] = await Promise.all([
    getMarketCompletenessConfig(input.businessDb),
    getMarketDataSourceConfig(input.businessDb)
  ]);
  return filterCompletenessConfigByDataSource(config, dataSourceConfig);
}

export async function setCompletenessConfig(input: {
  businessDb: SqliteDatabase;
  patch: {
    defaultLookbackDays?: number | null;
    targetEnabledCheckIds?: string[] | null;
  };
}): Promise<MarketCompletenessConfig> {
  const [config, dataSourceConfig] = await Promise.all([
    setMarketCompletenessConfig(input.businessDb, input.patch),
    getMarketDataSourceConfig(input.businessDb)
  ]);
  return filterCompletenessConfigByDataSource(config, dataSourceConfig);
}

export async function previewCompletenessCoverage(input: {
  marketDb: SqliteDatabase;
  request?: PreviewCompletenessCoverageInput;
}): Promise<PreviewCompletenessCoverageResult> {
  const scopeId = input.request?.scopeId ?? "target_pool";
  try {
    return await previewCompletenessCoverageInRepository(input.marketDb, scopeId);
  } catch (error) {
    if (!isRecoverableMarketCacheReadError(error)) throw error;
    console.warn(
      `[mytrader] completeness preview fallback to empty due to cache read error: ${toErrorMessage(
        error
      )}`
    );
    return createEmptyCompletenessCoverage(scopeId);
  }
}

export async function listCompletenessStatus(input: {
  marketDb: SqliteDatabase;
  request?: ListCompletenessStatusInput;
}): Promise<ListCompletenessStatusResult> {
  try {
    return await listCompletenessStatusRows(input.marketDb, input.request);
  } catch (error) {
    if (!isRecoverableMarketCacheReadError(error)) throw error;
    console.warn(
      `[mytrader] completeness list-status fallback to empty due to cache read error: ${toErrorMessage(
        error
      )}`
    );
    const limit = Math.max(1, Math.min(1000, Math.floor(input.request?.limit ?? 200)));
    const offset = Math.max(0, Math.floor(input.request?.offset ?? 0));
    return {
      items: [],
      total: 0,
      limit,
      offset
    };
  }
}

export async function runCompletenessMaterialization(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  analysisDbPath: string;
  request?: RunCompletenessMaterializationInput;
}): Promise<void> {
  const scopeId = input.request?.scopeId ?? "target_pool";
  const runId = await createCompletenessRun(input.marketDb, scopeId);

  let asOfTradeDate: string | null = null;
  let sourceRunId: string | null = null;
  try {
    if (scopeId === "target_pool") {
      const latestUniverseRun = await getLatestIngestRun(input.marketDb, "universe");
      asOfTradeDate = latestUniverseRun?.as_of_trade_date ?? formatDate(new Date());
      sourceRunId = latestUniverseRun?.id ?? runId;
      await materializeTargetsFromSsot({
        businessDb: input.businessDb,
        marketDb: input.marketDb,
        analysisDbPath: input.analysisDbPath,
        asOfTradeDate,
        sourceRunId,
        symbols: input.request?.symbols ?? null
      });
    } else {
      const latestUniverseRun = await getLatestIngestRun(input.marketDb, "universe");
      asOfTradeDate = latestUniverseRun?.as_of_trade_date ?? formatDate(new Date());
      sourceRunId = latestUniverseRun?.id ?? runId;
      await materializeSourcePoolCompleteness({
        businessDb: input.businessDb,
        marketDb: input.marketDb,
        asOfTradeDate,
        sourceRunId
      });
    }

    const preview = await previewCompletenessCoverageInRepository(input.marketDb, scopeId);
    await finishCompletenessRun(input.marketDb, {
      id: runId,
      status:
        preview.totals.missing > 0 || preview.totals.notStarted > 0
          ? "partial"
          : "success",
      asOfTradeDate,
      entityCount: preview.totals.entities,
      completeCount: preview.totals.complete,
      partialCount: preview.totals.partial,
      missingCount: preview.totals.missing,
      notApplicableCount: preview.totals.notApplicable,
      notStartedCount: preview.totals.notStarted,
      sourceRunId
    });
  } catch (error) {
    await finishCompletenessRun(input.marketDb, {
      id: runId,
      status: "failed",
      asOfTradeDate,
      entityCount: 0,
      completeCount: 0,
      partialCount: 0,
      missingCount: 0,
      notApplicableCount: 0,
      notStartedCount: 0,
      sourceRunId,
      errorMessage: toErrorMessage(error)
    });
    throw error;
  }
}

export async function listTargetTaskStatusFromCompleteness(input: {
  marketDb: SqliteDatabase;
  request?: ListTargetTaskStatusInput;
}): Promise<ListTargetTaskStatusResult> {
  const moduleCheckId = input.request?.moduleId
    ? `target.${input.request.moduleId}`
    : null;

  let statusResult: ListCompletenessStatusResult;
  try {
    statusResult = await listCompletenessStatusRows(input.marketDb, {
      scopeId: "target_pool",
      checkId: moduleCheckId,
      status: input.request?.status ?? null,
      entityType: "instrument",
      limit: input.request?.limit ?? 200,
      offset: input.request?.offset ?? 0
    });
  } catch (error) {
    if (!isRecoverableMarketCacheReadError(error)) throw error;
    console.warn(
      `[mytrader] target-task list-status fallback to empty due to cache read error: ${toErrorMessage(
        error
      )}`
    );
    const limit = Math.max(1, Math.min(1000, Math.floor(input.request?.limit ?? 200)));
    const offset = Math.max(0, Math.floor(input.request?.offset ?? 0));
    return {
      items: [],
      total: 0,
      limit,
      offset
    };
  }

  const items = statusResult.items
    .map((row) => toTargetTaskStatusRow(row))
    .filter((row): row is MarketTargetTaskStatusRow => row !== null)
    .filter((row) => {
      const symbolFilter = input.request?.symbol?.trim();
      if (!symbolFilter) return true;
      return row.symbol === symbolFilter;
    });

  return {
    items,
    total: items.length,
    limit: statusResult.limit,
    offset: statusResult.offset
  };
}

export async function previewTargetTaskCoverageFromCompleteness(input: {
  marketDb: SqliteDatabase;
}): Promise<PreviewTargetTaskCoverageResult> {
  let statusRows: ListCompletenessStatusResult;
  try {
    statusRows = await listCompletenessStatusRows(input.marketDb, {
      scopeId: "target_pool",
      entityType: "instrument",
      limit: 100_000,
      offset: 0
    });
  } catch (error) {
    if (!isRecoverableMarketCacheReadError(error)) throw error;
    console.warn(
      `[mytrader] target-task preview fallback to empty due to cache read error: ${toErrorMessage(
        error
      )}`
    );
    return {
      asOfTradeDate: null,
      totals: {
        symbols: 0,
        modules: 0,
        complete: 0,
        partial: 0,
        missing: 0,
        notApplicable: 0
      },
      byAssetClass: []
    };
  }

  const rows = statusRows.items
    .map((row) => toTargetTaskStatusRow(row))
    .filter((row): row is MarketTargetTaskStatusRow => row !== null);

  const symbols = new Set<string>();
  const modules = new Set<string>();
  const byAssetClass = new Map<
    string,
    { complete: number; partial: number; missing: number; notApplicable: number }
  >();

  let complete = 0;
  let partial = 0;
  let missing = 0;
  let notApplicable = 0;
  let asOfTradeDate: string | null = null;

  for (const row of rows) {
    symbols.add(row.symbol);
    modules.add(row.moduleId);
    if (!asOfTradeDate && row.asOfTradeDate) {
      asOfTradeDate = row.asOfTradeDate;
    }

    if (row.status === "complete") complete += 1;
    if (row.status === "partial") partial += 1;
    if (row.status === "missing") missing += 1;
    if (row.status === "not_applicable") notApplicable += 1;

    const assetClass = row.assetClass ?? "unknown";
    const group = byAssetClass.get(assetClass) ?? {
      complete: 0,
      partial: 0,
      missing: 0,
      notApplicable: 0
    };

    if (row.status === "complete") group.complete += 1;
    if (row.status === "partial") group.partial += 1;
    if (row.status === "missing") group.missing += 1;
    if (row.status === "not_applicable") group.notApplicable += 1;

    byAssetClass.set(assetClass, group);
  }

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
    byAssetClass: Array.from(byAssetClass.entries()).map(([assetClass, group]) => ({
      assetClass: assetClass as PreviewTargetTaskCoverageResult["byAssetClass"][number]["assetClass"],
      complete: group.complete,
      partial: group.partial,
      missing: group.missing,
      notApplicable: group.notApplicable
    }))
  };
}

async function materializeSourcePoolCompleteness(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  asOfTradeDate: string;
  sourceRunId: string;
}): Promise<void> {
  const [dataSourceConfig, rolloutFlags] = await Promise.all([
    getMarketDataSourceConfig(input.businessDb),
    getMarketRolloutFlags(input.businessDb)
  ]);
  const executionPlan = resolveMarketExecutionPlan({
    dataSourceConfig,
    rolloutFlags
  });

  const checks = listCompletenessChecksByScope("source_pool").filter((check) =>
    isSourceCheckConfiguredByDataSource(check, dataSourceConfig)
  );
  const rows: UpsertCompletenessStatusInput[] = [];

  for (const check of checks) {
    const entities = await resolveCompletenessEntities({
      scopeId: "source_pool",
      check,
      businessDb: input.businessDb,
      marketDb: input.marketDb,
      symbols: null
    });

    for (const entity of entities) {
      const requiredSignals = await resolveDatasetSignals({
        marketDb: input.marketDb,
        check,
        entity,
        datasetIds: check.requiredDatasetIds,
        asOfTradeDate: input.asOfTradeDate
      });
      const optionalSignals = await resolveDatasetSignals({
        marketDb: input.marketDb,
        check,
        entity,
        datasetIds: check.optionalDatasetIds,
        asOfTradeDate: input.asOfTradeDate
      });

      const requiredPresent = requiredSignals.filter((signal) => signal.present).length;
      const optionalPresent = optionalSignals.filter((signal) => signal.present).length;
      const rolloutEnabled = isSourceCheckEnabledByRollout(check.moduleId, executionPlan);

      const statusResult = evaluateCompletenessStatus({
        applicable: true,
        enabled: true,
        hasStarted: requiredPresent > 0 || optionalPresent > 0,
        requiredTotal: check.requiredDatasetIds.length,
        requiredPresent,
        optionalTotal: check.optionalDatasetIds.length,
        optionalPresent
      });

      rows.push({
        scopeId: "source_pool",
        checkId: check.id,
        entityType: entity.entityType,
        entityId: entity.entityId,
        bucketId: check.bucketId,
        domainId: check.domainId,
        moduleId: check.moduleId,
        assetClass: entity.assetClass,
        asOfTradeDate: input.asOfTradeDate,
        status: statusResult.status,
        coverageRatio: statusResult.coverageRatio,
        sourceRunId: input.sourceRunId,
        detail: {
          sourceConfigured: true,
          rolloutEnabled,
          required: requiredSignals,
          optional: optionalSignals
        }
      });
    }
  }

  await upsertCompletenessStatuses(input.marketDb, rows);
}

type DatasetSignal = {
  datasetId: string;
  present: boolean;
};

async function resolveDatasetSignals(input: {
  marketDb: SqliteDatabase;
  check: ReturnType<typeof listCompletenessChecks>[number];
  entity: CompletenessEntity;
  datasetIds: string[];
  asOfTradeDate: string;
}): Promise<DatasetSignal[]> {
  const signals: DatasetSignal[] = [];
  for (const datasetId of input.datasetIds) {
    const present = await hasDatasetRecord({
      marketDb: input.marketDb,
      check: input.check,
      entity: input.entity,
      datasetId,
      asOfTradeDate: input.asOfTradeDate
    });
    signals.push({ datasetId, present });
  }
  return signals;
}

async function hasDatasetRecord(input: {
  marketDb: SqliteDatabase;
  check: ReturnType<typeof listCompletenessChecks>[number];
  entity: CompletenessEntity;
  datasetId: string;
  asOfTradeDate: string;
}): Promise<boolean> {
  const { marketDb, entity, datasetId, asOfTradeDate, check } = input;
  const entityId = entity.entityId;

  if (datasetId === "sqlite.instruments") {
    if (entityId.endsWith(":all")) {
      return await hasAnyInstrumentForBucket(marketDb, check.bucketId);
    }
    const row = await get<{ present: number }>(
      marketDb,
      `select 1 as present from instruments where symbol = ? limit 1`,
      [entityId]
    );
    return Boolean(row?.present);
  }

  if (datasetId === "sqlite.instrument_profiles") {
    if (entityId.endsWith(":all")) {
      const row = await get<{ present: number }>(
        marketDb,
        `select 1 as present from instrument_profiles where kind = 'index' limit 1`
      );
      return Boolean(row?.present);
    }
    const row = await get<{ present: number }>(
      marketDb,
      `select 1 as present from instrument_profiles where symbol = ? limit 1`,
      [entityId]
    );
    return Boolean(row?.present);
  }

  if (datasetId === "sqlite.fx_pair_meta") {
    if (entityId.endsWith(":all")) {
      const row = await get<{ present: number }>(
        marketDb,
        `select 1 as present from fx_pair_meta where is_active = 1 limit 1`
      );
      return Boolean(row?.present);
    }
    const row = await get<{ present: number }>(
      marketDb,
      `select 1 as present from fx_pair_meta where symbol = ? limit 1`,
      [entityId]
    );
    return Boolean(row?.present);
  }

  if (datasetId === "sqlite.macro_module_snapshot") {
    if (entity.entityType === "macro_module" && !entityId.endsWith(":all")) {
      const row = await get<{ present: number }>(
        marketDb,
        `
          select 1 as present
          from macro_module_snapshot
          where module_id = ?
            and as_of_trade_date <= ?
          order by as_of_trade_date desc
          limit 1
        `,
        [entityId, asOfTradeDate]
      );
      return Boolean(row?.present);
    }
    const row = await get<{ present: number }>(
      marketDb,
      `
        select 1 as present
        from macro_module_snapshot
        where as_of_trade_date <= ?
        limit 1
      `,
      [asOfTradeDate]
    );
    return Boolean(row?.present);
  }

  if (datasetId === "sqlite.daily_prices") {
    if (entityId.endsWith(":all")) {
      return await hasAnyDailyPriceForBucket(marketDb, check.bucketId, asOfTradeDate);
    }
    const row = await get<{ present: number }>(
      marketDb,
      `
        select 1 as present
        from daily_prices
        where symbol = ?
          and trade_date <= ?
        order by trade_date desc
        limit 1
      `,
      [entityId, asOfTradeDate]
    );
    return Boolean(row?.present);
  }

  if (datasetId === "sqlite.daily_basics") {
    if (entityId.endsWith(":all")) {
      const row = await get<{ present: number }>(
        marketDb,
        `
          select 1 as present
          from daily_basics b
          inner join instruments i
            on i.symbol = b.symbol
          where i.asset_class = 'stock'
            and b.trade_date <= ?
          order by b.trade_date desc
          limit 1
        `,
        [asOfTradeDate]
      );
      return Boolean(row?.present);
    }
    const row = await get<{ present: number }>(
      marketDb,
      `
        select 1 as present
        from daily_basics
        where symbol = ?
          and trade_date <= ?
        order by trade_date desc
        limit 1
      `,
      [entityId, asOfTradeDate]
    );
    return Boolean(row?.present);
  }

  if (datasetId === "sqlite.daily_moneyflows") {
    if (entityId.endsWith(":all")) {
      const row = await get<{ present: number }>(
        marketDb,
        `
          select 1 as present
          from daily_moneyflows m
          inner join instruments i
            on i.symbol = m.symbol
          where i.asset_class = 'stock'
            and m.trade_date <= ?
          order by m.trade_date desc
          limit 1
        `,
        [asOfTradeDate]
      );
      return Boolean(row?.present);
    }
    const row = await get<{ present: number }>(
      marketDb,
      `
        select 1 as present
        from daily_moneyflows
        where symbol = ?
          and trade_date <= ?
        order by trade_date desc
        limit 1
      `,
      [entityId, asOfTradeDate]
    );
    return Boolean(row?.present);
  }

  return false;
}

async function hasAnyDailyPriceForBucket(
  marketDb: SqliteDatabase,
  bucketId: MarketCompletenessStatusRow["bucketId"],
  asOfTradeDate: string
): Promise<boolean> {
  if (bucketId === "stock" || bucketId === "etf" || bucketId === "futures" || bucketId === "spot") {
    const row = await get<{ present: number }>(
      marketDb,
      `
        select 1 as present
        from daily_prices p
        inner join instruments i
          on i.symbol = p.symbol
        where i.asset_class = ?
          and p.trade_date <= ?
        order by p.trade_date desc
        limit 1
      `,
      [bucketId, asOfTradeDate]
    );
    return Boolean(row?.present);
  }

  if (bucketId === "index") {
    const row = await get<{ present: number }>(
      marketDb,
      `
        select 1 as present
        from daily_prices p
        inner join instrument_profiles ip
          on ip.symbol = p.symbol
        where ip.kind = 'index'
          and p.trade_date <= ?
        order by p.trade_date desc
        limit 1
      `,
      [asOfTradeDate]
    );
    return Boolean(row?.present);
  }

  if (bucketId === "fx") {
    const row = await get<{ present: number }>(
      marketDb,
      `
        select 1 as present
        from daily_prices p
        inner join fx_pair_meta fx
          on fx.symbol = p.symbol
        where fx.is_active = 1
          and p.trade_date <= ?
        order by p.trade_date desc
        limit 1
      `,
      [asOfTradeDate]
    );
    return Boolean(row?.present);
  }

  return false;
}

async function hasAnyInstrumentForBucket(
  marketDb: SqliteDatabase,
  bucketId: MarketCompletenessStatusRow["bucketId"]
): Promise<boolean> {
  if (bucketId === "stock" || bucketId === "etf" || bucketId === "futures" || bucketId === "spot") {
    const row = await get<{ present: number }>(
      marketDb,
      `select 1 as present from instruments where asset_class = ? limit 1`,
      [bucketId]
    );
    return Boolean(row?.present);
  }

  if (bucketId === "index") {
    const row = await get<{ present: number }>(
      marketDb,
      `select 1 as present from instrument_profiles where kind = 'index' limit 1`
    );
    return Boolean(row?.present);
  }

  if (bucketId === "fx") {
    const row = await get<{ present: number }>(
      marketDb,
      `select 1 as present from fx_pair_meta where is_active = 1 limit 1`
    );
    return Boolean(row?.present);
  }

  if (bucketId === "macro") {
    const row = await get<{ present: number }>(
      marketDb,
      `select 1 as present from macro_module_snapshot limit 1`
    );
    return Boolean(row?.present);
  }

  return false;
}

function isSourceCheckEnabledByRollout(
  moduleId: string | null,
  plan: ReturnType<typeof resolveMarketExecutionPlan>
): boolean {
  if (!moduleId) return false;
  return plan.allowedModules.has(moduleId as never);
}

function filterCompletenessConfigByDataSource(
  config: MarketCompletenessConfig,
  dataSourceConfig: MarketDataSourceConfigV2
): MarketCompletenessConfig {
  const checks = config.checks.filter((check) => {
    if (check.scopeId !== "source_pool") return true;
    return isSourceCheckConfiguredByDataSource(check, dataSourceConfig);
  });
  return {
    ...config,
    checks
  };
}

function isSourceCheckConfiguredByDataSource(
  check: {
    scopeId: string;
    domainId?: string | null;
    moduleId?: string | null;
  },
  dataSourceConfig: MarketDataSourceConfigV2
): boolean {
  if (check.scopeId !== "source_pool") return true;
  const domainId = check.domainId;
  if (!domainId) return false;
  const domain = dataSourceConfig.domains[domainId as keyof typeof dataSourceConfig.domains];
  if (!domain?.enabled) return false;
  const moduleId = check.moduleId?.trim();
  if (!moduleId) return true;
  const moduleState = domain.modules[moduleId];
  return Boolean(moduleState?.enabled);
}

function toTargetTaskStatusRow(
  row: MarketCompletenessStatusRow
): MarketTargetTaskStatusRow | null {
  const moduleId = getTargetModuleFromCompletenessCheckId(row.checkId);
  if (!moduleId) return null;

  return {
    symbol: row.entityId,
    moduleId,
    assetClass:
      row.assetClass === "stock" ||
      row.assetClass === "etf" ||
      row.assetClass === "futures" ||
      row.assetClass === "spot" ||
      row.assetClass === "cash"
        ? row.assetClass
        : null,
    asOfTradeDate: row.asOfTradeDate,
    status: toLegacyTargetStatus(row.status),
    coverageRatio: row.coverageRatio,
    sourceRunId: row.sourceRunId,
    lastError:
      typeof row.detail?.["lastError"] === "string"
        ? String(row.detail.lastError)
        : row.status === "missing"
          ? "数据缺失"
          : row.status === "not_started"
            ? "尚未启动"
            : null,
    updatedAt: row.updatedAt
  };
}

function toLegacyTargetStatus(status: CompletenessStatus): TargetTaskStatus {
  if (status === "complete") return "complete";
  if (status === "partial") return "partial";
  if (status === "not_applicable") return "not_applicable";
  return "missing";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

function isRecoverableMarketCacheReadError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  if (!message) return false;
  return (
    message.includes("disk i/o error") ||
    message.includes("database is locked") ||
    message.includes("database disk image is malformed") ||
    message.includes("malformed") ||
    message.includes("not a database")
  );
}

function createEmptyCompletenessCoverage(
  scopeId: PreviewCompletenessCoverageResult["scopeId"]
): PreviewCompletenessCoverageResult {
  return {
    scopeId,
    asOfTradeDate: null,
    totals: {
      entities: 0,
      checks: 0,
      complete: 0,
      partial: 0,
      missing: 0,
      notApplicable: 0,
      notStarted: 0
    },
    byBucket: []
  };
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function listCompletenessBucketOrder(): Array<{
  bucketId: keyof typeof COMPLETENESS_BUCKET_ORDER;
  weight: number;
}> {
  return (Object.keys(COMPLETENESS_BUCKET_ORDER) as Array<keyof typeof COMPLETENESS_BUCKET_ORDER>)
    .map((bucketId) => ({ bucketId, weight: COMPLETENESS_BUCKET_ORDER[bucketId] }))
    .sort((a, b) => a.weight - b.weight);
}

export async function listLatestSourceCompletenessByBucket(input: {
  marketDb: SqliteDatabase;
}): Promise<Map<string, MarketCompletenessStatusRow[]>> {
  const rows = await all<{
    scope_id: string;
    bucket_id: string;
    check_id: string;
  }>(
    input.marketDb,
    `
      select scope_id, bucket_id, check_id
      from completeness_status_v2
      where scope_id = 'source_pool'
      group by scope_id, bucket_id, check_id
    `
  );

  const byBucket = new Map<string, MarketCompletenessStatusRow[]>();
  for (const row of rows) {
    const list = byBucket.get(row.bucket_id) ?? [];
    const statusRows = await listCompletenessStatusRows(input.marketDb, {
      scopeId: "source_pool",
      bucketId: row.bucket_id as MarketCompletenessStatusRow["bucketId"],
      checkId: row.check_id,
      limit: 1000,
      offset: 0
    });
    list.push(...statusRows.items);
    byBucket.set(row.bucket_id, list);
  }
  return byBucket;
}
