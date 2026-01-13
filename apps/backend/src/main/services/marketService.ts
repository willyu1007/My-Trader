import type {
  ImportHoldingsCsvInput,
  ImportPricesCsvInput,
  MarketImportResult,
  TushareIngestInput
} from "@mytrader/shared";

import { parseHoldingsCsv, parsePricesCsv } from "../market/csvImport";
import { upsertInstruments, upsertPrices } from "../market/marketRepository";
import { fetchTushareDailyPrices } from "../market/tushareClient";
import { upsertPositions } from "../storage/positionRepository";
import type { SqliteDatabase } from "../storage/sqlite";

export async function importHoldingsCsv(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: ImportHoldingsCsvInput
): Promise<MarketImportResult> {
  const parsed = parseHoldingsCsv(input.filePath);

  await upsertInstruments(
    marketDb,
    parsed.rows.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      assetClass: row.assetClass,
      market: row.market,
      currency: row.currency
    }))
  );

  const result = await upsertPositions(
    businessDb,
    input.portfolioId,
    parsed.rows.map((row) => ({
      portfolioId: input.portfolioId,
      symbol: row.symbol,
      name: row.name,
      assetClass: row.assetClass,
      market: row.market,
      currency: row.currency,
      quantity: row.quantity,
      cost: row.cost,
      openDate: row.openDate
    }))
  );

  return {
    inserted: result.inserted,
    updated: result.updated,
    skipped: parsed.skipped,
    warnings: parsed.warnings
  };
}

export async function importPricesCsv(
  marketDb: SqliteDatabase,
  input: ImportPricesCsvInput
): Promise<MarketImportResult> {
  const parsed = parsePricesCsv(input.filePath, input.source);
  await upsertPrices(marketDb, parsed.rows);

  return {
    inserted: parsed.rows.length,
    updated: 0,
    skipped: parsed.skipped,
    warnings: parsed.warnings
  };
}

export async function ingestTushare(
  marketDb: SqliteDatabase,
  input: TushareIngestInput
): Promise<MarketImportResult> {
  const token = process.env.MYTRADER_TUSHARE_TOKEN;
  if (!token) {
    throw new Error("未设置 MYTRADER_TUSHARE_TOKEN 环境变量。");
  }

  const prices = await fetchTushareDailyPrices(
    token,
    input.items,
    input.startDate,
    input.endDate ?? null
  );

  await upsertPrices(marketDb, prices);

  return {
    inserted: prices.length,
    updated: 0,
    skipped: 0,
    warnings: []
  };
}
