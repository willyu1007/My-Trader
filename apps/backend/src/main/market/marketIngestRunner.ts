import type {
  DataDomainId,
  IngestRunMode,
  MarketDataSource,
  UniversePoolBucketId
} from "@mytrader/shared";

import {
  openAnalysisDuckdb,
  ensureAnalysisDuckdbSchema,
  type AnalysisDuckdbConnection
} from "../storage/analysisDuckdb";
import type { SqliteDatabase } from "../storage/sqlite";
import {
  getMarketTargetTaskMatrixConfig,
  updateMarketUniversePoolBucketStates
} from "../storage/marketSettingsRepository";
import { getMarketDataSourceConfig } from "../storage/marketDataSourceRepository";
import { createIngestRun, finishIngestRun } from "./ingestRunsRepository";
import { ingestLock } from "./ingestLock";
import { upsertInstrumentProfiles } from "./instrumentCatalogRepository";
import { getInstrumentsBySymbols, upsertInstruments } from "./marketRepository";
import { getMarketProvider } from "./providers";
import { hasUniversePoolTag } from "./universePoolBuckets";
import {
  fetchTusharePaged,
  normalizeDate,
  normalizeNumber,
  toTushareDate
} from "./providers/tushareBulkFetch";
import {
  getDataDomainCatalogItem,
  toLegacyUniversePoolBuckets
} from "./dataSourceCatalog";
import { materializeTargetsFromSsot } from "./targetMaterializationService";
import {
  getLatestOpenTradeDate,
  listOpenTradeDatesBetween,
  listTradingCalendarDaysBetween,
  type TradingCalendarDayRow,
  upsertTradingCalendarDays
} from "./tradingCalendarRepository";

type IngestTotals = {
  inserted: number;
  updated: number;
  errors: number;
};

type DuckdbUpsertStats = {
  inserted: number;
  updated: number;
};

type TargetGapBackfillStats = {
  attemptedSymbols: number;
  inserted: number;
  updated: number;
  errors: number;
  startDate: string;
  endDate: string;
  latencyMs: number;
};

const EQUITY_CALENDAR_MARKET = "CN_EQ";
const FALLBACK_EQUITY_CALENDAR_MARKET = "CN";
const CALENDAR_MARKETS: string[] = [
  EQUITY_CALENDAR_MARKET,
  FALLBACK_EQUITY_CALENDAR_MARKET,
  "SHFE",
  "DCE",
  "CZCE",
  "CFFEX",
  "INE",
  "GFEX",
  "SGE"
];

export type IngestCheckpointResult = "continue" | "cancel";

export interface IngestExecutionControl {
  onRunCreated?: (runId: string) => void | Promise<void>;
  checkpoint?: () => IngestCheckpointResult | Promise<IngestCheckpointResult>;
}

export class IngestCanceledError extends Error {
  constructor(message = "ingest canceled") {
    super(message);
    this.name = "IngestCanceledError";
  }
}

export async function runTargetsDailyIngest(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  analysisDbPath: string;
  token: string | null;
  now?: Date;
}): Promise<void> {
  await runTargetsIngest({
    ...input,
    mode: "daily",
    meta: { schedule: "daily" }
  });
}

export async function runTargetsIngest(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  analysisDbPath: string;
  token: string | null;
  mode: IngestRunMode;
  meta?: Record<string, unknown> | null;
  now?: Date;
  control?: IngestExecutionControl;
}): Promise<void> {
  await ingestLock.runExclusive(async () => {
    const runId = await createIngestRun(input.marketDb, {
      scope: "targets",
      mode: input.mode,
      meta: input.meta ?? null
    });
    if (input.control?.onRunCreated) {
      await input.control.onRunCreated(runId);
    }

    try {
      await checkpointOrThrow(input.control);
      const token = input.token?.trim() ?? "";
      if (!token) {
        throw new Error("未配置 Tushare token。");
      }

      const now = input.now ?? new Date();
      const today = formatDate(now);
      await ensureTradingCalendars(input.marketDb, token, today);

      const asOfTradeDate = await getLatestEquityTradeDate(
        input.marketDb,
        today
      );
      if (!asOfTradeDate) {
        throw new Error("无法确定最新交易日（trade_calendar 缺失）。");
      }

      const totals: IngestTotals = { inserted: 0, updated: 0, errors: 0 };
      const matrixConfig = await getMarketTargetTaskMatrixConfig(input.businessDb);
      let result = await materializeTargetsFromSsot({
        businessDb: input.businessDb,
        marketDb: input.marketDb,
        analysisDbPath: input.analysisDbPath,
        asOfTradeDate,
        sourceRunId: runId
      });
      totals.inserted += result.insertedRows;
      totals.updated += result.updatedRows;

      let backfillStats: TargetGapBackfillStats | null = null;
      if (result.missingSymbols.length > 0) {
        await checkpointOrThrow(input.control);
        backfillStats = await backfillMissingTargetsFromUniverse({
          marketDb: input.marketDb,
          analysisDbPath: input.analysisDbPath,
          token,
          asOfTradeDate,
          lookbackDays: matrixConfig.defaultLookbackDays,
          symbols: result.missingSymbols,
          control: input.control
        });
        await checkpointOrThrow(input.control);
        result = await materializeTargetsFromSsot({
          businessDb: input.businessDb,
          marketDb: input.marketDb,
          analysisDbPath: input.analysisDbPath,
          asOfTradeDate,
          sourceRunId: runId
        });
        totals.inserted += result.insertedRows;
        totals.updated += result.updatedRows;
      }

      await finishIngestRun(input.marketDb, {
        id: runId,
        status: result.missingCount > 0 ? "partial" : "success",
        asOfTradeDate,
        symbolCount: result.symbolCount,
        inserted: totals.inserted,
        updated: totals.updated,
        errors: totals.errors,
        meta: {
          ...(input.meta ?? {}),
          kind: "targets",
          matrixLookbackDays: matrixConfig.defaultLookbackDays,
          missingModules: result.missingCount,
          backfill: backfillStats
        }
      });
    } catch (err) {
      if (err instanceof IngestCanceledError) {
        await finishIngestRun(input.marketDb, {
          id: runId,
          status: "canceled",
          errors: 0,
          errorMessage: null,
          meta: { ...(input.meta ?? {}), kind: "targets" }
        });
        return;
      }
      await finishIngestRun(input.marketDb, {
        id: runId,
        status: "failed",
        errors: 1,
        errorMessage: toErrorMessage(err),
        meta: { ...(input.meta ?? {}), kind: "targets" }
      });
      throw err;
    }
  });
}

