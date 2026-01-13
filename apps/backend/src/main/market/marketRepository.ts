import type { AssetClass, MarketDataSource } from "@mytrader/shared";

import { all, run, transaction } from "../storage/sqlite";
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
            name = excluded.name,
            asset_class = excluded.asset_class,
            market = excluded.market,
            currency = excluded.currency,
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

export async function upsertPrices(
  db: SqliteDatabase,
  inputs: PriceInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();
  await transaction(db, async () => {
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
