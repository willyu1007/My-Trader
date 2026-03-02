import type {
  IngestRunMode,
  MarketDataSource,
  TushareIngestItem
} from "@mytrader/shared";

import { config } from "../config";
import { openAnalysisDuckdb, ensureAnalysisDuckdbSchema } from "../storage/analysisDuckdb";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { SqliteDatabase } from "../storage/sqlite";
import { upsertDailyBasics } from "./dailyBasicRepository";
import { upsertDailyMoneyflows } from "./dailyMoneyflowRepository";
import { createIngestRun, finishIngestRun } from "./ingestRunsRepository";
import { ingestLock } from "./ingestLock";
import { upsertInstrumentProfiles } from "./instrumentCatalogRepository";
import { upsertInstruments, upsertPrices } from "./marketRepository";
import { getMarketProvider } from "./providers";
import {
  fetchTusharePaged,
  normalizeDate,
  normalizeNumber,
  toTushareDate
} from "./providers/tushareBulkFetch";
import { resolveAutoIngestItems } from "./targetsService";
import type { MarketExecutionPlan } from "./executionPlanResolver";
import { upsertIngestStepRun } from "./ingestStepRunsRepository";
import {
  getLatestOpenTradeDate,
  listOpenTradeDatesBetween,
  listTradingCalendarDaysBetween,
  upsertTradingCalendarDays
} from "./tradingCalendarRepository";

type IngestTotals = {
  inserted: number;
  updated: number;
  errors: number;
};

const UNIVERSE_BATCH_SIZE_BY_MODE: Record<IngestRunMode, number> = {
  daily: 1,
  bootstrap: 2,
  manual: 1,
  on_demand: 1
};

const INDEX_DAILY_WAVE1_SYMBOL_BATCH_SIZE = 80;
const DAILY_BASIC_WAVE2_SYMBOL_BATCH_SIZE = 60;
const MONEYFLOW_WAVE3_SYMBOL_BATCH_SIZE = 60;
const UNIVERSE_CURSOR_PRIMARY_KEY = "universe_last_trade_date";
const UNIVERSE_CURSOR_INDEX_DAILY_KEY = "universe_index_daily_cursor_v1";
const UNIVERSE_CURSOR_DAILY_BASIC_KEY = "universe_daily_basic_cursor_v1";
const UNIVERSE_CURSOR_MONEYFLOW_KEY = "universe_moneyflow_cursor_v1";

type ForexPairMeta = {
  symbol: string;
  baseCcy: string | null;
  quoteCcy: string | null;
  quoteConvention: string | null;
  isActive: boolean;
};

type MacroSeriesSpec = {
  seriesKey: string;
  apiName: string;
  region: "CN" | "US";
  topic: string;
  frequency: "D" | "M" | "Q";
  unit: string | null;
  safetyLagHours: number;
  fallbackLagDays: number;
  valueFields: string[];
  periodFields: string[];
  releaseFields: string[];
};

type MacroObservationRow = {
  seriesKey: string;
  periodEnd: string;
  releaseDate: string;
  availableDate: string;
  value: number;
  unit: string | null;
  frequency: string;
  revisionNo: number;
  source: string;
  ingestedAt: number;
};

type MacroSeriesLatest = {
  seriesKey: string;
  availableDate: string;
  value: number;
  periodEnd: string;
  releaseDate: string;
  frequency: string;
  source: string;
  updatedAt: number;
};

type MacroModuleSnapshotRow = {
  asOfTradeDate: string;
  moduleId: string;
  status: "complete" | "partial" | "missing" | "not_applicable";
  coverageRatio: number;
  availableDate: string | null;
  payloadJson: string;
  sourceRunId: string;
  updatedAt: number;
};

type UniverseRecoveryModules = {
  indexDailyEnabled: boolean;
  dailyBasicEnabled: boolean;
  moneyflowEnabled: boolean;
};

type RecoveryModuleSummary = {
  module: "index_daily" | "daily_basic" | "moneyflow";
  enabled: boolean;
  status: "disabled" | "success" | "partial" | "failed";
  processedTradeDate: string | null;
  processedSymbols: number;
  pendingTradeDates: number;
  pendingSymbolsInDate: number;
  errors: number;
  cursor: string | null;
};