export async function runUniverseDailyIngest(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  analysisDbPath: string;
  token: string | null;
  now?: Date;
}): Promise<void> {
  await runUniverseIngest({
    ...input,
    mode: "daily",
    meta: { schedule: "daily", windowYears: 3 }
  });
}

export async function runUniverseIngest(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  analysisDbPath: string;
  token: string | null;
  mode: IngestRunMode;
  meta?: Record<string, unknown> | null;
  now?: Date;
  control?: IngestExecutionControl;
}): Promise<void> {
  await ingestLock.runExclusive(async () => {
    const runId = await createIngestRun(input.marketDb, {
      scope: "universe",
      mode: input.mode,
      meta: input.meta ?? null
    });
    if (input.control?.onRunCreated) {
      await input.control.onRunCreated(runId);
    }

    let handle: Awaited<ReturnType<typeof openAnalysisDuckdb>> | null = null;
    try {
      await checkpointOrThrow(input.control);
      const token = input.token?.trim() ?? "";
      if (!token) {
        throw new Error("未配置 Tushare token。");
      }

      const now = input.now ?? new Date();
      const today = formatDate(now);
      await ensureTradingCalendars(input.marketDb, token, today);

      const asOfTradeDate = await getLatestEquityTradeDate(
        input.marketDb,
        today
      );
      if (!asOfTradeDate) {
        throw new Error("无法确定最新交易日（trade_calendar 缺失）。");
      }

      handle = await openAnalysisDuckdb(input.analysisDbPath);
      await ensureAnalysisDuckdbSchema(handle);

      await syncDuckdbTradeCalendars(handle, input.marketDb, today);

      const dataSourceConfig = await getMarketDataSourceConfig(input.businessDb);
      const selectedBuckets = toLegacyUniversePoolBuckets(dataSourceConfig);
      const selectedDomains = Object.entries(dataSourceConfig.domains)
        .filter(([, domain]) => domain.enabled)
        .map(([domainId]) => domainId);
      const selectedModules = Object.entries(dataSourceConfig.domains).flatMap(
        ([domainId, domainConfig]) => {
          const domainCatalog = getDataDomainCatalogItem(
            domainId as DataDomainId
          );
          if (!domainConfig.enabled || !domainCatalog) return [];
          return domainCatalog.modules
            .filter(
              (module) =>
                module.implemented &&
                module.syncCapable &&
                Boolean(domainConfig.modules[module.id]?.enabled)
            )
            .map((module) => ({
              domainId,
              moduleId: module.id
            }));
        }
      );
      if (selectedBuckets.length === 0) {
        throw new Error("当前未启用可同步的全量池模块。");
      }
      const {
        stockSymbols,
        etfSymbols,
        futuresSymbols,
        spotSymbols,
        catalogInserted,
        catalogUpdated,
        duckdbInserted,
        duckdbUpdated,
        bucketCounts
      } =
        await syncUniverseInstrumentMeta(
        input.marketDb,
        handle,
        token,
        selectedBuckets,
        input.control
      );

      const windowStart = formatDate(addDays(parseDate(asOfTradeDate) ?? now, -365 * 3));
      const startDate = await getUniverseCursorDate(handle, windowStart);
      const tradeDates = await listEquityOpenTradeDatesBetween(
        input.marketDb,
        startDate,
        asOfTradeDate
      );

      const totals: IngestTotals = {
        inserted: duckdbInserted,
        updated: duckdbUpdated,
        errors: 0
      };
      let lastDone: string | null = null;

      for (const tradeDate of tradeDates) {
        await checkpointOrThrow(input.control);
        await ingestUniverseTradeDate(
          handle,
          token,
          tradeDate,
          stockSymbols,
          etfSymbols,
          futuresSymbols,
          spotSymbols,
          totals
        );
        lastDone = tradeDate;
        await setUniverseCursorDate(handle, tradeDate);
        await yieldToEventLoop();
      }

      await finishIngestRun(input.marketDb, {
        id: runId,
        status: totals.errors > 0 ? "partial" : "success",
        asOfTradeDate,
        symbolCount:
          stockSymbols.size + etfSymbols.size + futuresSymbols.size + spotSymbols.size,
        inserted: totals.inserted,
        updated: totals.updated,
        errors: totals.errors,
        meta: {
          ...(input.meta ?? {}),
          windowYears: 3,
          selectedBuckets,
          selectedDomains: getMetaArray(input.meta?.selectedDomains, selectedDomains),
          selectedModules: getMetaArray(input.meta?.selectedModules, selectedModules),
          blockedModules: getMetaArray(input.meta?.blockedModules, []),
          tokenSourcesByDomain:
            (input.meta?.tokenSourcesByDomain as Record<string, string> | undefined) ?? {},
          instrumentCatalog: { inserted: catalogInserted, updated: catalogUpdated },
          lastTradeDate: lastDone,
          universeCounts: {
            stocks: stockSymbols.size,
            etfs: etfSymbols.size,
            futures: futuresSymbols.size,
            spot: spotSymbols.size
          },
          bucketCounts
        }
      });
      const updatedBuckets = selectedBuckets.filter(
        (bucket) => (bucketCounts[bucket] ?? 0) > 0
      );
      await updateMarketUniversePoolBucketStates(input.businessDb, {
        buckets: updatedBuckets,
        asOfTradeDate,
        runAt: Date.now()
      });
    } catch (err) {
      if (err instanceof IngestCanceledError) {
        await finishIngestRun(input.marketDb, {
          id: runId,
          status: "canceled",
          errors: 0,
          errorMessage: null,
          meta: { ...(input.meta ?? {}), windowYears: 3 }
        });
        return;
      }
      await finishIngestRun(input.marketDb, {
        id: runId,
        status: "failed",
        errors: 1,
        errorMessage: toErrorMessage(err),
        meta: { ...(input.meta ?? {}), windowYears: 3 }
      });
      throw err;
    } finally {
      if (handle) await handle.close();
    }
  });
}

function getMetaArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

async function backfillMissingTargetsFromUniverse(input: {
  marketDb: SqliteDatabase;
  analysisDbPath: string;
  token: string;
  asOfTradeDate: string;
  lookbackDays: number;
  symbols: string[];
  control?: IngestExecutionControl;
}): Promise<TargetGapBackfillStats> {
  const startedAt = Date.now();
  const normalizedSymbols = Array.from(
    new Set(input.symbols.map((value) => value.trim()).filter(Boolean))
  );
  const lookbackDays = Math.max(
    1,
    Math.min(720, Math.floor(Number(input.lookbackDays) || 180))
  );
  const asOf = parseDate(input.asOfTradeDate) ?? new Date();
  const startDate = formatDate(addDays(asOf, -(lookbackDays - 1)));
  const endDate = input.asOfTradeDate;

  const bySymbol = await getInstrumentsBySymbols(input.marketDb, normalizedSymbols);
  const stockSymbols = new Set<string>();
  const etfSymbols = new Set<string>();
  const futuresSymbols = new Set<string>();
  const spotSymbols = new Set<string>();
  normalizedSymbols.forEach((symbol) => {
    const assetClass = bySymbol.get(symbol)?.assetClass;
    if (assetClass === "stock") stockSymbols.add(symbol);
    if (assetClass === "etf") etfSymbols.add(symbol);
    if (assetClass === "futures") futuresSymbols.add(symbol);
    if (assetClass === "spot") spotSymbols.add(symbol);
  });

  const attemptedSymbols =
    stockSymbols.size + etfSymbols.size + futuresSymbols.size + spotSymbols.size;
  if (attemptedSymbols === 0) {
    return {
      attemptedSymbols: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      startDate,
      endDate,
      latencyMs: Date.now() - startedAt
    };
  }

  const tradeDates = await listEquityOpenTradeDatesBetween(
    input.marketDb,
    startDate,
    endDate
  );
  if (tradeDates.length === 0) {
    return {
      attemptedSymbols,
      inserted: 0,
      updated: 0,
      errors: 0,
      startDate,
      endDate,
      latencyMs: Date.now() - startedAt
    };
  }

  const totals: IngestTotals = { inserted: 0, updated: 0, errors: 0 };
  const analysisHandle = await openAnalysisDuckdb(input.analysisDbPath);
  try {
    await ensureAnalysisDuckdbSchema(analysisHandle);
    for (const tradeDate of tradeDates) {
      await checkpointOrThrow(input.control);
      await ingestUniverseTradeDate(
        analysisHandle,
        input.token,
        tradeDate,
        stockSymbols,
        etfSymbols,
        futuresSymbols,
        spotSymbols,
        totals
      );
      await yieldToEventLoop();
    }
  } finally {
    await analysisHandle.close();
  }

  return {
    attemptedSymbols,
    inserted: totals.inserted,
    updated: totals.updated,
    errors: totals.errors,
    startDate,
    endDate,
    latencyMs: Date.now() - startedAt
  };
}

async function ensureTradingCalendars(
  marketDb: SqliteDatabase,
  token: string,
  today: string
): Promise<void> {
  const provider = getMarketProvider("tushare");
  const start = formatDate(addDays(parseDate(today) ?? new Date(), -365 * 5));
  const end = formatDate(addDays(parseDate(today) ?? new Date(), 40));
  const rows: Array<{
    market: string;
    date: string;
    isOpen: boolean;
    source: MarketDataSource;
  }> = [];

  for (const market of CALENDAR_MARKETS) {
    try {
      const days = await provider.fetchTradingCalendar({
        token,
        market,
        startDate: start,
        endDate: end
      });
      days.forEach((day) => {
        rows.push({
          market: day.market,
          date: day.date,
          isOpen: day.isOpen,
          source: day.provider satisfies MarketDataSource
        });
      });
    } catch (error) {
      console.warn(
        `[mytrader] trading calendar skipped ${market}: ${toErrorMessage(error)}`
      );
    }
  }

  if (rows.length === 0) return;
  await upsertTradingCalendarDays(marketDb, rows);
}

async function syncDuckdbTradeCalendars(
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  marketDb: SqliteDatabase,
  today: string
): Promise<void> {
  const start = formatDate(addDays(parseDate(today) ?? new Date(), -365 * 5));
  const end = formatDate(addDays(parseDate(today) ?? new Date(), 40));
  const days: TradingCalendarDayRow[] = [];
  for (const market of CALENDAR_MARKETS) {
    const rows = await listTradingCalendarDaysBetween(marketDb, market, start, end);
    if (rows.length > 0) {
      days.push(...rows);
    }
  }

  if (days.length === 0) return;

  const conn = await analysisHandle.connect();
  try {
    await conn.query("begin transaction;");
    await upsertDuckdbRows(
      conn,
      "trade_calendar",
      ["market", "date", "is_open", "ingested_at"],
      days.map((day) => [
        day.market,
        day.date,
        day.is_open === 1,
        day.ingested_at
      ])
    );
    await conn.query("commit;");
  } finally {
    await conn.close();
  }
}

