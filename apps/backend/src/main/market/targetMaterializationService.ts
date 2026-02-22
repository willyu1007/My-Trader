import type {
  AssetClass,
  TargetTaskModuleId,
  TargetTaskStatus
} from "@mytrader/shared";

import {
  openAnalysisDuckdb,
  ensureAnalysisDuckdbSchema,
  type AnalysisDuckdbConnection
} from "../storage/analysisDuckdb";
import { get } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";
import { getMarketTargetTaskMatrixConfig } from "../storage/marketSettingsRepository";
import { upsertDailyBasics } from "./dailyBasicRepository";
import { upsertDailyMoneyflows } from "./dailyMoneyflowRepository";
import { upsertPrices, upsertInstruments } from "./marketRepository";
import {
  createTargetMaterializationRun,
  finishTargetMaterializationRun,
  upsertTargetTaskStatuses
} from "./targetTaskRepository";
import {
  buildCoverageRatio,
  resolveTargetModuleStatus
} from "./targetTaskMatrixService";
import { resolveAutoIngestItems } from "./targetsService";

export interface MaterializeTargetsFromSsotInput {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  analysisDbPath: string;
  asOfTradeDate: string;
  sourceRunId?: string | null;
  symbols?: string[] | null;
}

export interface MaterializeTargetsFromSsotResult {
  runId: string;
  symbolCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  notApplicableCount: number;
  insertedRows: number;
  updatedRows: number;
  missingSymbols: string[];
}

type DailyPriceRow = {
  symbol: string;
  trade_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  source: string;
};

type DailyBasicRow = {
  symbol: string;
  trade_date: string;
  circ_mv: number | null;
  total_mv: number | null;
};

type DailyMoneyflowRow = {
  symbol: string;
  trade_date: string;
  net_mf_vol: number | null;
  net_mf_amount: number | null;
};

type InstrumentMetaRow = {
  symbol: string;
  name: string | null;
  asset_class: string | null;
  market: string | null;
  currency: string | null;
};

type FuturesExtRow = {
  symbol: string;
  trade_date: string;
  settle: number | null;
  oi: number | null;
};

type SpotExtRow = {
  symbol: string;
  trade_date: string;
  price_avg: number | null;
  settle_vol: number | null;
};

