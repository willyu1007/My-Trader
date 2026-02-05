import type {
  AssetClass,
  MarketDataSource,
  TushareIngestItem
} from "@mytrader/shared";

import { all, run, transaction } from "../storage/sqlite";
import { ensureInstrumentDomainSources } from "./instrumentDataSourceRepository";
import type { SqliteDatabase } from "../storage/sqlite";

export interface InstrumentInput {
  symbol: string;
  name?: string | null;
  assetClass?: AssetClass | null;
  market?: string | null;
  currency?: string | null;
}

export interface PriceInput {
  symbol: string;
  tradeDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  source: MarketDataSource;
}

export interface LatestPrice {
  symbol: string;
  tradeDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  source: MarketDataSource;
  ingestedAt: number;
}

export interface InstrumentRegistryEntry {
  symbol: string;
  name: string | null;
  assetClass: AssetClass | null;
  market: string | null;
  currency: string | null;
  autoIngest: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InstrumentMetadata {
  symbol: string;
  name: string | null;
  assetClass: AssetClass | null;
  market: string | null;
  currency: string | null;
}

export async function upsertInstruments(
  db: SqliteDatabase,
  inputs: InstrumentInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();

  await transaction(db, async () => {
    for (const input of inputs) {
      await run(
        db,
        `
          insert into instruments (
            symbol, name, asset_class, market, currency, created_at, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?)
          on conflict(symbol) do update set
            name = coalesce(excluded.name, instruments.name),
            asset_class = coalesce(excluded.asset_class, instruments.asset_class),
            market = coalesce(excluded.market, instruments.market),
            currency = coalesce(excluded.currency, instruments.currency),
            updated_at = excluded.updated_at
        `,
        [
          input.symbol,
          input.name ?? null,
          input.assetClass ?? null,
          input.market ?? null,
          input.currency ?? null,
          now,
          now
        ]
      );
    }
  });
}

export async function listInstrumentRegistry(
  db: SqliteDatabase
): Promise<InstrumentRegistryEntry[]> {
  const rows = await all<{
    symbol: string;
    name: string | null;
    asset_class: string | null;
    market: string | null;
    currency: string | null;
    auto_ingest: number;
    created_at: number;
    updated_at: number;
  }>(
    db,
    `
      select symbol, name, asset_class, market, currency, auto_ingest,
             created_at, updated_at
      from instruments
      order by symbol asc
    `
  );

  return rows.map((row) => ({
    symbol: row.symbol,
    name: row.name ?? null,
    assetClass: row.asset_class ? (row.asset_class as AssetClass) : null,
    market: row.market ?? null,
    currency: row.currency ?? null,
    autoIngest: row.auto_ingest === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function getInstrumentsBySymbols(
  db: SqliteDatabase,
  symbols: string[]
): Promise<Map<string, InstrumentMetadata>> {
  if (symbols.length === 0) return new Map();
  const placeholders = symbols.map(() => "?").join(", ");
  const rows = await all<{
    symbol: string;
    name: string | null;
    asset_class: string | null;
    market: string | null;
    currency: string | null;
  }>(
    db,
    `
      select symbol, name, asset_class, market, currency
      from instruments
      where symbol in (${placeholders})
      order by symbol asc
    `,
    symbols
  );

  const result = new Map<string, InstrumentMetadata>();
  rows.forEach((row) => {
    result.set(row.symbol, {
      symbol: row.symbol,
      name: row.name ?? null,
      assetClass: row.asset_class ? (row.asset_class as AssetClass) : null,
      market: row.market ?? null,
      currency: row.currency ?? null
    });
  });
  return result;
}

export async function listAutoIngestItems(
  db: SqliteDatabase
): Promise<TushareIngestItem[]> {
  const rows = await all<{ symbol: string; asset_class: string }>(
    db,
    `
      select symbol, asset_class
      from instruments
      where auto_ingest = 1
        and asset_class is not null
        and asset_class != 'cash'
      order by symbol asc
    `
  );

  return rows.map((row) => ({
    symbol: row.symbol,
    assetClass: row.asset_class as AssetClass
  }));
}

export async function setInstrumentAutoIngest(
  db: SqliteDatabase,
  symbol: string,
  enabled: boolean
): Promise<void> {
  const now = Date.now();
  const autoIngest = enabled ? 1 : 0;

  const existing = await all<{ symbol: string }>(
    db,
    `select symbol from instruments where symbol = ?`,
    [symbol]
  );

  if (existing.length === 0) {
    await run(
      db,
      `
        insert into instruments (
          symbol, name, asset_class, market, currency, auto_ingest, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [symbol, null, null, null, null, autoIngest, now, now]
    );
    return;
  }

  await run(
    db,
    `
      update instruments
      set auto_ingest = ?, updated_at = ?
      where symbol = ?
    `,
    [autoIngest, now, symbol]
  );
}

export async function upsertPrices(
  db: SqliteDatabase,
  inputs: PriceInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();
  const sources = inputs.map((input) => ({
    symbol: input.symbol,
    source: input.source
  }));
  await transaction(db, async () => {
    await ensureInstrumentDomainSources(db, "daily_prices", sources, now);
    for (const input of inputs) {
      await run(
        db,
        `
          insert into daily_prices (
            symbol, trade_date, open, high, low, close, volume, source, ingested_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(symbol, trade_date) do update set
            open = excluded.open,
            high = excluded.high,
            low = excluded.low,
            close = excluded.close,
            volume = excluded.volume,
            source = excluded.source,
            ingested_at = excluded.ingested_at
        `,
        [
          input.symbol,
          input.tradeDate,
          input.open,
          input.high,
          input.low,
          input.close,
          input.volume,
          input.source,
          now
        ]
      );
    }
  });
}

export async function getLatestPrices(
  db: SqliteDatabase,
  symbols: string[]
): Promise<Map<string, LatestPrice>> {
  if (symbols.length === 0) return new Map();
  const placeholders = symbols.map(() => "?").join(", ");
  const rows = await all<{
    symbol: string;
    trade_date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    source: MarketDataSource;
    ingested_at: number;
  }>(
    db,
    `
      select symbol, trade_date, open, high, low, close, volume, source, ingested_at
      from daily_prices
      where symbol in (${placeholders})
      order by symbol asc, trade_date desc
    `,
    symbols
  );

  const latest = new Map<string, LatestPrice>();
  for (const row of rows) {
    if (latest.has(row.symbol)) continue;
    latest.set(row.symbol, {
      symbol: row.symbol,
      tradeDate: row.trade_date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      source: row.source,
      ingestedAt: row.ingested_at
    });
  }

  return latest;
}

export async function listPriceDatesInRange(
  db: SqliteDatabase,
  symbols: string[],
  startDate: string,
  endDate: string
): Promise<string[]> {
  if (symbols.length === 0) return [];
  const placeholders = symbols.map(() => "?").join(", ");
  const rows = await all<{ trade_date: string }>(
    db,
    `
      select distinct trade_date
      from daily_prices
      where symbol in (${placeholders})
        and trade_date >= ?
        and trade_date <= ?
      order by trade_date asc
    `,
    [...symbols, startDate, endDate]
  );

  return rows.map((row) => row.trade_date);
}

export async function getLatestPricesAsOf(
  db: SqliteDatabase,
  symbols: string[],
  asOfDate: string
): Promise<Map<string, LatestPrice>> {
  if (symbols.length === 0) return new Map();
  const placeholders = symbols.map(() => "?").join(", ");
  const rows = await all<{
    symbol: string;
    trade_date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    source: MarketDataSource;
    ingested_at: number;
  }>(
    db,
    `
      select symbol, trade_date, open, high, low, close, volume, source, ingested_at
      from daily_prices
      where symbol in (${placeholders})
        and trade_date <= ?
      order by symbol asc, trade_date desc
    `,
    [...symbols, asOfDate]
  );

  const latest = new Map<string, LatestPrice>();
  for (const row of rows) {
    if (latest.has(row.symbol)) continue;
    latest.set(row.symbol, {
      symbol: row.symbol,
      tradeDate: row.trade_date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      source: row.source,
      ingestedAt: row.ingested_at
    });
  }

  return latest;
}