async function getLatestEquityTradeDate(
  marketDb: SqliteDatabase,
  onOrBeforeDate: string
): Promise<string | null> {
  const next = await getLatestOpenTradeDate(
    marketDb,
    EQUITY_CALENDAR_MARKET,
    onOrBeforeDate
  );
  if (next) return next;
  return await getLatestOpenTradeDate(
    marketDb,
    FALLBACK_EQUITY_CALENDAR_MARKET,
    onOrBeforeDate
  );
}

async function listEquityOpenTradeDatesBetween(
  marketDb: SqliteDatabase,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const dates = await listOpenTradeDatesBetween(
    marketDb,
    EQUITY_CALENDAR_MARKET,
    startDate,
    endDate
  );
  if (dates.length > 0) return dates;
  return await listOpenTradeDatesBetween(
    marketDb,
    FALLBACK_EQUITY_CALENDAR_MARKET,
    startDate,
    endDate
  );
}

async function syncUniverseInstrumentMeta(
  marketDb: SqliteDatabase,
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  token: string,
  selectedBuckets: UniversePoolBucketId[],
  control?: IngestExecutionControl
): Promise<{
  stockSymbols: Set<string>;
  etfSymbols: Set<string>;
  futuresSymbols: Set<string>;
  spotSymbols: Set<string>;
  catalogInserted: number;
  catalogUpdated: number;
  duckdbInserted: number;
  duckdbUpdated: number;
  bucketCounts: Record<UniversePoolBucketId, number>;
}> {
  const provider = getMarketProvider("tushare");
  const profiles = await provider.fetchInstrumentCatalog({ token });

  const selectedSet = new Set(selectedBuckets);
  const eligible = profiles.filter((profile) => {
    if (selectedSet.size === 0) return true;
    for (const bucket of selectedSet) {
      if (hasUniversePoolTag(profile.tags ?? [], bucket)) return true;
    }
    return false;
  });

  const stocks = eligible.filter((profile) => profile.assetClass === "stock");
  const etfs = eligible.filter((profile) => profile.assetClass === "etf");
  const futures = eligible.filter((profile) => profile.assetClass === "futures");
  const spot = eligible.filter((profile) => profile.assetClass === "spot");

  const catalogResult = await upsertInstrumentProfiles(marketDb, profiles);
  const bucketCounts = createEmptyBucketCounts();
  eligible.forEach((profile) => {
    for (const bucket of selectedSet) {
      if (hasUniversePoolTag(profile.tags ?? [], bucket)) {
        bucketCounts[bucket] += 1;
      }
    }
  });

  await upsertInstruments(
    marketDb,
    profiles.map((profile) => ({
      symbol: profile.symbol,
      name: profile.name,
      assetClass: profile.assetClass ?? null,
      market: profile.market ?? null,
      currency: profile.currency ?? null
    }))
  );

  const conn = await analysisHandle.connect();
  try {
    await conn.query("begin transaction;");
    const now = Date.now();
    let duckdbInserted = 0;
    let duckdbUpdated = 0;

    const existingInstrumentSymbols = await getDuckdbExistingSingleKeys(
      conn,
      "instrument_meta",
      "symbol",
      eligible.map((profile) => profile.symbol)
    );
    const existingFuturesSymbols = await getDuckdbExistingSingleKeys(
      conn,
      "futures_contract_meta",
      "ts_code",
      futures.map((profile) => profile.symbol)
    );
    const existingSpotSymbols = await getDuckdbExistingSingleKeys(
      conn,
      "spot_sge_contract_meta",
      "ts_code",
      spot.map((profile) => profile.symbol)
    );

    for (const profile of eligible) {
      await checkpointOrThrow(control);
      const providerRaw =
        (profile.providerData?.raw as Record<string, unknown> | undefined) ?? {};
      if (existingInstrumentSymbols.has(profile.symbol)) {
        duckdbUpdated += 1;
      } else {
        duckdbInserted += 1;
      }
      await conn.query(
        `
          insert into instrument_meta (
            symbol, kind, name, market, currency, asset_class, asset_subclass,
            commodity_group, metal_type, updated_at
          )
          values ('${escapeSql(profile.symbol)}', '${escapeSql(profile.kind)}', ${
          profile.name ? `'${escapeSql(profile.name)}'` : "null"
        }, '${escapeSql(profile.market ?? "CN")}', '${escapeSql(
          profile.currency ?? "CNY"
        )}', '${escapeSql(profile.assetClass ?? "stock")}', ${
          profile.assetClass === "futures" ? "'futures'" : "null"
        }, ${
          profile.assetClass === "spot" ? "'spot'" : "null"
        }, ${
          profile.assetClass === "futures" || profile.assetClass === "spot" ? "'metal'" : "null"
        }, ${now})
          on conflict(symbol) do update set
            kind = excluded.kind,
            name = excluded.name,
            market = excluded.market,
            currency = excluded.currency,
            asset_class = excluded.asset_class,
            asset_subclass = excluded.asset_subclass,
            commodity_group = excluded.commodity_group,
            metal_type = excluded.metal_type,
            updated_at = excluded.updated_at
        `
      );
      if (profile.assetClass === "futures") {
        if (existingFuturesSymbols.has(profile.symbol)) {
          duckdbUpdated += 1;
        } else {
          duckdbInserted += 1;
        }
        await conn.query(
          `
            insert into futures_contract_meta (
              ts_code, symbol, exchange, fut_code, name, trade_unit, per_unit, quote_unit,
              list_date, delist_date, updated_at
            )
            values (
              '${escapeSql(profile.symbol)}',
              ${toDuckdbNullableString(getRawString(providerRaw, "symbol"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "exchange"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "fut_code"))},
              ${toDuckdbNullableString(profile.name)},
              ${toDuckdbNullableString(getRawString(providerRaw, "trade_unit"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "per_unit"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "quote_unit"))},
              ${toDuckdbNullableString(normalizeDate(getRawString(providerRaw, "list_date")))},
              ${toDuckdbNullableString(normalizeDate(getRawString(providerRaw, "delist_date")))},
              ${now}
            )
            on conflict(ts_code) do update set
              symbol = excluded.symbol,
              exchange = excluded.exchange,
              fut_code = excluded.fut_code,
              name = excluded.name,
              trade_unit = excluded.trade_unit,
              per_unit = excluded.per_unit,
              quote_unit = excluded.quote_unit,
              list_date = excluded.list_date,
              delist_date = excluded.delist_date,
              updated_at = excluded.updated_at
          `
        );
      }
      if (profile.assetClass === "spot") {
        if (existingSpotSymbols.has(profile.symbol)) {
          duckdbUpdated += 1;
        } else {
          duckdbInserted += 1;
        }
        await conn.query(
          `
            insert into spot_sge_contract_meta (
              ts_code, ts_name, trade_type, t_unit, p_unit, min_change, price_limit,
              min_vol, max_vol, trade_mode, updated_at
            )
            values (
              '${escapeSql(profile.symbol)}',
              ${toDuckdbNullableString(getRawString(providerRaw, "ts_name") ?? profile.name)},
              ${toDuckdbNullableString(getRawString(providerRaw, "trade_type"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "t_unit"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "p_unit"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "min_change"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "price_limit"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "min_vol"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "max_vol"))},
              ${toDuckdbNullableString(getRawString(providerRaw, "trade_mode"))},
              ${now}
            )
            on conflict(ts_code) do update set
              ts_name = excluded.ts_name,
              trade_type = excluded.trade_type,
              t_unit = excluded.t_unit,
              p_unit = excluded.p_unit,
              min_change = excluded.min_change,
              price_limit = excluded.price_limit,
              min_vol = excluded.min_vol,
              max_vol = excluded.max_vol,
              trade_mode = excluded.trade_mode,
              updated_at = excluded.updated_at
          `
        );
      }
    }
    await conn.query("commit;");
    return {
      stockSymbols: new Set(stocks.map((p) => p.symbol)),
      etfSymbols: new Set(etfs.map((p) => p.symbol)),
      futuresSymbols: new Set(futures.map((p) => p.symbol)),
      spotSymbols: new Set(spot.map((p) => p.symbol)),
      catalogInserted: catalogResult.inserted,
      catalogUpdated: catalogResult.updated,
      duckdbInserted,
      duckdbUpdated,
      bucketCounts
    };
  } finally {
    await conn.close();
  }
}