const MACRO_SERIES_SPECS: MacroSeriesSpec[] = [
  {
    seriesKey: "cn.shibor",
    apiName: "shibor",
    region: "CN",
    topic: "liquidity_rate",
    frequency: "D",
    unit: "pct",
    safetyLagHours: 12,
    fallbackLagDays: 1,
    valueFields: ["on", "1w", "1m", "3m"],
    periodFields: ["date", "trade_date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date", "trade_date"]
  },
  {
    seriesKey: "cn.shibor_lpr",
    apiName: "shibor_lpr",
    region: "CN",
    topic: "liquidity_rate",
    frequency: "M",
    unit: "pct",
    safetyLagHours: 12,
    fallbackLagDays: 2,
    valueFields: ["1y", "lpr1y", "5y", "lpr5y"],
    periodFields: ["date", "month", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date"]
  },
  {
    seriesKey: "cn.gdp",
    apiName: "cn_gdp",
    region: "CN",
    topic: "growth_inflation",
    frequency: "Q",
    unit: "pct",
    safetyLagHours: 12,
    fallbackLagDays: 30,
    valueFields: ["gdp_yoy", "gdp", "value"],
    periodFields: ["quarter", "end_date", "ann_date", "date"],
    releaseFields: ["release_date", "ann_date", "date"]
  },
  {
    seriesKey: "cn.cpi",
    apiName: "cn_cpi",
    region: "CN",
    topic: "growth_inflation",
    frequency: "M",
    unit: "pct",
    safetyLagHours: 12,
    fallbackLagDays: 15,
    valueFields: ["nt_yoy", "cpi_yoy", "yoy", "value"],
    periodFields: ["month", "date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date"]
  },
  {
    seriesKey: "cn.ppi",
    apiName: "cn_ppi",
    region: "CN",
    topic: "growth_inflation",
    frequency: "M",
    unit: "pct",
    safetyLagHours: 12,
    fallbackLagDays: 15,
    valueFields: ["ppi_yoy", "ppi_mp_yoy", "yoy", "value"],
    periodFields: ["month", "date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date"]
  },
  {
    seriesKey: "cn.pmi",
    apiName: "cn_pmi",
    region: "CN",
    topic: "growth_inflation",
    frequency: "M",
    unit: "index",
    safetyLagHours: 12,
    fallbackLagDays: 2,
    valueFields: ["pmi010000", "manufacturing", "pmi", "value"],
    periodFields: ["month", "date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date"]
  },
  {
    seriesKey: "cn.m2",
    apiName: "cn_m",
    region: "CN",
    topic: "liquidity_credit",
    frequency: "M",
    unit: "pct",
    safetyLagHours: 12,
    fallbackLagDays: 15,
    valueFields: ["m2_yoy", "m2", "value"],
    periodFields: ["month", "date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date"]
  },
  {
    seriesKey: "cn.social_financing",
    apiName: "sf_month",
    region: "CN",
    topic: "liquidity_credit",
    frequency: "M",
    unit: "bn",
    safetyLagHours: 12,
    fallbackLagDays: 15,
    valueFields: ["inc_month", "inc", "value"],
    periodFields: ["month", "date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date"]
  },
  {
    seriesKey: "cn.tmt_twincome",
    apiName: "tmt_twincome",
    region: "CN",
    topic: "industry_sentiment",
    frequency: "M",
    unit: null,
    safetyLagHours: 12,
    fallbackLagDays: 15,
    valueFields: ["income", "total_income", "value"],
    periodFields: ["month", "date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date"]
  },
  {
    seriesKey: "us.tycr",
    apiName: "us_tycr",
    region: "US",
    topic: "us_rates",
    frequency: "D",
    unit: "pct",
    safetyLagHours: 18,
    fallbackLagDays: 1,
    valueFields: ["yield", "value", "close"],
    periodFields: ["date", "trade_date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date", "trade_date"]
  },
  {
    seriesKey: "us.trycr",
    apiName: "us_trycr",
    region: "US",
    topic: "us_rates",
    frequency: "D",
    unit: "pct",
    safetyLagHours: 18,
    fallbackLagDays: 1,
    valueFields: ["yield", "value", "close"],
    periodFields: ["date", "trade_date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date", "trade_date"]
  },
  {
    seriesKey: "us.tbr",
    apiName: "us_tbr",
    region: "US",
    topic: "us_rates",
    frequency: "D",
    unit: "pct",
    safetyLagHours: 18,
    fallbackLagDays: 1,
    valueFields: ["yield", "value", "close"],
    periodFields: ["date", "trade_date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date", "trade_date"]
  },
  {
    seriesKey: "us.tltr",
    apiName: "us_tltr",
    region: "US",
    topic: "us_rates",
    frequency: "D",
    unit: "pct",
    safetyLagHours: 18,
    fallbackLagDays: 1,
    valueFields: ["yield", "value", "close"],
    periodFields: ["date", "trade_date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date", "trade_date"]
  },
  {
    seriesKey: "us.trltr",
    apiName: "us_trltr",
    region: "US",
    topic: "us_rates",
    frequency: "D",
    unit: "pct",
    safetyLagHours: 18,
    fallbackLagDays: 1,
    valueFields: ["yield", "value", "close"],
    periodFields: ["date", "trade_date", "ann_date"],
    releaseFields: ["release_date", "ann_date", "date", "trade_date"]
  }
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
  token: string | null;
  mode: IngestRunMode;
  meta?: Record<string, unknown> | null;
  now?: Date;
  control?: IngestExecutionControl;
  executionPlan?: MarketExecutionPlan;
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
      await ensureTradingCalendar(input.marketDb, token, "CN", today);

      const asOfTradeDate = await getLatestOpenTradeDate(input.marketDb, "CN", today);
      if (!asOfTradeDate) {
        throw new Error("无法确定最新交易日（trade_calendar 缺失）。");
      }

      const items = await resolveAutoIngestItems({
        businessDb: input.businessDb,
        marketDb: input.marketDb
      });

      const totals: IngestTotals = { inserted: 0, updated: 0, errors: 0 };
      await ingestTargetsRange(
        runId,
        input.marketDb,
        token,
        items,
        asOfTradeDate,
        totals,
        input.control,
        input.executionPlan
      );

      await finishIngestRun(input.marketDb, {
        id: runId,
        status: totals.errors > 0 ? "partial" : "success",
        asOfTradeDate,
        symbolCount: items.length,
        inserted: totals.inserted,
        updated: totals.updated,
        errors: totals.errors,
        meta: { ...(input.meta ?? {}), kind: "targets" }
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
  p1Enabled?: boolean;
  universeIndexDailyEnabled?: boolean;
  universeDailyBasicEnabled?: boolean;
  universeMoneyflowEnabled?: boolean;
  meta?: Record<string, unknown> | null;
  now?: Date;
  control?: IngestExecutionControl;
  executionPlan?: MarketExecutionPlan;
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
      const p1Enabled = input.p1Enabled ?? true;
      const modulePlan = input.executionPlan?.allowedModules;
      const stockDailyEnabled = modulePlan
        ? modulePlan.has("stock.market.daily")
        : true;
      const etfDailyEnabled = modulePlan ? modulePlan.has("etf.daily_quote") : true;
      const futuresDailyEnabled = modulePlan
        ? modulePlan.has("futures.daily")
        : p1Enabled;
      const spotDailyEnabled = modulePlan ? modulePlan.has("spot.sge_daily") : p1Enabled;
      const fxDailyEnabled = modulePlan ? modulePlan.has("fx.daily") : p1Enabled;
      const macroEnabled = modulePlan ? modulePlan.has("macro.snapshot") : p1Enabled;
      const indexDailyEnabledByPlan = modulePlan
        ? modulePlan.has("index.daily")
        : Boolean(input.universeIndexDailyEnabled ?? false);
      const moneyflowEnabledByPlan = modulePlan
        ? modulePlan.has("stock.moneyflow")
        : Boolean(input.universeMoneyflowEnabled ?? false);
      const recoveryModules: UniverseRecoveryModules = {
        indexDailyEnabled: indexDailyEnabledByPlan,
        dailyBasicEnabled:
          stockDailyEnabled && Boolean(input.universeDailyBasicEnabled ?? false),
        moneyflowEnabled: moneyflowEnabledByPlan
      };
      const today = formatDate(now);
      await ensureTradingCalendar(input.marketDb, token, "CN", today);

      const asOfTradeDate = await getLatestOpenTradeDate(input.marketDb, "CN", today);
      if (!asOfTradeDate) {
        throw new Error("无法确定最新交易日（trade_calendar 缺失）。");
      }

      handle = await openAnalysisDuckdb(input.analysisDbPath);
      await ensureAnalysisDuckdbSchema(handle);

      await syncDuckdbTradeCalendar(handle, input.marketDb, "CN", today);

      const {
        stockSymbols,
        etfSymbols,
        indexSymbols,
        futuresSymbols,
        spotSymbols,
        forexSymbols,
        forexPairCount,
        catalogInserted,
        catalogUpdated
      } = await syncUniverseInstrumentMeta(
        input.marketDb,
        handle,
        token,
        fxDailyEnabled,
        input.control
      );

      const effectiveFuturesSymbols = futuresDailyEnabled
        ? futuresSymbols
        : new Set<string>();
      const effectiveStockSymbols = stockDailyEnabled
        ? stockSymbols
        : new Set<string>();
      const effectiveEtfSymbols = etfDailyEnabled ? etfSymbols : new Set<string>();
      const effectiveSpotSymbols = spotDailyEnabled ? spotSymbols : new Set<string>();
      const effectiveForexSymbols = fxDailyEnabled ? forexSymbols : new Set<string>();

      const windowStart = formatDate(addDays(parseDate(asOfTradeDate) ?? now, -365 * 3));
      const startDate = await getUniverseCursorDate(input.marketDb, windowStart);
      const allTradeDates = await listOpenTradeDatesBetween(
        input.marketDb,
        "CN",
        startDate,
        asOfTradeDate
      );
      const batchSize = resolveUniverseBatchSize(input.mode);
      const tradeDates = allTradeDates.slice(0, batchSize);
      const pendingTradeDates = Math.max(0, allTradeDates.length - tradeDates.length);

      const totals: IngestTotals = { inserted: 0, updated: 0, errors: 0 };
      let lastDone: string | null = null;

      for (const tradeDate of tradeDates) {
        await checkpointOrThrow(input.control);
        await ingestUniverseTradeDate(
          runId,
          handle,
          input.marketDb,
          token,
          tradeDate,
          effectiveStockSymbols,
          effectiveEtfSymbols,
          indexSymbols,
          effectiveFuturesSymbols,
          effectiveSpotSymbols,
          effectiveForexSymbols,
          fxDailyEnabled,
          totals
        );
        lastDone = tradeDate;
        await setUniverseCursorDate(input.marketDb, tradeDate);
        await yieldToEventLoop();
      }

      const recoverySummary = await ingestUniverseRecoveryModules({
        analysisHandle: handle,
        marketDb: input.marketDb,
        token,
        asOfTradeDate,
        windowStart,
        mode: input.mode,
        recoveryModules,
        stockSymbols: effectiveStockSymbols,
        indexSymbols,
        totals,
        control: input.control
      });

      const macroSummary = macroEnabled
        ? await ingestMacroUniverseSnapshot(
            handle,
            input.marketDb,
            token,
            asOfTradeDate,
            runId,
            macroEnabled
          )
        : {
            seriesCount: 0,
            observationCount: 0,
            moduleSnapshotCount: 0
          };
      totals.inserted +=
        macroSummary.seriesCount +
        macroSummary.observationCount +
        macroSummary.moduleSnapshotCount;

      await handle.close();
      handle = null;

      await finishIngestRun(input.marketDb, {
        id: runId,
        status: totals.errors > 0 ? "partial" : "success",
        asOfTradeDate,
        symbolCount:
          effectiveStockSymbols.size +
          effectiveEtfSymbols.size +
          indexSymbols.size +
          effectiveFuturesSymbols.size +
          effectiveSpotSymbols.size +
          effectiveForexSymbols.size,
        inserted: totals.inserted,
        updated: totals.updated,
        errors: totals.errors,
        meta: {
          ...(input.meta ?? {}),
          windowYears: 3,
          instrumentCatalog: { inserted: catalogInserted, updated: catalogUpdated },
          lastTradeDate: lastDone,
          processedTradeDates: tradeDates.length,
          pendingTradeDates,
          batchSize,
          recoverySummary,
          macroSummary,
          universeCounts: {
            stocks: effectiveStockSymbols.size,
            etfs: effectiveEtfSymbols.size,
            indexes: indexSymbols.size,
            futures: effectiveFuturesSymbols.size,
            spots: effectiveSpotSymbols.size,
            forexes: effectiveForexSymbols.size,
            fxPairs: forexPairCount
          }
        }
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

async function ingestTargetsRange(
  ingestRunId: string,
  marketDb: SqliteDatabase,
  token: string,
  items: TushareIngestItem[],
  endDate: string,
  totals: IngestTotals,
  control?: IngestExecutionControl,
  executionPlan?: MarketExecutionPlan
): Promise<void> {
  if (items.length === 0) return;
  const provider = getMarketProvider("tushare");
  const end = endDate;
  const targetModules = executionPlan?.targetModules;
  const stockDailyEnabled = targetModules ? targetModules.has("stock.market.daily") : true;
  const stockMoneyflowEnabled = targetModules ? targetModules.has("stock.moneyflow") : true;
  const etfDailyEnabled = targetModules ? targetModules.has("etf.daily_quote") : true;

  await upsertInstruments(
    marketDb,
    items.map((item) => ({
      symbol: item.symbol,
      assetClass: item.assetClass,
      name: null,
      market: null,
      currency: null
    }))
  );

  const lookbackDate = formatDate(addDays(parseDate(end) ?? new Date(), -config.autoIngest.lookbackDays));

  for (const item of items) {
    await checkpointOrThrow(control);
    const symbol = item.symbol;
    const dailyModuleId =
      item.assetClass === "stock" ? "stock.market.daily" : "etf.daily_quote";
    const dailyEnabled =
      item.assetClass === "stock" ? stockDailyEnabled : etfDailyEnabled;
    if (!dailyEnabled) {
      await recordPipelineSkipped({
        marketDb,
        ingestRunId,
        scopeId: "targets",
        domainId: item.assetClass,
        moduleId: dailyModuleId,
        symbol
      });
      continue;
    }
    const latest = await getLatestPriceDate(marketDb, symbol);
    const startDate = latest ? nextDate(latest) : lookbackDate;
    if (startDate > end) continue;

    try {
      const prices = await provider.fetchDailyPrices({
        token,
        items: [item],
        startDate,
        endDate: end
      });
      await recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "targets",
        domainId: item.assetClass,
        moduleId: dailyModuleId,
        stage: "extract",
        status: "success",
        inputRows: 1,
        outputRows: prices.length,
        droppedRows: 0,
        errorMessage: null,
        key: symbol
      });
      await recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "targets",
        domainId: item.assetClass,
        moduleId: dailyModuleId,
        stage: "normalize",
        status: "success",
        inputRows: prices.length,
        outputRows: prices.length,
        droppedRows: 0,
        errorMessage: null,
        key: symbol
      });
      await upsertPrices(marketDb, prices);
      await recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "targets",
        domainId: item.assetClass,
        moduleId: dailyModuleId,
        stage: "upsert",
        status: "success",
        inputRows: prices.length,
        outputRows: prices.length,
        droppedRows: 0,
        errorMessage: null,
        key: symbol
      });
      totals.inserted += prices.length;
      await recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "targets",
        domainId: item.assetClass,
        moduleId: dailyModuleId,
        stage: "evaluate",
        status: "success",
        inputRows: prices.length,
        outputRows: prices.length,
        droppedRows: 0,
        errorMessage: null,
        key: symbol
      });

      if (item.assetClass === "stock") {
        const basics = await provider.fetchDailyBasics({
          token,
          symbols: [symbol],
          startDate,
          endDate: end
        });
        await upsertDailyBasics(
          marketDb,
          basics.map((row) => ({
            symbol: row.symbol,
            tradeDate: row.tradeDate,
            circMv: row.circMv,
            totalMv: row.totalMv,
            peTtm: row.peTtm,
            pb: row.pb,
            psTtm: row.psTtm,
            evEbitdaTtm: row.evEbitdaTtm,
            evSalesTtm: row.evSalesTtm,
            dvTtm: row.dvTtm,
            turnoverRate: row.turnoverRate,
            source: "tushare"
          }))
        );

        if (stockMoneyflowEnabled) {
          const moneyflows = await provider.fetchDailyMoneyflows({
            token,
            symbol,
            startDate,
            endDate: end
          });
          await recordIngestStep({
            marketDb,
            ingestRunId,
            scopeId: "targets",
            domainId: "stock",
            moduleId: "stock.moneyflow",
            stage: "extract",
            status: "success",
            inputRows: 1,
            outputRows: moneyflows.length,
            droppedRows: 0,
            errorMessage: null,
            key: symbol
          });
          await recordIngestStep({
            marketDb,
            ingestRunId,
            scopeId: "targets",
            domainId: "stock",
            moduleId: "stock.moneyflow",
            stage: "normalize",
            status: "success",
            inputRows: moneyflows.length,
            outputRows: moneyflows.length,
            droppedRows: 0,
            errorMessage: null,
            key: symbol
          });
          await upsertDailyMoneyflows(
            marketDb,
            moneyflows.map((row) => ({
              symbol: row.symbol,
              tradeDate: row.tradeDate,
              netMfVol: row.netMfVol,
              netMfAmount: row.netMfAmount,
              source: "tushare"
            }))
          );
          await recordIngestStep({
            marketDb,
            ingestRunId,
            scopeId: "targets",
            domainId: "stock",
            moduleId: "stock.moneyflow",
            stage: "upsert",
            status: "success",
            inputRows: moneyflows.length,
            outputRows: moneyflows.length,
            droppedRows: 0,
            errorMessage: null,
            key: symbol
          });
          await recordIngestStep({
            marketDb,
            ingestRunId,
            scopeId: "targets",
            domainId: "stock",
            moduleId: "stock.moneyflow",
            stage: "evaluate",
            status: "success",
            inputRows: moneyflows.length,
            outputRows: moneyflows.length,
            droppedRows: 0,
            errorMessage: null,
            key: symbol
          });
        } else {
          await recordPipelineSkipped({
            marketDb,
            ingestRunId,
            scopeId: "targets",
            domainId: "stock",
            moduleId: "stock.moneyflow",
            symbol
          });
        }
      }
    } catch (err) {
      totals.errors += 1;
      await recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "targets",
        domainId: item.assetClass,
        moduleId: dailyModuleId,
        stage: "extract",
        status: "failed",
        inputRows: 1,
        outputRows: 0,
        droppedRows: 0,
        errorMessage: toErrorMessage(err),
        key: symbol
      });
      console.error(`[mytrader] targets ingest failed: ${symbol}`);
      console.error(err);
    }
  }
}