export async function materializeTargetsFromSsot(
  input: MaterializeTargetsFromSsotInput
): Promise<MaterializeTargetsFromSsotResult> {
  const matrixConfig = await getMarketTargetTaskMatrixConfig(input.businessDb);
  const materializationRunId = await createTargetMaterializationRun(input.marketDb);
  const sourceRunId = input.sourceRunId ?? materializationRunId;

  const targetItems = await resolveAutoIngestItems({
    businessDb: input.businessDb,
    marketDb: input.marketDb
  });
  const filter = new Set(
    (input.symbols ?? [])
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const items =
    filter.size > 0
      ? targetItems.filter((item) => filter.has(item.symbol))
      : targetItems;

  const handle = await openAnalysisDuckdb(input.analysisDbPath);
  const priceInserts: Array<{
    symbol: string;
    tradeDate: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    source: "tushare";
  }> = [];
  const basicInserts: Array<{
    symbol: string;
    tradeDate: string;
    circMv: number | null;
    totalMv: number | null;
    source: "tushare";
  }> = [];
  const moneyflowInserts: Array<{
    symbol: string;
    tradeDate: string;
    netMfVol: number | null;
    netMfAmount: number | null;
    source: "tushare";
  }> = [];
  const instrumentInserts: Array<{
    symbol: string;
    name?: string | null;
    assetClass?: AssetClass | null;
    market?: string | null;
    currency?: string | null;
  }> = [];

  let completeCount = 0;
  let partialCount = 0;
  let missingCount = 0;
  let notApplicableCount = 0;
  let insertedRows = 0;
  let updatedRows = 0;
  const missingSymbols = new Set<string>();
  try {
    await ensureAnalysisDuckdbSchema(handle);
    const conn = await handle.connect();
    try {
      const supportsFuturesExt = await hasDuckdbTable(conn, "futures_daily_ext");
      const supportsSpotExt = await hasDuckdbTable(conn, "spot_sge_daily_ext");
      const statusRows: Array<{
        symbol: string;
        moduleId: TargetTaskModuleId;
        assetClass: AssetClass | null;
        asOfTradeDate: string | null;
        status: TargetTaskStatus;
        coverageRatio: number | null;
        sourceRunId: string | null;
        lastError: string | null;
      }> = [];

      for (const item of items) {
        const symbol = item.symbol.trim();
        if (!symbol) continue;
        const instrument = await queryOne<InstrumentMetaRow>(
          conn,
          `
            select symbol, name, asset_class, market, currency
            from instrument_meta
            where symbol = '${escapeSql(symbol)}'
            limit 1
          `
        );
        const assetClass = normalizeAssetClass(
          instrument?.asset_class ?? item.assetClass
        );
        const price = await queryOne<DailyPriceRow>(
          conn,
          `
            select symbol, trade_date, open, high, low, close, volume, source
            from daily_prices
            where symbol = '${escapeSql(symbol)}'
              and trade_date = '${escapeSql(input.asOfTradeDate)}'
            limit 1
          `
        );
        const basics = await queryOne<DailyBasicRow>(
          conn,
          `
            select symbol, trade_date, circ_mv, total_mv
            from daily_basics
            where symbol = '${escapeSql(symbol)}'
              and trade_date = '${escapeSql(input.asOfTradeDate)}'
            limit 1
          `
        );
        const moneyflow = await queryOne<DailyMoneyflowRow>(
          conn,
          `
            select symbol, trade_date, net_mf_vol, net_mf_amount
            from daily_moneyflows
            where symbol = '${escapeSql(symbol)}'
              and trade_date = '${escapeSql(input.asOfTradeDate)}'
            limit 1
          `
        );
        const futuresExt = supportsFuturesExt
          ? await queryOne<FuturesExtRow>(
              conn,
              `
                select symbol, trade_date, settle, oi
                from futures_daily_ext
                where symbol = '${escapeSql(symbol)}'
                  and trade_date = '${escapeSql(input.asOfTradeDate)}'
                limit 1
              `
            )
          : null;
        const spotExt = supportsSpotExt
          ? await queryOne<SpotExtRow>(
              conn,
              `
                select symbol, trade_date, price_avg, settle_vol
                from spot_sge_daily_ext
                where symbol = '${escapeSql(symbol)}'
                  and trade_date = '${escapeSql(input.asOfTradeDate)}'
                limit 1
              `
            )
          : null;

        if (instrument) {
          instrumentInserts.push({
            symbol,
            name: instrument.name,
            assetClass,
            market: instrument.market,
            currency: instrument.currency
          });
        }
        if (price) {
          priceInserts.push({
            symbol,
            tradeDate: price.trade_date,
            open: price.open,
            high: price.high,
            low: price.low,
            close: price.close,
            volume: price.volume,
            source: "tushare"
          });
        }
        if (basics && assetClass === "stock") {
          basicInserts.push({
            symbol,
            tradeDate: basics.trade_date,
            circMv: basics.circ_mv,
            totalMv: basics.total_mv,
            source: "tushare"
          });
        }
        if (moneyflow && assetClass === "stock") {
          moneyflowInserts.push({
            symbol,
            tradeDate: moneyflow.trade_date,
            netMfVol: moneyflow.net_mf_vol,
            netMfAmount: moneyflow.net_mf_amount,
            source: "tushare"
          });
        }

        const presence: Partial<Record<TargetTaskModuleId, boolean>> = {
          "core.daily_prices": Boolean(price),
          "core.instrument_meta": Boolean(instrument),
          "core.daily_basics": Boolean(basics),
          "core.daily_moneyflows": Boolean(moneyflow),
          "core.futures_settle": Boolean(futuresExt?.settle),
          "core.futures_oi": Boolean(futuresExt?.oi),
          "core.spot_price_avg": Boolean(spotExt?.price_avg),
          "core.spot_settle": Boolean(spotExt?.settle_vol),
          "task.exposure": Boolean(basics || futuresExt?.settle || spotExt?.price_avg),
          "task.momentum": Boolean(price),
          "task.liquidity": Boolean(price?.volume)
        };

        const enabledModules = matrixConfig.enabledModules;
        const symbolStatuses = enabledModules.map((moduleId) =>
          resolveTargetModuleStatus({
            moduleId,
            assetClass,
            presence
          })
        );
        const coverageRatio = buildCoverageRatio(symbolStatuses);
        enabledModules.forEach((moduleId, idx) => {
          const status = symbolStatuses[idx];
          if (status === "complete") completeCount += 1;
          if (status === "partial") partialCount += 1;
          if (status === "missing") {
            missingCount += 1;
            missingSymbols.add(symbol);
          }
          if (status === "not_applicable") notApplicableCount += 1;
          statusRows.push({
            symbol,
            moduleId,
            assetClass,
            asOfTradeDate: input.asOfTradeDate,
            status,
            coverageRatio,
            sourceRunId,
            lastError: status === "missing" ? "SSOT 数据缺失，需先回补 Universe。" : null
          });
        });
      }

      const uniqueInstrumentInserts = dedupeByKey(instrumentInserts, (row) => row.symbol);
      const uniquePriceInserts = dedupeByKey(
        priceInserts,
        (row) => `${row.symbol}#${row.tradeDate}`
      );
      const uniqueBasicInserts = dedupeByKey(
        basicInserts,
        (row) => `${row.symbol}#${row.tradeDate}`
      );
      const uniqueMoneyflowInserts = dedupeByKey(
        moneyflowInserts,
        (row) => `${row.symbol}#${row.tradeDate}`
      );
      const uniqueStatusRows = dedupeByKey(
        statusRows,
        (row) => `${row.symbol}#${row.moduleId}`
      );

      const [
        existingInstruments,
        existingPrices,
        existingBasics,
        existingMoneyflows,
        existingStatuses
      ] = await Promise.all([
        countExistingSingleKeys(
          input.marketDb,
          "instruments",
          "symbol",
          uniqueInstrumentInserts.map((row) => row.symbol)
        ),
        countExistingCompositeKeys(
          input.marketDb,
          "daily_prices",
          "symbol",
          "trade_date",
          uniquePriceInserts.map((row) => [row.symbol, row.tradeDate])
        ),
        countExistingCompositeKeys(
          input.marketDb,
          "daily_basics",
          "symbol",
          "trade_date",
          uniqueBasicInserts.map((row) => [row.symbol, row.tradeDate])
        ),
        countExistingCompositeKeys(
          input.marketDb,
          "daily_moneyflows",
          "symbol",
          "trade_date",
          uniqueMoneyflowInserts.map((row) => [row.symbol, row.tradeDate])
        ),
        countExistingCompositeKeys(
          input.marketDb,
          "target_task_status",
          "symbol",
          "module_id",
          uniqueStatusRows.map((row) => [row.symbol, row.moduleId])
        )
      ]);

      await upsertInstruments(input.marketDb, uniqueInstrumentInserts);
      await upsertPrices(input.marketDb, uniquePriceInserts);
      await upsertDailyBasics(input.marketDb, uniqueBasicInserts);
      await upsertDailyMoneyflows(input.marketDb, uniqueMoneyflowInserts);
      await upsertTargetTaskStatuses(input.marketDb, uniqueStatusRows);

      const totalRows =
        uniqueInstrumentInserts.length +
        uniquePriceInserts.length +
        uniqueBasicInserts.length +
        uniqueMoneyflowInserts.length +
        uniqueStatusRows.length;
      const existingRows =
        existingInstruments +
        existingPrices +
        existingBasics +
        existingMoneyflows +
        existingStatuses;
      insertedRows = Math.max(0, totalRows - existingRows);
      updatedRows = Math.max(0, existingRows);
    } finally {
      await conn.close();
    }
    await finishTargetMaterializationRun(input.marketDb, {
      id: materializationRunId,
      status: missingCount > 0 ? "partial" : "success",
      asOfTradeDate: input.asOfTradeDate,
      symbolCount: items.length,
      completeCount,
      partialCount,
      missingCount,
      notApplicableCount,
      sourceRunId
    });
    return {
      runId: materializationRunId,
      symbolCount: items.length,
      completeCount,
      partialCount,
      missingCount,
      notApplicableCount,
      insertedRows,
      updatedRows,
      missingSymbols: Array.from(missingSymbols.values())
    };
  } catch (error) {
    await finishTargetMaterializationRun(input.marketDb, {
      id: materializationRunId,
      status: "failed",
      asOfTradeDate: input.asOfTradeDate,
      symbolCount: items.length,
      completeCount,
      partialCount,
      missingCount,
      notApplicableCount,
      sourceRunId,
      errorMessage: toErrorMessage(error)
    });
    throw error;
  } finally {
    await handle.close();
  }
}

async function queryOne<T>(
  conn: AnalysisDuckdbConnection,
  sql: string
): Promise<T | null> {
  const result = await conn.query(sql);
  const rows = result.toArray() as T[];
  return rows.length > 0 ? rows[0] : null;
}

function normalizeAssetClass(value: unknown): AssetClass | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (
    raw === "stock" ||
    raw === "etf" ||
    raw === "futures" ||
    raw === "spot" ||
    raw === "cash"
  ) {
    return raw;
  }
  return null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

async function hasDuckdbTable(
  conn: AnalysisDuckdbConnection,
  tableName: string
): Promise<boolean> {
  const row = await queryOne<{ present: number }>(
    conn,
    `
      select 1 as present
      from information_schema.tables
      where table_schema = 'main'
        and table_name = '${escapeSql(tableName)}'
      limit 1
    `
  );
  return Boolean(row?.present);
}

function dedupeByKey<T>(rows: T[], keyFn: (row: T) => string): T[] {
  if (rows.length <= 1) return rows;
  const map = new Map<string, T>();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    map.set(key, row);
  });
  return Array.from(map.values());
}