function createEmptyBucketCounts(): Record<UniversePoolBucketId, number> {
  return {
    cn_a: 0,
    etf: 0,
    metal_futures: 0,
    metal_spot: 0
  };
}

async function ingestUniverseTradeDate(
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  token: string,
  tradeDate: string,
  stockSymbols: Set<string>,
  etfSymbols: Set<string>,
  futuresSymbols: Set<string>,
  spotSymbols: Set<string>,
  totals: IngestTotals
): Promise<void> {
  const tradeDateRaw = toTushareDate(tradeDate);

  const [daily, fundDaily, basics, moneyflow, futDaily, futSettle, sgeDaily] =
    await Promise.all([
      stockSymbols.size > 0
        ? fetchTusharePaged(
            "daily",
            token,
            { trade_date: tradeDateRaw },
            "ts_code,trade_date,open,high,low,close,vol"
          )
        : createEmptyTusharePagedResult(),
      etfSymbols.size > 0
        ? fetchTusharePaged(
            "fund_daily",
            token,
            { trade_date: tradeDateRaw },
            "ts_code,trade_date,open,high,low,close,vol"
          )
        : createEmptyTusharePagedResult(),
      stockSymbols.size > 0
        ? fetchTusharePaged(
            "daily_basic",
            token,
            { trade_date: tradeDateRaw },
            "ts_code,trade_date,circ_mv,total_mv"
          )
        : createEmptyTusharePagedResult(),
      stockSymbols.size > 0
        ? fetchTusharePaged(
            "moneyflow",
            token,
            { trade_date: tradeDateRaw },
            "ts_code,trade_date,net_mf_vol,net_mf_amount"
          )
        : createEmptyTusharePagedResult(),
      futuresSymbols.size > 0
        ? fetchTusharePagedSafe(
            "fut_daily",
            token,
            { trade_date: tradeDateRaw },
            "ts_code,trade_date,pre_close,pre_settle,open,high,low,close,settle,change1,change2,vol,amount,oi,oi_chg"
          )
        : createEmptyTusharePagedResult(),
      futuresSymbols.size > 0
        ? fetchTusharePagedSafe(
            "fut_settle",
            token,
            { trade_date: tradeDateRaw },
            "ts_code,trade_date,settle,delv_settle"
          )
        : createEmptyTusharePagedResult(),
      spotSymbols.size > 0
        ? fetchTusharePagedSafe(
            "sge_daily",
            token,
            { trade_date: tradeDateRaw },
            "ts_code,trade_date,open,high,low,close,change,pct_change,vol,amount,oi,price_avg,settle_vol,settle_dire"
          )
        : createEmptyTusharePagedResult()
    ]);

  const now = Date.now();

  const dailyRows = mapDailyPriceRows(daily, stockSymbols, "tushare", now);
  const fundRows = mapDailyPriceRows(fundDaily, etfSymbols, "tushare", now);
  const basicRows = mapDailyBasicRows(basics, stockSymbols, "tushare", now);
  const moneyRows = mapDailyMoneyflowRows(moneyflow, stockSymbols, "tushare", now);
  const futuresPriceRows = mapDailyPriceRows(futDaily, futuresSymbols, "tushare", now);
  const futuresExtRows = mapFuturesExtRows(
    futDaily,
    futSettle,
    futuresSymbols,
    "tushare",
    now
  );
  const spotPriceRows = mapDailyPriceRows(sgeDaily, spotSymbols, "tushare", now);
  const spotExtRows = mapSpotExtRows(sgeDaily, spotSymbols, "tushare", now);

  const conn = await analysisHandle.connect();
  try {
    await conn.query("begin transaction;");
    const priceStats = await upsertDuckdbRows(
      conn,
      "daily_prices",
      [
        "symbol",
        "trade_date",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "source",
        "ingested_at"
      ],
      [...dailyRows, ...fundRows, ...futuresPriceRows, ...spotPriceRows]
    );
    const basicStats = await upsertDuckdbRows(
      conn,
      "daily_basics",
      ["symbol", "trade_date", "circ_mv", "total_mv", "source", "ingested_at"],
      basicRows
    );
    const moneyflowStats = await upsertDuckdbRows(
      conn,
      "daily_moneyflows",
      ["symbol", "trade_date", "net_mf_vol", "net_mf_amount", "source", "ingested_at"],
      moneyRows
    );
    const futuresExtStats = await upsertDuckdbRows(
      conn,
      "futures_daily_ext",
      [
        "symbol",
        "trade_date",
        "pre_close",
        "pre_settle",
        "settle",
        "change1",
        "change2",
        "amount",
        "oi",
        "oi_chg",
        "delv_settle",
        "source",
        "ingested_at"
      ],
      futuresExtRows
    );
    const spotExtStats = await upsertDuckdbRows(
      conn,
      "spot_sge_daily_ext",
      [
        "symbol",
        "trade_date",
        "price_avg",
        "change",
        "pct_change",
        "amount",
        "oi",
        "settle_vol",
        "settle_dire",
        "source",
        "ingested_at"
      ],
      spotExtRows
    );
    await conn.query("commit;");

    totals.inserted +=
      priceStats.inserted +
      basicStats.inserted +
      moneyflowStats.inserted +
      futuresExtStats.inserted +
      spotExtStats.inserted;
    totals.updated +=
      priceStats.updated +
      basicStats.updated +
      moneyflowStats.updated +
      futuresExtStats.updated +
      spotExtStats.updated;
  } catch (err) {
    totals.errors += 1;
    try {
      await conn.query("rollback;");
    } catch {
      // ignore
    }
    throw err;
  } finally {
    await conn.close();
  }
}