async function ensureTradingCalendar(
  marketDb: SqliteDatabase,
  token: string,
  market: string,
  today: string
): Promise<void> {
  const provider = getMarketProvider("tushare");
  const start = formatDate(addDays(parseDate(today) ?? new Date(), -365 * 5));
  const end = formatDate(addDays(parseDate(today) ?? new Date(), 40));

  const days = await provider.fetchTradingCalendar({
    token,
    market,
    startDate: start,
    endDate: end
  });

  await upsertTradingCalendarDays(
    marketDb,
    days.map((day) => ({
      market: day.market,
      date: day.date,
      isOpen: day.isOpen,
      source: day.provider satisfies MarketDataSource
    }))
  );
}

async function syncDuckdbTradeCalendar(
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  marketDb: SqliteDatabase,
  market: string,
  today: string
): Promise<void> {
  const start = formatDate(addDays(parseDate(today) ?? new Date(), -365 * 5));
  const end = formatDate(addDays(parseDate(today) ?? new Date(), 40));

  const days = await listTradingCalendarDaysBetween(marketDb, market, start, end);
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

async function syncUniverseInstrumentMeta(
  marketDb: SqliteDatabase,
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  token: string,
  fxDailyEnabled: boolean,
  control?: IngestExecutionControl
): Promise<{
  stockSymbols: Set<string>;
  etfSymbols: Set<string>;
  indexSymbols: Set<string>;
  futuresSymbols: Set<string>;
  spotSymbols: Set<string>;
  forexSymbols: Set<string>;
  forexPairCount: number;
  catalogInserted: number;
  catalogUpdated: number;
}> {
  const provider = getMarketProvider("tushare");
  const profiles = await provider.fetchInstrumentCatalog({ token });
  const effectiveProfiles = fxDailyEnabled
    ? profiles
    : profiles.filter((profile) => profile.kind !== "forex");

  const stocks = effectiveProfiles.filter((profile) => profile.assetClass === "stock");
  const etfs = effectiveProfiles.filter((profile) => profile.assetClass === "etf");
  const indexes = effectiveProfiles.filter((profile) => profile.kind === "index");
  const futures = effectiveProfiles.filter((profile) => profile.kind === "futures");
  const spots = effectiveProfiles.filter((profile) => profile.kind === "spot");
  const forexes = effectiveProfiles.filter((profile) => profile.kind === "forex");
  const forexPairs = buildForexPairMetaRows(forexes);

  const catalogResult = await upsertInstrumentProfiles(marketDb, effectiveProfiles);

  await upsertInstruments(
    marketDb,
    effectiveProfiles.map((profile) => ({
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

    const instrumentMetaRows: Array<
      [string, string, string | null, string, string, string | null, number]
    > = [];
    let checkpointCounter = 0;
    for (const profile of effectiveProfiles) {
      instrumentMetaRows.push([
        profile.symbol,
        profile.kind,
        profile.name ?? null,
        profile.market ?? "CN",
        profile.currency ?? "CNY",
        profile.assetClass ?? null,
        now
      ]);
      checkpointCounter += 1;
      if (checkpointCounter % 500 === 0) {
        await checkpointOrThrow(control);
      }
    }
    await checkpointOrThrow(control);
    await upsertDuckdbRows(
      conn,
      "instrument_meta",
      ["symbol", "kind", "name", "market", "currency", "asset_class", "updated_at"],
      instrumentMetaRows,
      { keyColumns: ["symbol"] }
    );

    await upsertDuckdbRows(
      conn,
      "fx_pair_meta",
      [
        "symbol",
        "base_ccy",
        "quote_ccy",
        "quote_convention",
        "is_active",
        "updated_at"
      ],
      forexPairs.map((pair) => [
        pair.symbol,
        pair.baseCcy,
        pair.quoteCcy,
        pair.quoteConvention,
        pair.isActive,
        now
      ]),
      { keyColumns: ["symbol"] }
    );
    if (forexPairs.length > 0) {
      const symbolsSql = forexPairs
        .map((pair) => `'${escapeSql(pair.symbol)}'`)
        .join(", ");
      await conn.query(
        `
          update fx_pair_meta
          set is_active = false, updated_at = ${now}
          where symbol not in (${symbolsSql})
        `
      );
    }
    await conn.query("commit;");
  } finally {
    await conn.close();
  }

  await upsertSqliteFxPairMeta(marketDb, forexPairs);

  return {
    stockSymbols: new Set(stocks.map((p) => p.symbol)),
    etfSymbols: new Set(etfs.map((p) => p.symbol)),
    indexSymbols: new Set(indexes.map((p) => p.symbol)),
    futuresSymbols: new Set(futures.map((p) => p.symbol)),
    spotSymbols: new Set(spots.map((p) => p.symbol)),
    forexSymbols: new Set(forexes.map((p) => p.symbol)),
    forexPairCount: forexPairs.length,
    catalogInserted: catalogResult.inserted,
    catalogUpdated: catalogResult.updated
  };
}

function buildForexPairMetaRows(
  profiles: Array<{ symbol: string }>
): ForexPairMeta[] {
  return profiles.map((profile) => {
    const symbol = profile.symbol.trim().toUpperCase();
    const pairRaw = symbol.split(".", 2)[0] ?? symbol;
    const base = pairRaw.length >= 6 ? pairRaw.slice(0, 3) : null;
    const quote = pairRaw.length >= 6 ? pairRaw.slice(3, 6) : null;
    return {
      symbol,
      baseCcy: base,
      quoteCcy: quote,
      quoteConvention: base && quote ? `${base}/${quote}` : null,
      isActive: true
    } satisfies ForexPairMeta;
  });
}

async function upsertSqliteFxPairMeta(
  marketDb: SqliteDatabase,
  pairs: ForexPairMeta[]
): Promise<void> {
  if (pairs.length === 0) return;
  const now = Date.now();
  marketDb.exec("begin;");
  try {
    for (const pair of pairs) {
      marketDb.run(
        `
          insert into fx_pair_meta (
            symbol, base_ccy, quote_ccy, quote_convention, is_active, updated_at
          )
          values (?, ?, ?, ?, ?, ?)
          on conflict(symbol) do update set
            base_ccy = excluded.base_ccy,
            quote_ccy = excluded.quote_ccy,
            quote_convention = excluded.quote_convention,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at
        `,
        [
          pair.symbol,
          pair.baseCcy,
          pair.quoteCcy,
          pair.quoteConvention,
          pair.isActive ? 1 : 0,
          now
        ]
      );
    }
    const placeholders = pairs.map(() => "?").join(", ");
    marketDb.run(
      `
        update fx_pair_meta
        set is_active = 0, updated_at = ?
        where symbol not in (${placeholders})
      `,
      [now, ...pairs.map((pair) => pair.symbol)]
    );
    marketDb.exec("commit;");
  } catch (error) {
    try {
      marketDb.exec("rollback;");
    } catch {
      // ignore
    }
    throw error;
  }
}

async function ingestMacroUniverseSnapshot(
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  marketDb: SqliteDatabase,
  token: string,
  asOfTradeDate: string,
  runId: string,
  macroEnabled: boolean
): Promise<{
  seriesCount: number;
  observationCount: number;
  moduleSnapshotCount: number;
}> {
  if (!macroEnabled) {
    await recordIngestStep({
      marketDb,
      ingestRunId: runId,
      scopeId: "universe",
      domainId: "macro",
      moduleId: "macro.snapshot",
      stage: "extract",
      status: "skipped",
      inputRows: 0,
      outputRows: 0,
      droppedRows: 0,
      errorMessage: "macro module disabled by execution plan."
    });
    return {
      seriesCount: 0,
      observationCount: 0,
      moduleSnapshotCount: 0
    };
  }

  const now = Date.now();
  const historyStart = formatDate(
    addDays(parseDate(asOfTradeDate) ?? new Date(), -365 * 6)
  );
  const cnOpenTradeDates = await listOpenTradeDates(
    analysisHandle,
    historyStart,
    asOfTradeDate
  );

  const allObservations: MacroObservationRow[] = [];
  for (const spec of MACRO_SERIES_SPECS) {
    const response = await fetchMacroSeriesWithFallback(
      spec.apiName,
      token,
      historyStart,
      asOfTradeDate
    );
    const rows = mapMacroObservationRows(response, spec, cnOpenTradeDates, now);
    allObservations.push(...rows);
  }
  await recordIngestStep({
    marketDb,
    ingestRunId: runId,
    scopeId: "universe",
    domainId: "macro",
    moduleId: "macro.snapshot",
    stage: "extract",
    status: "success",
    inputRows: allObservations.length,
    outputRows: allObservations.length,
    droppedRows: 0,
    errorMessage: null
  });

  const observationRows = attachRevisionNumbers(allObservations);
  const latestBySeries = pickLatestMacroSeries(observationRows, asOfTradeDate, now);
  const moduleSnapshots = buildMacroModuleSnapshots(latestBySeries, asOfTradeDate, runId, now);
  await recordIngestStep({
    marketDb,
    ingestRunId: runId,
    scopeId: "universe",
    domainId: "macro",
    moduleId: "macro.snapshot",
    stage: "normalize",
    status: "success",
    inputRows: allObservations.length,
    outputRows: observationRows.length,
    droppedRows: Math.max(0, allObservations.length - observationRows.length),
    errorMessage: null
  });

  const conn = await analysisHandle.connect();
  try {
    await conn.query("begin transaction;");

    await upsertDuckdbRows(
      conn,
      "macro_series_meta",
      [
        "series_key",
        "region",
        "topic",
        "source_api",
        "frequency",
        "unit",
        "is_active",
        "updated_at"
      ],
      MACRO_SERIES_SPECS.map((spec) => [
        spec.seriesKey,
        spec.region,
        spec.topic,
        spec.apiName,
        spec.frequency,
        spec.unit,
        true,
        now
      ]),
      { keyColumns: ["series_key"] }
    );

    await upsertDuckdbRows(
      conn,
      "macro_observations",
      [
        "series_key",
        "period_end",
        "release_date",
        "available_date",
        "value",
        "unit",
        "frequency",
        "revision_no",
        "source",
        "ingested_at"
      ],
      observationRows.map((row) => [
        row.seriesKey,
        row.periodEnd,
        row.releaseDate,
        row.availableDate,
        row.value,
        row.unit,
        row.frequency,
        row.revisionNo,
        row.source,
        row.ingestedAt
      ]),
      { keyColumns: ["series_key", "period_end", "release_date"] }
    );

    await upsertDuckdbRows(
      conn,
      "macro_module_snapshot",
      [
        "as_of_trade_date",
        "module_id",
        "status",
        "coverage_ratio",
        "available_date",
        "payload_json",
        "source_run_id",
        "updated_at"
      ],
      moduleSnapshots.map((snapshot) => [
        snapshot.asOfTradeDate,
        snapshot.moduleId,
        snapshot.status,
        snapshot.coverageRatio,
        snapshot.availableDate,
        snapshot.payloadJson,
        snapshot.sourceRunId,
        snapshot.updatedAt
      ]),
      { keyColumns: ["as_of_trade_date", "module_id"] }
    );

    await conn.query("commit;");
  } catch (error) {
    try {
      await conn.query("rollback;");
    } catch {
      // ignore
    }
    throw error;
  } finally {
    await conn.close();
  }

  upsertSqliteMacroSeriesMeta(marketDb, now);
  upsertSqliteMacroLatest(marketDb, latestBySeries);
  upsertSqliteMacroModuleSnapshot(marketDb, moduleSnapshots);
  await recordIngestStep({
    marketDb,
    ingestRunId: runId,
    scopeId: "universe",
    domainId: "macro",
    moduleId: "macro.snapshot",
    stage: "upsert",
    status: "success",
    inputRows: observationRows.length,
    outputRows: observationRows.length + moduleSnapshots.length,
    droppedRows: 0,
    errorMessage: null
  });
  await recordIngestStep({
    marketDb,
    ingestRunId: runId,
    scopeId: "universe",
    domainId: "macro",
    moduleId: "macro.snapshot",
    stage: "evaluate",
    status: "success",
    inputRows: moduleSnapshots.length,
    outputRows: moduleSnapshots.length,
    droppedRows: 0,
    errorMessage: null
  });

  return {
    seriesCount: MACRO_SERIES_SPECS.length,
    observationCount: observationRows.length,
    moduleSnapshotCount: moduleSnapshots.length
  };
}

async function listOpenTradeDates(
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const conn = await analysisHandle.connect();
  try {
    const table = await conn.query(
      `
        select date
        from trade_calendar
        where market = 'CN'
          and is_open = true
          and date >= '${escapeSql(startDate)}'
          and date <= '${escapeSql(endDate)}'
        order by date
      `
    );
    const rows = table.toArray() as Array<{ date: string }>;
    return rows
      .map((row) => (row.date ?? "").trim())
      .filter((value) => value.length > 0);
  } finally {
    await conn.close();
  }
}

async function fetchMacroSeriesWithFallback(
  apiName: string,
  token: string,
  startDate: string,
  endDate: string
): Promise<{ fields: string[]; items: (string | number | null)[][] }> {
  const rangeParams = {
    start_date: toTushareDate(startDate),
    end_date: toTushareDate(endDate)
  };
  try {
    return await fetchTusharePaged(apiName, token, rangeParams, "", { pageSize: 2000 });
  } catch (error) {
    console.warn(
      `[mytrader] macro feed ${apiName} does not accept date range params, fallback to full pull.`
    );
    console.warn(error);
    return await fetchTusharePagedWithFallback(apiName, token, {}, "");
  }
}

function mapMacroObservationRows(
  response: { fields: string[]; items: (string | number | null)[][] },
  spec: MacroSeriesSpec,
  cnOpenTradeDates: string[],
  ingestedAt: number
): MacroObservationRow[] {
  const fields = response.fields ?? [];
  const items = response.items ?? [];
  if (fields.length === 0 || items.length === 0) return [];

  const periodIndexes = spec.periodFields
    .map((field) => fields.indexOf(field))
    .filter((index) => index >= 0);
  const releaseIndexes = spec.releaseFields
    .map((field) => fields.indexOf(field))
    .filter((index) => index >= 0);
  const valueIndexes = spec.valueFields
    .map((field) => fields.indexOf(field))
    .filter((index) => index >= 0);

  const rows: MacroObservationRow[] = [];
  for (const item of items) {
    const periodRaw = firstValueByIndexes(item, periodIndexes) ?? firstDateLikeValue(item);
    const periodEnd = parseMacroDate(periodRaw, "period_end");
    if (!periodEnd) continue;

    const releaseRaw = firstValueByIndexes(item, releaseIndexes);
    const parsedReleaseDate = parseMacroDate(releaseRaw, "release_date");
    const releaseDate = parsedReleaseDate ?? periodEnd;

    const value =
      firstNumericByIndexes(item, valueIndexes) ?? firstNumericValue(item);
    if (value === null) continue;

    const availableDate = resolveAvailableDate({
      periodEnd,
      releaseDate,
      hasReleaseDate: parsedReleaseDate !== null,
      spec,
      cnOpenTradeDates
    });
    if (!availableDate) continue;
    if (availableDate < releaseDate) continue;

    rows.push({
      seriesKey: spec.seriesKey,
      periodEnd,
      releaseDate,
      availableDate,
      value,
      unit: spec.unit,
      frequency: spec.frequency,
      revisionNo: 1,
      source: "tushare",
      ingestedAt
    });
  }

  return rows;
}

function attachRevisionNumbers(rows: MacroObservationRow[]): MacroObservationRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.seriesKey !== b.seriesKey) return a.seriesKey.localeCompare(b.seriesKey);
    if (a.periodEnd !== b.periodEnd) return a.periodEnd.localeCompare(b.periodEnd);
    if (a.releaseDate !== b.releaseDate) return a.releaseDate.localeCompare(b.releaseDate);
    return 0;
  });

  let lastKey = "";
  let revision = 0;
  return sorted.map((row) => {
    const key = `${row.seriesKey}|${row.periodEnd}`;
    if (key !== lastKey) {
      lastKey = key;
      revision = 1;
    } else {
      revision += 1;
    }
    return {
      ...row,
      revisionNo: revision
    };
  });
}

