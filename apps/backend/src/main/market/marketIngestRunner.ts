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
        input.marketDb,
        token,
        items,
        asOfTradeDate,
        totals,
        input.control
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
        catalogInserted,
        catalogUpdated
      } =
        await syncUniverseInstrumentMeta(
        input.marketDb,
        handle,
        token,
        input.control
      );

      const windowStart = formatDate(addDays(parseDate(asOfTradeDate) ?? now, -365 * 3));
      const startDate = await getUniverseCursorDate(handle, windowStart);
      const tradeDates = await listOpenTradeDatesBetween(
        input.marketDb,
        "CN",
        startDate,
        asOfTradeDate
      );

      const totals: IngestTotals = { inserted: 0, updated: 0, errors: 0 };
      let lastDone: string | null = null;

      for (const tradeDate of tradeDates) {
        await checkpointOrThrow(input.control);
        await ingestUniverseTradeDate(
          handle,
          token,
          tradeDate,
          stockSymbols,
          etfSymbols,
          indexSymbols,
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
          stockSymbols.size +
          etfSymbols.size +
          indexSymbols.size +
          futuresSymbols.size +
          spotSymbols.size,
        inserted: totals.inserted,
        updated: totals.updated,
        errors: totals.errors,
        meta: {
          ...(input.meta ?? {}),
          windowYears: 3,
          instrumentCatalog: { inserted: catalogInserted, updated: catalogUpdated },
          lastTradeDate: lastDone,
          universeCounts: {
            stocks: stockSymbols.size,
            etfs: etfSymbols.size,
            indexes: indexSymbols.size,
            futures: futuresSymbols.size,
            spots: spotSymbols.size
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
  marketDb: SqliteDatabase,
  token: string,
  items: TushareIngestItem[],
  endDate: string,
  totals: IngestTotals,
  control?: IngestExecutionControl
): Promise<void> {
  if (items.length === 0) return;
  const provider = getMarketProvider("tushare");
  const end = endDate;

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
      await upsertPrices(marketDb, prices);
      totals.inserted += prices.length;

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
            source: "tushare"
          }))
        );

        const moneyflows = await provider.fetchDailyMoneyflows({
          token,
          symbol,
          startDate,
          endDate: end
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
      }
    } catch (err) {
      totals.errors += 1;
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
  control?: IngestExecutionControl
): Promise<{
  stockSymbols: Set<string>;
  etfSymbols: Set<string>;
  indexSymbols: Set<string>;
  futuresSymbols: Set<string>;
  spotSymbols: Set<string>;
  catalogInserted: number;
  catalogUpdated: number;
}> {
  const provider = getMarketProvider("tushare");
  const profiles = await provider.fetchInstrumentCatalog({ token });

  const stocks = profiles.filter((profile) => profile.assetClass === "stock");
  const etfs = profiles.filter((profile) => profile.assetClass === "etf");
  const indexes = profiles.filter((profile) => profile.kind === "index");
  const futures = profiles.filter((profile) => profile.kind === "futures");
  const spots = profiles.filter((profile) => profile.kind === "spot");

  const catalogResult = await upsertInstrumentProfiles(marketDb, profiles);

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

    for (const profile of profiles) {
      await checkpointOrThrow(control);
      const assetClassSql = profile.assetClass
        ? `'${escapeSql(profile.assetClass)}'`
        : "null";
      await conn.query(
        `
          insert into instrument_meta (symbol, kind, name, market, currency, asset_class, updated_at)
          values ('${escapeSql(profile.symbol)}', '${escapeSql(profile.kind)}', ${
          profile.name ? `'${escapeSql(profile.name)}'` : "null"
        }, '${escapeSql(profile.market ?? "CN")}', '${escapeSql(
          profile.currency ?? "CNY"
        )}', ${assetClassSql}, ${now})
          on conflict(symbol) do update set
            kind = excluded.kind,
            name = excluded.name,
            market = excluded.market,
            currency = excluded.currency,
            asset_class = excluded.asset_class,
            updated_at = excluded.updated_at
        `
      );
    }
    await conn.query("commit;");
  } finally {
    await conn.close();
  }

  return {
    stockSymbols: new Set(stocks.map((p) => p.symbol)),
    etfSymbols: new Set(etfs.map((p) => p.symbol)),
    indexSymbols: new Set(indexes.map((p) => p.symbol)),
    futuresSymbols: new Set(futures.map((p) => p.symbol)),
    spotSymbols: new Set(spots.map((p) => p.symbol)),
    catalogInserted: catalogResult.inserted,
    catalogUpdated: catalogResult.updated
  };
}