async function countExistingSingleKeys(
  db: SqliteDatabase,
  table: string,
  column: string,
  keys: string[]
): Promise<number> {
  const normalized = Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)));
  if (normalized.length === 0) return 0;

  let total = 0;
  for (const chunk of chunkArray(normalized, 300)) {
    const placeholders = chunk.map(() => "(?)").join(", ");
    const row = await get<{ total: number }>(
      db,
      `
        with keyset(${column}) as (values ${placeholders})
        select count(*) as total
        from ${table} t
        inner join keyset k
          on t.${column} = k.${column}
      `,
      chunk
    );
    total += Number(row?.total ?? 0);
  }
  return total;
}

async function countExistingCompositeKeys(
  db: SqliteDatabase,
  table: string,
  columnA: string,
  columnB: string,
  keys: Array<[string, string]>
): Promise<number> {
  const normalized = dedupeByKey(
    keys
      .map(([a, b]) => [a.trim(), b.trim()] as [string, string])
      .filter(([a, b]) => Boolean(a) && Boolean(b)),
    ([a, b]) => `${a}\u0000${b}`
  );
  if (normalized.length === 0) return 0;

  let total = 0;
  for (const chunk of chunkArray(normalized, 250)) {
    const placeholders = chunk.map(() => "(?, ?)").join(", ");
    const params = chunk.flatMap(([a, b]) => [a, b]);
    const row = await get<{ total: number }>(
      db,
      `
        with keyset(${columnA}, ${columnB}) as (values ${placeholders})
        select count(*) as total
        from ${table} t
        inner join keyset k
          on t.${columnA} = k.${columnA}
         and t.${columnB} = k.${columnB}
      `,
      params
    );
    total += Number(row?.total ?? 0);
  }
  return total;
}

function chunkArray<T>(rows: T[], chunkSize: number): T[][] {
  if (rows.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}