function pickLatestMacroSeries(
  rows: MacroObservationRow[],
  asOfTradeDate: string,
  updatedAt: number
): Map<string, MacroSeriesLatest> {
  const latestBySeries = new Map<string, MacroSeriesLatest>();
  for (const row of rows) {
    if (row.availableDate > asOfTradeDate) continue;
    const current = latestBySeries.get(row.seriesKey);
    const shouldReplace =
      !current ||
      row.availableDate > current.availableDate ||
      (row.availableDate === current.availableDate &&
        row.releaseDate > current.releaseDate);
    if (!shouldReplace) continue;
    latestBySeries.set(row.seriesKey, {
      seriesKey: row.seriesKey,
      availableDate: row.availableDate,
      value: row.value,
      periodEnd: row.periodEnd,
      releaseDate: row.releaseDate,
      frequency: row.frequency,
      source: row.source,
      updatedAt
    });
  }
  return latestBySeries;
}

function buildMacroModuleSnapshots(
  latestBySeries: Map<string, MacroSeriesLatest>,
  asOfTradeDate: string,
  runId: string,
  updatedAt: number
): MacroModuleSnapshotRow[] {
  const cnGrowthKeys = ["cn.gdp", "cn.cpi", "cn.ppi", "cn.pmi"];
  const cnRateKeys = ["cn.shibor", "cn.shibor_lpr"];
  const cnCreditKeys = ["cn.m2", "cn.social_financing"];
  const usRateKeys = ["us.tycr", "us.trycr", "us.tbr", "us.tltr", "us.trltr"];

  const cnGrowth = evaluateCountModule({
    latestBySeries,
    asOfTradeDate,
    moduleId: "macro.cn_growth_inflation",
    expectedSeries: cnGrowthKeys,
    completeAt: 2,
    runId,
    updatedAt
  });

  const cnRateAvailable = pickPresentSeries(latestBySeries, cnRateKeys);
  const cnCreditAvailable = pickPresentSeries(latestBySeries, cnCreditKeys);
  const cnLiquidityAvailable = [
    cnRateAvailable.length > 0 ? "rate" : null,
    cnCreditAvailable.length > 0 ? "credit" : null
  ].filter((value): value is string => value !== null);
  const cnLiquidityMissing = [
    cnRateAvailable.length > 0 ? null : "rate",
    cnCreditAvailable.length > 0 ? null : "credit"
  ].filter((value): value is string => value !== null);
  const cnLiquidityCoverage = cnLiquidityAvailable.length / 2;
  const cnLiquidity: MacroModuleSnapshotRow = {
    asOfTradeDate,
    moduleId: "macro.cn_liquidity",
    status:
      cnLiquidityAvailable.length === 2
        ? "complete"
        : cnLiquidityAvailable.length > 0
          ? "partial"
          : "missing",
    coverageRatio: roundRatio(cnLiquidityCoverage),
    availableDate: latestAvailableDate(
      latestBySeries,
      [...cnRateAvailable, ...cnCreditAvailable]
    ),
    payloadJson: JSON.stringify({
      expected_components: ["rate", "credit"],
      available_components: cnLiquidityAvailable,
      missing_components: cnLiquidityMissing,
      available_series: [...cnRateAvailable, ...cnCreditAvailable]
    }),
    sourceRunId: runId,
    updatedAt
  };

  const usRates = evaluateCountModule({
    latestBySeries,
    asOfTradeDate,
    moduleId: "macro.us_rates",
    expectedSeries: usRateKeys,
    completeAt: 4,
    runId,
    updatedAt
  });

  const cnReady = cnGrowth.status === "complete";
  const usReady = usRates.status === "complete";
  const crossAvailable =
    cnGrowth.status !== "missing" || usRates.status !== "missing";
  const crossCoverage = roundRatio(
    (cnGrowth.status !== "missing" ? 1 : 0) / 2 +
      (usRates.status !== "missing" ? 1 : 0) / 2
  );
  const crossModule: MacroModuleSnapshotRow = {
    asOfTradeDate,
    moduleId: "macro.cross_market",
    status: cnReady && usReady ? "complete" : crossAvailable ? "partial" : "missing",
    coverageRatio: crossCoverage,
    availableDate: latestAvailableDate(
      latestBySeries,
      [
        ...pickPresentSeries(latestBySeries, cnGrowthKeys),
        ...pickPresentSeries(latestBySeries, usRateKeys)
      ]
    ),
    payloadJson: JSON.stringify({
      cn_growth_status: cnGrowth.status,
      us_rates_status: usRates.status
    }),
    sourceRunId: runId,
    updatedAt
  };

  return [cnGrowth, cnLiquidity, usRates, crossModule];
}