async function fetchTusharePagedSafe(
  apiName: string,
  token: string,
  params: Record<string, string | undefined>,
  fields: string
): Promise<{ fields: string[]; items: (string | number | null)[][] }> {
  try {
    return await fetchTusharePaged(apiName, token, params, fields);
  } catch (error) {
    console.warn(`[mytrader] universe ingest skipped ${apiName}: ${toErrorMessage(error)}`);
    return { fields: [], items: [] };
  }
}

function createEmptyTusharePagedResult(): Promise<{
  fields: string[];
  items: (string | number | null)[][];
}> {
  return Promise.resolve({ fields: [], items: [] });
}

function mapDailyPriceRows(
  res: { fields: string[]; items: (string | number | null)[][] },
  allowed: Set<string>,
  source: MarketDataSource,
  ingestedAt: number
): Array<[string, string, number | null, number | null, number | null, number | null, number | null, string, number]> {
  const fields = res.fields ?? [];
  const rows = res.items ?? [];
  const idxSymbol = fields.indexOf("ts_code");
  const idxDate = fields.indexOf("trade_date");
  const idxOpen = fields.indexOf("open");
  const idxHigh = fields.indexOf("high");
  const idxLow = fields.indexOf("low");
  const idxClose = fields.indexOf("close");
  const idxVol = fields.indexOf("vol");
  if (idxSymbol === -1 || idxDate === -1) return [];

  const result: Array<[string, string, number | null, number | null, number | null, number | null, number | null, string, number]> = [];
  for (const row of rows) {
    const symbol = String(row[idxSymbol]);
    if (!allowed.has(symbol)) continue;
    const tradeDate = normalizeDate(row[idxDate]);
    if (!tradeDate) continue;
    result.push([
      symbol,
      tradeDate,
      normalizeNumber(row[idxOpen]),
      normalizeNumber(row[idxHigh]),
      normalizeNumber(row[idxLow]),
      normalizeNumber(row[idxClose]),
      normalizeNumber(row[idxVol]),
      source,
      ingestedAt
    ]);
  }
  return result;
}

function mapDailyBasicRows(
  res: { fields: string[]; items: (string | number | null)[][] },
  allowed: Set<string>,
  source: MarketDataSource,
  ingestedAt: number
): Array<[string, string, number | null, number | null, string, number]> {
  const fields = res.fields ?? [];
  const rows = res.items ?? [];
  const idxSymbol = fields.indexOf("ts_code");
  const idxDate = fields.indexOf("trade_date");
  const idxCirc = fields.indexOf("circ_mv");
  const idxTotal = fields.indexOf("total_mv");
  if (idxSymbol === -1 || idxDate === -1) return [];

  const result: Array<[string, string, number | null, number | null, string, number]> = [];
  for (const row of rows) {
    const symbol = String(row[idxSymbol]);
    if (!allowed.has(symbol)) continue;
    const tradeDate = normalizeDate(row[idxDate]);
    if (!tradeDate) continue;
    result.push([
      symbol,
      tradeDate,
      idxCirc === -1 ? null : normalizeNumber(row[idxCirc]),
      idxTotal === -1 ? null : normalizeNumber(row[idxTotal]),
      source,
      ingestedAt
    ]);
  }
  return result;
}