async function ingestUniverseTradeDate(
  analysisHandle: Awaited<ReturnType<typeof openAnalysisDuckdb>>,
  token: string,
  tradeDate: string,
  stockSymbols: Set<string>,
  etfSymbols: Set<string>,
  indexSymbols: Set<string>,
  futuresSymbols: Set<string>,
  spotSymbols: Set<string>,
  totals: IngestTotals
): Promise<void> {
  const tradeDateRaw = toTushareDate(tradeDate);

  const [daily, fundDaily, basics, moneyflow, indexDaily, futuresDaily, spotDaily] =
    await Promise.all([
    fetchTusharePaged(
      "daily",
      token,
      { trade_date: tradeDateRaw },
      "ts_code,trade_date,open,high,low,close,vol"
    ),
    fetchTusharePaged(
      "fund_daily",
      token,
      { trade_date: tradeDateRaw },
      "ts_code,trade_date,open,high,low,close,vol"
    ),
    fetchTusharePaged(
      "daily_basic",
      token,
      { trade_date: tradeDateRaw },
      "ts_code,trade_date,circ_mv,total_mv"
    ),
    fetchTusharePaged(
      "moneyflow",
      token,
      { trade_date: tradeDateRaw },
      "ts_code,trade_date,net_mf_vol,net_mf_amount"
    ),
    indexSymbols.size > 0
      ? fetchTusharePagedWithFallback(
          "index_daily",
          token,
          { trade_date: tradeDateRaw },
          "ts_code,trade_date,open,high,low,close,vol"
        )
      : { fields: [], items: [] },
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
      : { fields: [], items: [] }
  ]);

  const now = Date.now();

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
  const basicRows = mapDailyBasicRows(basics, stockSymbols, "tushare", now);
  const moneyRows = mapDailyMoneyflowRows(moneyflow, stockSymbols, "tushare", now);

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
      ...spotRows
    ]);
    await upsertDuckdbRows(conn, "daily_basics", [
      "symbol",
      "trade_date",
      "circ_mv",
      "total_mv",
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

    totals.inserted +=
      dailyRows.length +
      fundRows.length +
      indexRows.length +
      futuresRows.length +
      spotRows.length +
      basicRows.length +
      moneyRows.length;
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

async function upsertDuckdbRows(
  conn: AsyncDuckDBConnection,
  table: string,
  columns: string[],
  rows: any[][]
): Promise<void> {
  if (rows.length === 0) return;

  const chunkSize = 500;
  const cols = columns.map((c) => `"${c}"`).join(", ");
  const keyCols = columns.slice(0, 2).map((c) => `"${c}"`).join(", ");
  const updateCols = columns
    .slice(2)
    .map((c) => `"${c}" = excluded.\"${c}\"`)
    .join(", ");

  for (let idx = 0; idx < rows.length; idx += chunkSize) {
    const chunk = rows.slice(idx, idx + chunkSize);
    const valuesSql = chunk.map((row) => `(${row.map(formatDuckdbValue).join(", ")})`).join(", ");
    const sql = `
      insert into ${table} (${cols})
      values ${valuesSql}
      on conflict(${keyCols}) do update set ${updateCols}
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