function evaluateCountModule(input: {
  latestBySeries: Map<string, MacroSeriesLatest>;
  asOfTradeDate: string;
  moduleId: string;
  expectedSeries: string[];
  completeAt: number;
  runId: string;
  updatedAt: number;
}): MacroModuleSnapshotRow {
  const present = pickPresentSeries(input.latestBySeries, input.expectedSeries);
  const missing = input.expectedSeries.filter((series) => !present.includes(series));
  const availableCount = present.length;
  const coverage = availableCount / input.expectedSeries.length;

  return {
    asOfTradeDate: input.asOfTradeDate,
    moduleId: input.moduleId,
    status:
      availableCount >= input.completeAt
        ? "complete"
        : availableCount > 0
          ? "partial"
          : "missing",
    coverageRatio: roundRatio(coverage),
    availableDate: latestAvailableDate(input.latestBySeries, present),
    payloadJson: JSON.stringify({
      expected_series: input.expectedSeries,
      available_series: present,
      missing_series: missing
    }),
    sourceRunId: input.runId,
    updatedAt: input.updatedAt
  };
}

function pickPresentSeries(
  latestBySeries: Map<string, MacroSeriesLatest>,
  keys: string[]
): string[] {
  return keys.filter((key) => latestBySeries.has(key));
}

function latestAvailableDate(
  latestBySeries: Map<string, MacroSeriesLatest>,
  keys: string[]
): string | null {
  let latest: string | null = null;
  for (const key of keys) {
    const row = latestBySeries.get(key);
    if (!row) continue;
    if (!latest || row.availableDate > latest) {
      latest = row.availableDate;
    }
  }
  return latest;
}

function resolveAvailableDate(input: {
  periodEnd: string;
  releaseDate: string;
  hasReleaseDate: boolean;
  spec: MacroSeriesSpec;
  cnOpenTradeDates: string[];
}): string | null {
  const releaseDateObj = parseDate(input.releaseDate);
  const periodEndObj = parseDate(input.periodEnd);
  if (!periodEndObj) return null;

  const withLag = input.hasReleaseDate && releaseDateObj
    ? addHours(releaseDateObj, input.spec.safetyLagHours)
    : addDays(periodEndObj, input.spec.fallbackLagDays);
  const lagDate = formatDate(withLag);
  return nextTradeDateFromList(input.cnOpenTradeDates, lagDate) ?? lagDate;
}