function mapDailyMoneyflowRows(
  res: { fields: string[]; items: (string | number | null)[][] },
  allowed: Set<string>,
  source: MarketDataSource,
  ingestedAt: number
): Array<[string, string, number | null, number | null, string, number]> {
  const fields = res.fields ?? [];
  const rows = res.items ?? [];
  const idxSymbol = fields.indexOf("ts_code");
  const idxDate = fields.indexOf("trade_date");
  const idxVol = fields.indexOf("net_mf_vol");
  const idxAmount = fields.indexOf("net_mf_amount");
  if (idxSymbol === -1 || idxDate === -1) return [];

  const result: Array<[string, string, number | null, number | null, string, number]> = [];
  for (const row of rows) {
    const symbol = String(row[idxSymbol]);
    if (!allowed.has(symbol)) continue;
    const tradeDate = normalizeDate(row[idxDate]);
    if (!tradeDate) continue;
    result.push([
      symbol,
      tradeDate,
      idxVol === -1 ? null : normalizeNumber(row[idxVol]),
      idxAmount === -1 ? null : normalizeNumber(row[idxAmount]),
      source,
      ingestedAt
    ]);
  }
  return result;
}

function mapFuturesExtRows(
  futDaily: { fields: string[]; items: (string | number | null)[][] },
  futSettle: { fields: string[]; items: (string | number | null)[][] },
  allowed: Set<string>,
  source: MarketDataSource,
  ingestedAt: number
): Array<
  [
    string,
    string,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    string,
    number
  ]
> {
  const fields = futDaily.fields ?? [];
  const rows = futDaily.items ?? [];
  const idxSymbol = fields.indexOf("ts_code");
  const idxDate = fields.indexOf("trade_date");
  const idxPreClose = fields.indexOf("pre_close");
  const idxPreSettle = fields.indexOf("pre_settle");
  const idxSettle = fields.indexOf("settle");
  const idxChange1 = fields.indexOf("change1");
  const idxChange2 = fields.indexOf("change2");
  const idxAmount = fields.indexOf("amount");
  const idxOi = fields.indexOf("oi");
  const idxOiChg = fields.indexOf("oi_chg");

  const settleFields = futSettle.fields ?? [];
  const settleRows = futSettle.items ?? [];
  const settleSymbol = settleFields.indexOf("ts_code");
  const settleDate = settleFields.indexOf("trade_date");
  const settleDelv = settleFields.indexOf("delv_settle");
  const delvMap = new Map<string, number | null>();
  if (settleSymbol !== -1 && settleDate !== -1 && settleDelv !== -1) {
    settleRows.forEach((row) => {
      const symbol = String(row[settleSymbol] ?? "").trim();
      const date = normalizeDate(row[settleDate]);
      if (!symbol || !date) return;
      delvMap.set(`${symbol}#${date}`, normalizeNumber(row[settleDelv]));
    });
  }

  if (idxSymbol === -1 || idxDate === -1) return [];
  const result: Array<
    [
      string,
      string,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      string,
      number
    ]
  > = [];
  for (const row of rows) {
    const symbol = String(row[idxSymbol]);
    if (!allowed.has(symbol)) continue;
    const tradeDate = normalizeDate(row[idxDate]);
    if (!tradeDate) continue;
    result.push([
      symbol,
      tradeDate,
      idxPreClose === -1 ? null : normalizeNumber(row[idxPreClose]),
      idxPreSettle === -1 ? null : normalizeNumber(row[idxPreSettle]),
      idxSettle === -1 ? null : normalizeNumber(row[idxSettle]),
      idxChange1 === -1 ? null : normalizeNumber(row[idxChange1]),
      idxChange2 === -1 ? null : normalizeNumber(row[idxChange2]),
      idxAmount === -1 ? null : normalizeNumber(row[idxAmount]),
      idxOi === -1 ? null : normalizeNumber(row[idxOi]),
      idxOiChg === -1 ? null : normalizeNumber(row[idxOiChg]),
      delvMap.get(`${symbol}#${tradeDate}`) ?? null,
      source,
      ingestedAt
    ]);
  }
  return result;
}

function mapSpotExtRows(
  res: { fields: string[]; items: (string | number | null)[][] },
  allowed: Set<string>,
  source: MarketDataSource,
  ingestedAt: number
): Array<
  [
    string,
    string,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    string | null,
    string,
    number
  ]
> {
  const fields = res.fields ?? [];
  const rows = res.items ?? [];
  const idxSymbol = fields.indexOf("ts_code");
  const idxDate = fields.indexOf("trade_date");
  const idxPriceAvg = fields.indexOf("price_avg");
  const idxChange = fields.indexOf("change");
  const idxPctChange = fields.indexOf("pct_change");
  const idxAmount = fields.indexOf("amount");
  const idxOi = fields.indexOf("oi");
  const idxSettleVol = fields.indexOf("settle_vol");
  const idxSettleDire = fields.indexOf("settle_dire");
  if (idxSymbol === -1 || idxDate === -1) return [];

  const result: Array<
    [
      string,
      string,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      number | null,
      string | null,
      string,
      number
    ]
  > = [];
  for (const row of rows) {
    const symbol = String(row[idxSymbol]);
    if (!allowed.has(symbol)) continue;
    const tradeDate = normalizeDate(row[idxDate]);
    if (!tradeDate) continue;
    result.push([
      symbol,
      tradeDate,
      idxPriceAvg === -1 ? null : normalizeNumber(row[idxPriceAvg]),
      idxChange === -1 ? null : normalizeNumber(row[idxChange]),
      idxPctChange === -1 ? null : normalizeNumber(row[idxPctChange]),
      idxAmount === -1 ? null : normalizeNumber(row[idxAmount]),
      idxOi === -1 ? null : normalizeNumber(row[idxOi]),
      idxSettleVol === -1 ? null : normalizeNumber(row[idxSettleVol]),
      idxSettleDire === -1 ? null : String(row[idxSettleDire] ?? "").trim() || null,
      source,
      ingestedAt
    ]);
  }
  return result;
}