function nextTradeDateFromList(
  sortedDates: string[],
  date: string
): string | null {
  if (sortedDates.length === 0) return null;
  let left = 0;
  let right = sortedDates.length - 1;
  let answer = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const current = sortedDates[mid];
    if (current >= date) {
      answer = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  if (answer >= 0) return sortedDates[answer];
  return sortedDates[sortedDates.length - 1] ?? null;
}

function firstValueByIndexes(
  row: (string | number | null)[],
  indexes: number[]
): string | number | null {
  for (const index of indexes) {
    const value = row[index];
    if (value === null || value === undefined) continue;
    const raw = String(value).trim();
    if (!raw) continue;
    return value;
  }
  return null;
}

function firstNumericByIndexes(
  row: (string | number | null)[],
  indexes: number[]
): number | null {
  for (const index of indexes) {
    const parsed = normalizeNumber(row[index]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstDateLikeValue(
  row: (string | number | null)[]
): string | number | null {
  for (const value of row) {
    const parsed = parseMacroDate(value, "period_end");
    if (parsed) return value;
  }
  return null;
}

function firstNumericValue(row: (string | number | null)[]): number | null {
  for (const value of row) {
    const parsed = normalizeNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function parseMacroDate(
  value: string | number | null,
  mode: "period_end" | "release_date"
): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = normalizeDate(raw);
  if (normalized) return normalized;

  if (/^\d{6}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6));
    if (month < 1 || month > 12) return null;
    return mode === "period_end"
      ? monthEndDate(year, month)
      : `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(raw);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month < 1 || month > 12) return null;
    return mode === "period_end"
      ? monthEndDate(year, month)
      : `${monthMatch[1]}-${monthMatch[2]}-01`;
  }

  const quarterMatch = /^(\d{4})Q([1-4])$/i.exec(raw);
  if (quarterMatch) {
    const year = Number(quarterMatch[1]);
    const quarter = Number(quarterMatch[2]);
    const month = quarter * 3;
    return monthEndDate(year, month);
  }

  if (/^\d{4}$/.test(raw)) {
    return mode === "period_end" ? `${raw}-12-31` : `${raw}-01-01`;
  }

  return null;
}

function monthEndDate(year: number, month: number): string {
  const date = new Date(year, month, 0);
  return formatDate(date);
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function upsertSqliteMacroSeriesMeta(
  marketDb: SqliteDatabase,
  updatedAt: number
): void {
  marketDb.exec("begin;");
  try {
    for (const spec of MACRO_SERIES_SPECS) {
      marketDb.run(
        `
          insert into macro_series_meta (
            series_key, region, topic, source_api, frequency, unit, is_active, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(series_key) do update set
            region = excluded.region,
            topic = excluded.topic,
            source_api = excluded.source_api,
            frequency = excluded.frequency,
            unit = excluded.unit,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at
        `,
        [
          spec.seriesKey,
          spec.region,
          spec.topic,
          spec.apiName,
          spec.frequency,
          spec.unit,
          1,
          updatedAt
        ]
      );
    }
    marketDb.exec("commit;");
  } catch (error) {
    try {
      marketDb.exec("rollback;");
    } catch {
      // ignore
    }
    throw error;
  }
}

function upsertSqliteMacroLatest(
  marketDb: SqliteDatabase,
  latestBySeries: Map<string, MacroSeriesLatest>
): void {
  if (latestBySeries.size === 0) return;
  marketDb.exec("begin;");
  try {
    for (const row of latestBySeries.values()) {
      marketDb.run(
        `
          insert into macro_observations_latest (
            series_key, available_date, value, period_end, release_date, frequency, source, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(series_key, available_date) do update set
            value = excluded.value,
            period_end = excluded.period_end,
            release_date = excluded.release_date,
            frequency = excluded.frequency,
            source = excluded.source,
            updated_at = excluded.updated_at
        `,
        [
          row.seriesKey,
          row.availableDate,
          row.value,
          row.periodEnd,
          row.releaseDate,
          row.frequency,
          row.source,
          row.updatedAt
        ]
      );
    }
    marketDb.exec("commit;");
  } catch (error) {
    try {
      marketDb.exec("rollback;");
    } catch {
      // ignore
    }
    throw error;
  }
}

function upsertSqliteMacroModuleSnapshot(
  marketDb: SqliteDatabase,
  snapshots: MacroModuleSnapshotRow[]
): void {
  if (snapshots.length === 0) return;
  marketDb.exec("begin;");
  try {
    for (const snapshot of snapshots) {
      marketDb.run(
        `
          insert into macro_module_snapshot (
            as_of_trade_date,
            module_id,
            status,
            coverage_ratio,
            available_date,
            payload_json,
            source_run_id,
            updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(as_of_trade_date, module_id) do update set
            status = excluded.status,
            coverage_ratio = excluded.coverage_ratio,
            available_date = excluded.available_date,
            payload_json = excluded.payload_json,
            source_run_id = excluded.source_run_id,
            updated_at = excluded.updated_at
        `,
        [
          snapshot.asOfTradeDate,
          snapshot.moduleId,
          snapshot.status,
          snapshot.coverageRatio,
          snapshot.availableDate,
          snapshot.payloadJson,
          snapshot.sourceRunId,
          snapshot.updatedAt
        ]
      );
    }
    marketDb.exec("commit;");
  } catch (error) {
    try {
      marketDb.exec("rollback;");
    } catch {
      // ignore
    }
    throw error;
  }
}

async function ingestUniverseRecoveryModules(input: {
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>;
  marketDb: SqliteDatabase;
  token: string;
  asOfTradeDate: string;
  windowStart: string;
  mode: IngestRunMode;
  recoveryModules: UniverseRecoveryModules;
  stockSymbols: Set<string>;
  indexSymbols: Set<string>;
  totals: IngestTotals;
  control?: IngestExecutionControl;
}): Promise<RecoveryModuleSummary[]> {
  const summaries: RecoveryModuleSummary[] = [];

  if (!input.recoveryModules.indexDailyEnabled) {
    summaries.push({
      module: "index_daily",
      enabled: false,
      status: "disabled",
      processedTradeDate: null,
      processedSymbols: 0,
      pendingTradeDates: 0,
      pendingSymbolsInDate: 0,
      errors: 0,
      cursor: null
    });
  } else {
    const summary = await ingestIndexDailyWave1(input);
    summaries.push(summary);
  }

  if (!input.recoveryModules.dailyBasicEnabled) {
    summaries.push({
      module: "daily_basic",
      enabled: false,
      status: "disabled",
      processedTradeDate: null,
      processedSymbols: 0,
      pendingTradeDates: 0,
      pendingSymbolsInDate: 0,
      errors: 0,
      cursor: null
    });
  } else {
    const summary = await ingestDailyBasicWave2(input);
    summaries.push(summary);
  }

  if (!input.recoveryModules.moneyflowEnabled) {
    summaries.push({
      module: "moneyflow",
      enabled: false,
      status: "disabled",
      processedTradeDate: null,
      processedSymbols: 0,
      pendingTradeDates: 0,
      pendingSymbolsInDate: 0,
      errors: 0,
      cursor: null
    });
  } else {
    const summary = await ingestMoneyflowWave3(input);
    summaries.push(summary);
  }

  return summaries;
}

async function ingestIndexDailyWave1(input: {
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>;
  marketDb: SqliteDatabase;
  token: string;
  asOfTradeDate: string;
  windowStart: string;
  mode: IngestRunMode;
  indexSymbols: Set<string>;
  totals: IngestTotals;
  control?: IngestExecutionControl;
}): Promise<RecoveryModuleSummary> {
  const summaryBase: RecoveryModuleSummary = {
    module: "index_daily",
    enabled: true,
    status: "success",
    processedTradeDate: null,
    processedSymbols: 0,
    pendingTradeDates: 0,
    pendingSymbolsInDate: 0,
    errors: 0,
    cursor: null
  };
  if (input.indexSymbols.size === 0) {
    return summaryBase;
  }

  const allTradeDates = await listOpenTradeDatesBetween(
    input.marketDb,
    "CN",
    input.windowStart,
    input.asOfTradeDate
  );
  if (allTradeDates.length === 0) {
    return summaryBase;
  }

  const cursor = await getUniverseModuleCursor(input.marketDb, UNIVERSE_CURSOR_INDEX_DAILY_KEY);
  const cursorState = normalizeUniverseRecoveryCursor(cursor, input.windowStart, allTradeDates);
  summaryBase.cursor = cursorState ? JSON.stringify(cursorState) : null;

  const targetDate = cursorState.tradeDate;
  const dateIndex = allTradeDates.findIndex((value) => value === targetDate);
  if (dateIndex === -1) {
    return {
      ...summaryBase,
      status: "partial",
      errors: 1
    };
  }

  const sortedSymbols = Array.from(input.indexSymbols).sort();
  if (sortedSymbols.length === 0) return summaryBase;

  const symbolOffset = Math.max(0, Math.min(cursorState.symbolOffset, sortedSymbols.length));
  const chunkSize = resolveIndexDailySymbolBatchSize(input.mode);
  const symbolBatch = sortedSymbols.slice(symbolOffset, symbolOffset + chunkSize);
  const tradeDateRaw = toTushareDate(targetDate);

  const conn = await input.analysisHandle.connect();
  let rowsInserted = 0;
  try {
    await conn.query("begin transaction;");
    const now = Date.now();
    for (const symbol of symbolBatch) {
      await checkpointOrThrow(input.control);
      const res = await fetchTusharePagedWithFallback(
        "index_daily",
        input.token,
        { ts_code: symbol, trade_date: tradeDateRaw },
        "ts_code,trade_date,open,high,low,close,vol"
      );
      const rows = mapDailyPriceRows(
        res,
        new Set([symbol]),
        "tushare",
        now
      );
      if (rows.length === 0) continue;
      await upsertDuckdbRows(
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
        rows
      );
      rowsInserted += rows.length;
    }
    await conn.query("commit;");
  } catch (error) {
    try {
      await conn.query("rollback;");
    } catch {
      // ignore
    }
    return {
      ...summaryBase,
      status: "failed",
      processedTradeDate: targetDate,
      processedSymbols: symbolBatch.length,
      pendingTradeDates: Math.max(0, allTradeDates.length - dateIndex),
      pendingSymbolsInDate: Math.max(0, sortedSymbols.length - symbolOffset),
      errors: 1
    };
  } finally {
    await conn.close();
  }

  input.totals.inserted += rowsInserted;
  const finishedOffset = symbolOffset + symbolBatch.length;
  const dateCompleted = finishedOffset >= sortedSymbols.length;
  const nextCursor: { tradeDate: string; symbolOffset: number } | null = dateCompleted
    ? dateIndex + 1 < allTradeDates.length
      ? { tradeDate: allTradeDates[dateIndex + 1], symbolOffset: 0 }
      : null
    : { tradeDate: targetDate, symbolOffset: finishedOffset };
  await setUniverseModuleCursor(
    input.marketDb,
    UNIVERSE_CURSOR_INDEX_DAILY_KEY,
    nextCursor ? JSON.stringify(nextCursor) : null
  );

  return {
    ...summaryBase,
    status: dateCompleted ? "success" : "partial",
    processedTradeDate: targetDate,
    processedSymbols: symbolBatch.length,
    pendingTradeDates: dateCompleted
      ? Math.max(0, allTradeDates.length - dateIndex - 1)
      : Math.max(0, allTradeDates.length - dateIndex),
    pendingSymbolsInDate: dateCompleted
      ? 0
      : Math.max(0, sortedSymbols.length - finishedOffset),
    errors: 0,
    cursor: nextCursor ? JSON.stringify(nextCursor) : null
  };
}

async function ingestDailyBasicWave2(input: {
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>;
  marketDb: SqliteDatabase;
  token: string;
  asOfTradeDate: string;
  windowStart: string;
  mode: IngestRunMode;
  stockSymbols: Set<string>;
  totals: IngestTotals;
  control?: IngestExecutionControl;
}): Promise<RecoveryModuleSummary> {
  const summaryBase: RecoveryModuleSummary = {
    module: "daily_basic",
    enabled: true,
    status: "success",
    processedTradeDate: null,
    processedSymbols: 0,
    pendingTradeDates: 0,
    pendingSymbolsInDate: 0,
    errors: 0,
    cursor: null
  };
  if (input.stockSymbols.size === 0) {
    return summaryBase;
  }

  const allTradeDates = await listOpenTradeDatesBetween(
    input.marketDb,
    "CN",
    input.windowStart,
    input.asOfTradeDate
  );
  if (allTradeDates.length === 0) {
    return summaryBase;
  }

  const cursor = await getUniverseModuleCursor(input.marketDb, UNIVERSE_CURSOR_DAILY_BASIC_KEY);
  const cursorState = normalizeUniverseRecoveryCursor(cursor, input.windowStart, allTradeDates);
  summaryBase.cursor = JSON.stringify(cursorState);

  const targetDate = cursorState.tradeDate;
  const dateIndex = allTradeDates.findIndex((value) => value === targetDate);
  if (dateIndex === -1) {
    return {
      ...summaryBase,
      status: "partial",
      errors: 1
    };
  }

  const sortedSymbols = Array.from(input.stockSymbols).sort();
  if (sortedSymbols.length === 0) return summaryBase;

  const symbolOffset = Math.max(0, Math.min(cursorState.symbolOffset, sortedSymbols.length));
  const chunkSize = resolveDailyBasicSymbolBatchSize(input.mode);
  const symbolBatch = sortedSymbols.slice(symbolOffset, symbolOffset + chunkSize);
  const tradeDateRaw = toTushareDate(targetDate);
  const now = Date.now();
  const basicRows: ReturnType<typeof mapDailyBasicRows> = [];

  let fetchErrors = 0;
  let nextOffset = symbolOffset;
  for (let index = 0; index < symbolBatch.length; index += 1) {
    const symbol = symbolBatch[index];
    await checkpointOrThrow(input.control);
    try {
      const res = await fetchTusharePaged(
        "daily_basic",
        input.token,
        { ts_code: symbol, trade_date: tradeDateRaw },
        "ts_code,trade_date,circ_mv,total_mv,pe_ttm,pb,ps_ttm,ev_ebitda,ev_sales,dv_ttm,turnover_rate"
      );
      const rows = mapDailyBasicRows(res, new Set([symbol]), "tushare", now);
      basicRows.push(...rows);
      nextOffset = symbolOffset + index + 1;
    } catch (error) {
      fetchErrors += 1;
      console.warn(`[mytrader] daily_basic wave2 failed for ${symbol} ${targetDate}`);
      console.warn(error);
      break;
    }
  }

  if (basicRows.length > 0) {
    const conn = await input.analysisHandle.connect();
    try {
      await conn.query("begin transaction;");
      await upsertDuckdbRows(conn, "daily_basics", [
        "symbol",
        "trade_date",
        "circ_mv",
        "total_mv",
        "pe_ttm",
        "pb",
        "ps_ttm",
        "ev_ebitda_ttm",
        "ev_sales_ttm",
        "dv_ttm",
        "turnover_rate",
        "source",
        "ingested_at"
      ], basicRows);
      await conn.query("commit;");
      input.totals.inserted += basicRows.length;
    } catch (error) {
      try {
        await conn.query("rollback;");
      } catch {
        // ignore
      }
      return {
        ...summaryBase,
        status: "failed",
        processedTradeDate: targetDate,
        processedSymbols: Math.max(0, nextOffset - symbolOffset),
        pendingTradeDates: Math.max(0, allTradeDates.length - dateIndex),
        pendingSymbolsInDate: Math.max(0, sortedSymbols.length - symbolOffset),
        errors: fetchErrors + 1,
        cursor: JSON.stringify(cursorState)
      };
    } finally {
      await conn.close();
    }
  }

  const hasSymbolError = fetchErrors > 0;
  const finishedOffset = nextOffset;
  const dateCompleted =
    !hasSymbolError && finishedOffset >= sortedSymbols.length;
  const nextCursor: { tradeDate: string; symbolOffset: number } | null = hasSymbolError
    ? { tradeDate: targetDate, symbolOffset: finishedOffset }
    : dateCompleted
      ? dateIndex + 1 < allTradeDates.length
        ? { tradeDate: allTradeDates[dateIndex + 1], symbolOffset: 0 }
        : null
      : { tradeDate: targetDate, symbolOffset: finishedOffset };
  await setUniverseModuleCursor(
    input.marketDb,
    UNIVERSE_CURSOR_DAILY_BASIC_KEY,
    nextCursor ? JSON.stringify(nextCursor) : null
  );

  return {
    ...summaryBase,
    status: hasSymbolError ? "failed" : dateCompleted ? "success" : "partial",
    processedTradeDate: targetDate,
    processedSymbols: Math.max(0, finishedOffset - symbolOffset),
    pendingTradeDates: hasSymbolError
      ? Math.max(0, allTradeDates.length - dateIndex)
      : dateCompleted
        ? Math.max(0, allTradeDates.length - dateIndex - 1)
        : Math.max(0, allTradeDates.length - dateIndex),
    pendingSymbolsInDate: hasSymbolError
      ? Math.max(0, sortedSymbols.length - finishedOffset)
      : dateCompleted
        ? 0
        : Math.max(0, sortedSymbols.length - finishedOffset),
    errors: fetchErrors,
    cursor: nextCursor ? JSON.stringify(nextCursor) : null
  };
}

async function ingestMoneyflowWave3(input: {
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>;
  marketDb: SqliteDatabase;
  token: string;
  asOfTradeDate: string;
  windowStart: string;
  mode: IngestRunMode;
  stockSymbols: Set<string>;
  totals: IngestTotals;
  control?: IngestExecutionControl;
}): Promise<RecoveryModuleSummary> {
  const summaryBase: RecoveryModuleSummary = {
    module: "moneyflow",
    enabled: true,
    status: "success",
    processedTradeDate: null,
    processedSymbols: 0,
    pendingTradeDates: 0,
    pendingSymbolsInDate: 0,
    errors: 0,
    cursor: null
  };
  if (input.stockSymbols.size === 0) {
    return summaryBase;
  }

  const allTradeDates = await listOpenTradeDatesBetween(
    input.marketDb,
    "CN",
    input.windowStart,
    input.asOfTradeDate
  );
  if (allTradeDates.length === 0) {
    return summaryBase;
  }

  const cursor = await getUniverseModuleCursor(input.marketDb, UNIVERSE_CURSOR_MONEYFLOW_KEY);
  const cursorState = normalizeUniverseRecoveryCursor(cursor, input.windowStart, allTradeDates);
  summaryBase.cursor = JSON.stringify(cursorState);

  const targetDate = cursorState.tradeDate;
  const dateIndex = allTradeDates.findIndex((value) => value === targetDate);
  if (dateIndex === -1) {
    return {
      ...summaryBase,
      status: "partial",
      errors: 1
    };
  }

  const sortedSymbols = Array.from(input.stockSymbols).sort();
  if (sortedSymbols.length === 0) return summaryBase;

  const symbolOffset = Math.max(0, Math.min(cursorState.symbolOffset, sortedSymbols.length));
  const chunkSize = resolveMoneyflowSymbolBatchSize(input.mode);
  const symbolBatch = sortedSymbols.slice(symbolOffset, symbolOffset + chunkSize);
  const tradeDateRaw = toTushareDate(targetDate);
  const now = Date.now();
  const moneyflowRows: Array<[string, string, number | null, number | null, string, number]> = [];

  let fetchErrors = 0;
  let nextOffset = symbolOffset;
  for (let index = 0; index < symbolBatch.length; index += 1) {
    const symbol = symbolBatch[index];
    await checkpointOrThrow(input.control);
    try {
      const res = await fetchTusharePaged(
        "moneyflow",
        input.token,
        { ts_code: symbol, trade_date: tradeDateRaw },
        "ts_code,trade_date,net_mf_vol,net_mf_amount"
      );
      const rows = mapDailyMoneyflowRows(res, new Set([symbol]), "tushare", now);
      moneyflowRows.push(...rows);
      nextOffset = symbolOffset + index + 1;
    } catch (error) {
      fetchErrors += 1;
      console.warn(`[mytrader] moneyflow wave3 failed for ${symbol} ${targetDate}`);
      console.warn(error);
      break;
    }
  }

  if (moneyflowRows.length > 0) {
    const conn = await input.analysisHandle.connect();
    try {
      await conn.query("begin transaction;");
      await upsertDuckdbRows(conn, "daily_moneyflows", [
        "symbol",
        "trade_date",
        "net_mf_vol",
        "net_mf_amount",
        "source",
        "ingested_at"
      ], moneyflowRows);
      await conn.query("commit;");
      input.totals.inserted += moneyflowRows.length;
    } catch (error) {
      try {
        await conn.query("rollback;");
      } catch {
        // ignore
      }
      return {
        ...summaryBase,
        status: "failed",
        processedTradeDate: targetDate,
        processedSymbols: Math.max(0, nextOffset - symbolOffset),
        pendingTradeDates: Math.max(0, allTradeDates.length - dateIndex),
        pendingSymbolsInDate: Math.max(0, sortedSymbols.length - symbolOffset),
        errors: fetchErrors + 1,
        cursor: JSON.stringify(cursorState)
      };
    } finally {
      await conn.close();
    }
  }

  const hasSymbolError = fetchErrors > 0;
  const finishedOffset = nextOffset;
  const dateCompleted =
    !hasSymbolError && finishedOffset >= sortedSymbols.length;
  const nextCursor: { tradeDate: string; symbolOffset: number } | null = hasSymbolError
    ? { tradeDate: targetDate, symbolOffset: finishedOffset }
    : dateCompleted
      ? dateIndex + 1 < allTradeDates.length
        ? { tradeDate: allTradeDates[dateIndex + 1], symbolOffset: 0 }
        : null
      : { tradeDate: targetDate, symbolOffset: finishedOffset };
  await setUniverseModuleCursor(
    input.marketDb,
    UNIVERSE_CURSOR_MONEYFLOW_KEY,
    nextCursor ? JSON.stringify(nextCursor) : null
  );

  return {
    ...summaryBase,
    status: hasSymbolError ? "failed" : dateCompleted ? "success" : "partial",
    processedTradeDate: targetDate,
    processedSymbols: Math.max(0, finishedOffset - symbolOffset),
    pendingTradeDates: hasSymbolError
      ? Math.max(0, allTradeDates.length - dateIndex)
      : dateCompleted
        ? Math.max(0, allTradeDates.length - dateIndex - 1)
        : Math.max(0, allTradeDates.length - dateIndex),
    pendingSymbolsInDate: hasSymbolError
      ? Math.max(0, sortedSymbols.length - finishedOffset)
      : dateCompleted
        ? 0
        : Math.max(0, sortedSymbols.length - finishedOffset),
    errors: fetchErrors,
    cursor: nextCursor ? JSON.stringify(nextCursor) : null
  };
}

function normalizeUniverseRecoveryCursor(
  raw: string | null,
  fallbackStartDate: string,
  allTradeDates: string[]
): { tradeDate: string; symbolOffset: number } {
  if (!raw) {
    return {
      tradeDate: allTradeDates[0] ?? fallbackStartDate,
      symbolOffset: 0
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const tradeDate =
      typeof (parsed as { tradeDate?: unknown })?.tradeDate === "string"
        ? String((parsed as { tradeDate?: string }).tradeDate).trim()
        : "";
    const symbolOffset = Number((parsed as { symbolOffset?: unknown })?.symbolOffset);
    return {
      tradeDate:
        tradeDate && allTradeDates.includes(tradeDate)
          ? tradeDate
          : allTradeDates[0] ?? fallbackStartDate,
      symbolOffset:
        Number.isFinite(symbolOffset) && symbolOffset > 0
          ? Math.floor(symbolOffset)
          : 0
    };
  } catch {
    return {
      tradeDate: allTradeDates[0] ?? fallbackStartDate,
      symbolOffset: 0
    };
  }
}

function resolveIndexDailySymbolBatchSize(mode: IngestRunMode): number {
  if (mode === "bootstrap") return INDEX_DAILY_WAVE1_SYMBOL_BATCH_SIZE;
  return Math.max(20, Math.floor(INDEX_DAILY_WAVE1_SYMBOL_BATCH_SIZE / 2));
}

function resolveDailyBasicSymbolBatchSize(mode: IngestRunMode): number {
  if (mode === "bootstrap") return DAILY_BASIC_WAVE2_SYMBOL_BATCH_SIZE;
  return Math.max(20, Math.floor(DAILY_BASIC_WAVE2_SYMBOL_BATCH_SIZE / 2));
}

function resolveMoneyflowSymbolBatchSize(mode: IngestRunMode): number {
  if (mode === "bootstrap") return MONEYFLOW_WAVE3_SYMBOL_BATCH_SIZE;
  return Math.max(20, Math.floor(MONEYFLOW_WAVE3_SYMBOL_BATCH_SIZE / 2));
}

async function ingestUniverseTradeDate(
  ingestRunId: string,
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  marketDb: SqliteDatabase,
  token: string,
  tradeDate: string,
  stockSymbols: Set<string>,
  etfSymbols: Set<string>,
  indexSymbols: Set<string>,
  futuresSymbols: Set<string>,
  spotSymbols: Set<string>,
  forexSymbols: Set<string>,
  fxDailyEnabled: boolean,
  totals: IngestTotals
): Promise<void> {
  const tradeDateRaw = toTushareDate(tradeDate);

  const [
    daily,
    fundDaily,
    indexDaily,
    futuresDaily,
    spotDaily,
    forexDaily
  ] = await Promise.all([
    stockSymbols.size > 0
      ? fetchTusharePaged(
          "daily",
          token,
          { trade_date: tradeDateRaw },
          "ts_code,trade_date,open,high,low,close,vol"
        )
      : { fields: [], items: [] },
    etfSymbols.size > 0
      ? fetchTusharePaged(
          "fund_daily",
          token,
          { trade_date: tradeDateRaw },
          "ts_code,trade_date,open,high,low,close,vol"
        )
      : { fields: [], items: [] },
    Promise.resolve({ fields: [], items: [] }),
    futuresSymbols.size > 0
      ? fetchTusharePagedWithFallback(
          "fut_daily",
          token,
          { trade_date: tradeDateRaw },
          "ts_code,trade_date,open,high,low,close,vol"
        )
      : { fields: [], items: [] },
    spotSymbols.size > 0
      ? fetchTusharePagedWithFallback(
          "sge_daily",
          token,
          { trade_date: tradeDateRaw },
          "ts_code,trade_date,open,high,low,close,vol"
        )
      : { fields: [], items: [] },
    fxDailyEnabled && forexSymbols.size > 0
      ? fetchTusharePagedWithFallback(
          "fx_daily",
          token,
          { trade_date: tradeDateRaw },
          "ts_code,trade_date,open,high,low,close,vol"
        )
      : { fields: [], items: [] }
  ]);

  const now = Date.now();
  const basics = { fields: [], items: [] as (string | number | null)[][] };
  const moneyflow = { fields: [], items: [] as (string | number | null)[][] };

  const dailyRows = mapDailyPriceRows(daily, stockSymbols, "tushare", now);
  const fundRows = mapDailyPriceRows(fundDaily, etfSymbols, "tushare", now);
  const indexRows = mapDailyPriceRows(indexDaily, indexSymbols, "tushare", now);
  const futuresRows = mapDailyPriceRows(
    futuresDaily,
    futuresSymbols,
    "tushare",
    now
  );
  const spotRows = mapDailyPriceRows(spotDaily, spotSymbols, "tushare", now);
  const forexRows = mapDailyPriceRows(forexDaily, forexSymbols, "tushare", now);
  const basicRows = mapDailyBasicRows(basics, stockSymbols, "tushare", now);
  const moneyRows = mapDailyMoneyflowRows(moneyflow, stockSymbols, "tushare", now);

  await Promise.all([
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "stock",
      moduleId: "stock.market.daily",
      stage: "extract",
      status: "success",
      inputRows: daily.items.length,
      outputRows: dailyRows.length,
      droppedRows: Math.max(0, daily.items.length - dailyRows.length),
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "etf",
      moduleId: "etf.daily_quote",
      stage: "extract",
      status: "success",
      inputRows: fundDaily.items.length,
      outputRows: fundRows.length,
      droppedRows: Math.max(0, fundDaily.items.length - fundRows.length),
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "futures",
      moduleId: "futures.daily",
      stage: "extract",
      status: "success",
      inputRows: futuresDaily.items.length,
      outputRows: futuresRows.length,
      droppedRows: Math.max(0, futuresDaily.items.length - futuresRows.length),
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "spot",
      moduleId: "spot.sge_daily",
      stage: "extract",
      status: "success",
      inputRows: spotDaily.items.length,
      outputRows: spotRows.length,
      droppedRows: Math.max(0, spotDaily.items.length - spotRows.length),
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "fx",
      moduleId: "fx.daily",
      stage: "extract",
      status: "success",
      inputRows: forexDaily.items.length,
      outputRows: forexRows.length,
      droppedRows: Math.max(0, forexDaily.items.length - forexRows.length),
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "stock",
      moduleId: "stock.moneyflow",
      stage: "extract",
      status: "success",
      inputRows: moneyflow.items.length,
      outputRows: moneyRows.length,
      droppedRows: Math.max(0, moneyflow.items.length - moneyRows.length),
      errorMessage: null,
      key: tradeDate
    })
  ]);
  await Promise.all([
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "stock",
      moduleId: "stock.market.daily",
      stage: "normalize",
      status: "success",
      inputRows: dailyRows.length,
      outputRows: dailyRows.length,
      droppedRows: 0,
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "etf",
      moduleId: "etf.daily_quote",
      stage: "normalize",
      status: "success",
      inputRows: fundRows.length,
      outputRows: fundRows.length,
      droppedRows: 0,
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "futures",
      moduleId: "futures.daily",
      stage: "normalize",
      status: "success",
      inputRows: futuresRows.length,
      outputRows: futuresRows.length,
      droppedRows: 0,
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "spot",
      moduleId: "spot.sge_daily",
      stage: "normalize",
      status: "success",
      inputRows: spotRows.length,
      outputRows: spotRows.length,
      droppedRows: 0,
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "fx",
      moduleId: "fx.daily",
      stage: "normalize",
      status: "success",
      inputRows: forexRows.length,
      outputRows: forexRows.length,
      droppedRows: 0,
      errorMessage: null,
      key: tradeDate
    }),
    recordIngestStep({
      marketDb,
      ingestRunId,
      scopeId: "universe",
      domainId: "stock",
      moduleId: "stock.moneyflow",
      stage: "normalize",
      status: "success",
      inputRows: moneyRows.length,
      outputRows: moneyRows.length,
      droppedRows: 0,
      errorMessage: null,
      key: tradeDate
    })
  ]);

  const conn = await analysisHandle.connect();
  try {
    await conn.query("begin transaction;");
    await upsertDuckdbRows(conn, "daily_prices", [
      "symbol",
      "trade_date",
      "open",
      "high",
      "low",
      "close",
      "volume",
      "source",
      "ingested_at"
    ], [
      ...dailyRows,
      ...fundRows,
      ...indexRows,
      ...futuresRows,
      ...spotRows,
      ...forexRows
    ]);
    await upsertDuckdbRows(conn, "daily_basics", [
      "symbol",
      "trade_date",
      "circ_mv",
      "total_mv",
      "pe_ttm",
      "pb",
      "ps_ttm",
      "ev_ebitda_ttm",
      "ev_sales_ttm",
      "dv_ttm",
      "turnover_rate",
      "source",
      "ingested_at"
    ], basicRows);
    await upsertDuckdbRows(conn, "daily_moneyflows", [
      "symbol",
      "trade_date",
      "net_mf_vol",
      "net_mf_amount",
      "source",
      "ingested_at"
    ], moneyRows);
    await conn.query("commit;");

    await Promise.all([
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "stock",
        moduleId: "stock.market.daily",
        stage: "upsert",
        status: "success",
        inputRows: dailyRows.length,
        outputRows: dailyRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "etf",
        moduleId: "etf.daily_quote",
        stage: "upsert",
        status: "success",
        inputRows: fundRows.length,
        outputRows: fundRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "futures",
        moduleId: "futures.daily",
        stage: "upsert",
        status: "success",
        inputRows: futuresRows.length,
        outputRows: futuresRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "spot",
        moduleId: "spot.sge_daily",
        stage: "upsert",
        status: "success",
        inputRows: spotRows.length,
        outputRows: spotRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "fx",
        moduleId: "fx.daily",
        stage: "upsert",
        status: "success",
        inputRows: forexRows.length,
        outputRows: forexRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "stock",
        moduleId: "stock.moneyflow",
        stage: "upsert",
        status: "success",
        inputRows: moneyRows.length,
        outputRows: moneyRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      })
    ]);
    await Promise.all([
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "stock",
        moduleId: "stock.market.daily",
        stage: "evaluate",
        status: "success",
        inputRows: dailyRows.length,
        outputRows: dailyRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "etf",
        moduleId: "etf.daily_quote",
        stage: "evaluate",
        status: "success",
        inputRows: fundRows.length,
        outputRows: fundRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "futures",
        moduleId: "futures.daily",
        stage: "evaluate",
        status: "success",
        inputRows: futuresRows.length,
        outputRows: futuresRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "spot",
        moduleId: "spot.sge_daily",
        stage: "evaluate",
        status: "success",
        inputRows: spotRows.length,
        outputRows: spotRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "fx",
        moduleId: "fx.daily",
        stage: "evaluate",
        status: "success",
        inputRows: forexRows.length,
        outputRows: forexRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "stock",
        moduleId: "stock.moneyflow",
        stage: "evaluate",
        status: "success",
        inputRows: moneyRows.length,
        outputRows: moneyRows.length,
        droppedRows: 0,
        errorMessage: null,
        key: tradeDate
      })
    ]);

    totals.inserted +=
      dailyRows.length +
      fundRows.length +
      indexRows.length +
      futuresRows.length +
      spotRows.length +
      forexRows.length +
      basicRows.length +
      moneyRows.length;
  } catch (err) {
    totals.errors += 1;
    await Promise.all([
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "stock",
        moduleId: "stock.market.daily",
        stage: "upsert",
        status: "failed",
        inputRows: dailyRows.length,
        outputRows: 0,
        droppedRows: 0,
        errorMessage: toErrorMessage(err),
        key: tradeDate
      }),
      recordIngestStep({
        marketDb,
        ingestRunId,
        scopeId: "universe",
        domainId: "etf",
        moduleId: "etf.daily_quote",
        stage: "upsert",
        status: "failed",
        inputRows: fundRows.length,
        outputRows: 0,
        droppedRows: 0,
        errorMessage: toErrorMessage(err),
        key: tradeDate
      })
    ]);
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

async function fetchTusharePagedWithFallback(
  apiName: string,
  token: string,
  params: Record<string, string | undefined>,
  fields: string
): Promise<{ fields: string[]; items: (string | number | null)[][] }> {
  try {
    return await fetchTusharePaged(apiName, token, params, fields);
  } catch (error) {
    console.warn(
      `[mytrader] optional universe feed ${apiName} unavailable for current run, continue.`
    );
    console.warn(error);
    return { fields: [], items: [] };
  }
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
  const fields = res.fields ?? [];
  const rows = res.items ?? [];
  const idxSymbol = fields.indexOf("ts_code");
  const idxDate = fields.indexOf("trade_date");
  const idxCirc = fields.indexOf("circ_mv");
  const idxTotal = fields.indexOf("total_mv");
  const idxPeTtm = fields.indexOf("pe_ttm");
  const idxPb = fields.indexOf("pb");
  const idxPsTtm = fields.indexOf("ps_ttm");
  const idxEvEbitda = fields.indexOf("ev_ebitda");
  const idxEvSales = fields.indexOf("ev_sales");
  const idxDvTtm = fields.indexOf("dv_ttm");
  const idxTurnoverRate = fields.indexOf("turnover_rate");
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
      idxCirc === -1 ? null : normalizeNumber(row[idxCirc]),
      idxTotal === -1 ? null : normalizeNumber(row[idxTotal]),
      idxPeTtm === -1 ? null : normalizeNumber(row[idxPeTtm]),
      idxPb === -1 ? null : normalizeNumber(row[idxPb]),
      idxPsTtm === -1 ? null : normalizeNumber(row[idxPsTtm]),
      idxEvEbitda === -1 ? null : normalizeNumber(row[idxEvEbitda]),
      idxEvSales === -1 ? null : normalizeNumber(row[idxEvSales]),
      idxDvTtm === -1 ? null : normalizeNumber(row[idxDvTtm]),
      idxTurnoverRate === -1 ? null : normalizeNumber(row[idxTurnoverRate]),
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

async function upsertDuckdbRows(
  conn: AsyncDuckDBConnection,
  table: string,
  columns: string[],
  rows: any[][],
  options?: {
    keyColumns?: string[];
  }
): Promise<void> {
  if (rows.length === 0) return;

  const chunkSize = 500;
  const keyColumns = options?.keyColumns ?? columns.slice(0, 2);
  if (keyColumns.length === 0) {
    throw new Error(`upsertDuckdbRows(${table}) requires key columns.`);
  }
  const cols = columns.map((c) => `"${c}"`).join(", ");
  const keyCols = keyColumns.map((c) => `"${c}"`).join(", ");
  const updateCols = columns
    .filter((column) => !keyColumns.includes(column))
    .map((c) => `"${c}" = excluded.\"${c}\"`)
    .join(", ");

  for (let idx = 0; idx < rows.length; idx += chunkSize) {
    const chunk = rows.slice(idx, idx + chunkSize);
    const valuesSql = chunk.map((row) => `(${row.map(formatDuckdbValue).join(", ")})`).join(", ");
    const sql = `
      insert into ${table} (${cols})
      values ${valuesSql}
      on conflict(${keyCols}) do ${
      updateCols.length > 0 ? `update set ${updateCols}` : "nothing"
    }
    `;
    await conn.query(sql);
  }
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

async function getUniverseCursorDate(
  marketDb: SqliteDatabase,
  fallback: string
): Promise<string> {
  const value = await getUniverseModuleCursor(marketDb, UNIVERSE_CURSOR_PRIMARY_KEY);
  if (!value) return fallback;
  const next = nextDate(value);
  return next < fallback ? fallback : next;
}

async function setUniverseCursorDate(
  marketDb: SqliteDatabase,
  value: string
): Promise<void> {
  await setUniverseModuleCursor(marketDb, UNIVERSE_CURSOR_PRIMARY_KEY, value);
}

async function getUniverseModuleCursor(
  marketDb: SqliteDatabase,
  key: string
): Promise<string | null> {
  const rows = await marketDb.exec(
    `select value from market_meta where key = '${escapeSql(key)}' limit 1`
  );
  if (!rows.length) return null;
  const values = rows[0]?.values ?? [];
  if (!values.length) return null;
  const value = String(values[0]?.[0] ?? "").trim();
  return value || null;
}

async function setUniverseModuleCursor(
  marketDb: SqliteDatabase,
  key: string,
  value: string | null
): Promise<void> {
  if (!value) {
    marketDb.run(`delete from market_meta where key = ?`, [key]);
    return;
  }
  marketDb.run(
    `
      insert into market_meta (key, value)
      values (?, ?)
      on conflict(key) do update set value = excluded.value
    `,
    [key, value]
  );
}

async function recordPipelineSkipped(input: {
  marketDb: SqliteDatabase;
  ingestRunId: string;
  scopeId: "targets" | "universe";
  domainId: string | null;
  moduleId: string;
  symbol: string;
}): Promise<void> {
  const stages = ["extract", "normalize", "upsert", "evaluate"] as const;
  for (const stage of stages) {
    await recordIngestStep({
      marketDb: input.marketDb,
      ingestRunId: input.ingestRunId,
      scopeId: input.scopeId,
      domainId: input.domainId,
      moduleId: input.moduleId,
      stage,
      status: "skipped",
      inputRows: 0,
      outputRows: 0,
      droppedRows: 0,
      errorMessage: "module skipped by execution plan.",
      key: input.symbol
    });
  }
}

async function recordIngestStep(input: {
  marketDb: SqliteDatabase;
  ingestRunId: string;
  scopeId: "targets" | "universe";
  domainId: string | null;
  moduleId: string;
  stage: "extract" | "normalize" | "upsert" | "evaluate";
  status: "running" | "success" | "failed" | "skipped";
  inputRows: number;
  outputRows: number;
  droppedRows: number;
  errorMessage: string | null;
  key?: string | null;
}): Promise<void> {
  const now = Date.now();
  const key = input.key?.trim() ?? "";
  const stepId = key
    ? `${input.moduleId}:${key}:${input.stage}`
    : `${input.moduleId}:${input.stage}`;
  try {
    await upsertIngestStepRun(input.marketDb, {
      ingestRunId: input.ingestRunId,
      stepId,
      scopeId: input.scopeId,
      domainId: input.domainId,
      moduleId: input.moduleId,
      stage: input.stage,
      status: input.status,
      inputRows: input.inputRows,
      outputRows: input.outputRows,
      droppedRows: input.droppedRows,
      errorMessage: input.errorMessage,
      startedAt: now,
      finishedAt: now
    });
  } catch (error) {
    console.warn("[mytrader] failed to record ingest step");
    console.warn(error);
  }
}

async function getLatestPriceDate(
  marketDb: SqliteDatabase,
  symbol: string
): Promise<string | null> {
  const rows = await marketDb.exec(
    `select trade_date from daily_prices where symbol = '${escapeSql(symbol)}' order by trade_date desc limit 1`
  );
  if (!rows.length) return null;
  const values = rows[0].values;
  if (!values.length) return null;
  return (values[0][0] as string) ?? null;
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

function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function resolveUniverseBatchSize(mode: IngestRunMode): number {
  const value = UNIVERSE_BATCH_SIZE_BY_MODE[mode];
  return Number.isFinite(value) && value > 0 ? value : 20;
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