async function upsertDuckdbRows(
  conn: AnalysisDuckdbConnection,
  table: string,
  columns: string[],
  rows: any[][]
): Promise<DuckdbUpsertStats> {
  if (rows.length === 0) return { inserted: 0, updated: 0 };

  const chunkSize = 500;
  const cols = columns.map((c) => `"${c}"`).join(", ");
  const keyCols = columns.slice(0, 2).map((c) => `"${c}"`).join(", ");
  const updateCols = columns
    .slice(2)
    .map((c) => `"${c}" = excluded.\"${c}\"`)
    .join(", ");

  const dedupedRows = dedupeDuckdbRowsByKey(rows);
  let inserted = 0;
  let updated = 0;

  for (let idx = 0; idx < dedupedRows.length; idx += chunkSize) {
    const chunk = dedupedRows.slice(idx, idx + chunkSize);
    const existing = await countDuckdbExistingRowsByKey(
      conn,
      table,
      columns[0],
      columns[1],
      chunk
    );
    const valuesSql = chunk.map((row) => `(${row.map(formatDuckdbValue).join(", ")})`).join(", ");
    const sql = `
      insert into ${table} (${cols})
      values ${valuesSql}
      on conflict(${keyCols}) do update set ${updateCols}
    `;
    await conn.query(sql);
    inserted += Math.max(0, chunk.length - existing);
    updated += Math.max(0, existing);
  }
  return { inserted, updated };
}

async function getDuckdbExistingSingleKeys(
  conn: AnalysisDuckdbConnection,
  table: string,
  keyColumn: string,
  keys: string[]
): Promise<Set<string>> {
  const normalized = Array.from(new Set(keys.map((value) => value.trim()).filter(Boolean)));
  if (normalized.length === 0) return new Set<string>();

  const existing = new Set<string>();
  const chunkSize = 500;
  for (let idx = 0; idx < normalized.length; idx += chunkSize) {
    const chunk = normalized.slice(idx, idx + chunkSize);
    const valuesSql = chunk.map((value) => formatDuckdbValue(value)).join(", ");
    const result = await conn.query(
      `
        select "${keyColumn}" as key
        from ${table}
        where "${keyColumn}" in (${valuesSql})
      `
    );
    const rows = result.toArray() as Array<{ key?: string | null }>;
    rows.forEach((row) => {
      const value = typeof row.key === "string" ? row.key.trim() : "";
      if (value) existing.add(value);
    });
  }
  return existing;
}

function formatDuckdbValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${escapeSql(String(value))}'`;
}

async function countDuckdbExistingRowsByKey(
  conn: AnalysisDuckdbConnection,
  table: string,
  keyColumnA: string,
  keyColumnB: string,
  rows: any[][]
): Promise<number> {
  if (rows.length === 0) return 0;
  const keyRows = dedupeDuckdbRowsByKey(rows).map((row) => [
    row[0],
    row[1]
  ]);
  if (keyRows.length === 0) return 0;

  const valuesSql = keyRows
    .map(([a, b]) => `(${formatDuckdbValue(a)}, ${formatDuckdbValue(b)})`)
    .join(", ");
  const result = await conn.query(
    `
      with keyset as (
        select * from (values ${valuesSql}) as v(k1, k2)
      )
      select count(*) as total
      from ${table} t
      inner join keyset k
        on t."${keyColumnA}" = k.k1
       and t."${keyColumnB}" = k.k2
    `
  );
  const rowsObj = result.toArray() as Array<{ total?: number }>;
  return Number(rowsObj[0]?.total ?? 0);
}

function dedupeDuckdbRowsByKey(rows: any[][]): any[][] {
  if (rows.length <= 1) return rows;
  const map = new Map<string, any[]>();
  rows.forEach((row) => {
    const key = `${String(row[0] ?? "")}\u0000${String(row[1] ?? "")}`;
    map.set(key, row);
  });
  return Array.from(map.values());
}

function toDuckdbNullableString(value: string | null): string {
  if (!value) return "null";
  return `'${escapeSql(value)}'`;
}

function getRawString(
  raw: Record<string, unknown>,
  key: string
): string | null {
  const value = raw[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

async function getUniverseCursorDate(
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  fallback: string
): Promise<string> {
  const conn = await analysisHandle.connect();
  try {
    const table = await conn.query(
      `select value from analysis_meta where key = 'universe_last_trade_date' limit 1`
    );
    const rows = table.toArray() as Array<{ value?: string }>;
    const value = rows.length ? (rows[0].value ?? "").trim() : "";
    if (value) {
      const next = nextDate(value);
      return next < fallback ? fallback : next;
    }
    return fallback;
  } finally {
    await conn.close();
  }
}

async function setUniverseCursorDate(
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  value: string
): Promise<void> {
  const conn = await analysisHandle.connect();
  try {
    await conn.query(
      `insert into analysis_meta (key, value) values ('universe_last_trade_date', '${escapeSql(
        value
      )}') on conflict(key) do update set value = excluded.value`
    );
  } finally {
    await conn.close();
  }
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

async function checkpointOrThrow(
  control?: IngestExecutionControl
): Promise<void> {
  if (!control?.checkpoint) return;
  const result = await control.checkpoint();
  if (result === "cancel") {
    throw new IngestCanceledError();
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nextDate(date: string): string {
  const parsed = parseDate(date);
  if (!parsed) return date;
  return formatDate(addDays(parsed, 1));
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
