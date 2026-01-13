import { exec } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

export async function ensureMarketCacheSchema(
  db: SqliteDatabase
): Promise<void> {
  await exec(
    db,
    `
      create table if not exists market_meta (
        key text primary key not null,
        value text not null
      );
    `
  );

  await exec(
    db,
    `
      create table if not exists instruments (
        symbol text primary key not null,
        name text,
        asset_class text,
        market text,
        currency text,
        created_at integer not null,
        updated_at integer not null
      );
    `
  );

  await exec(
    db,
    `
      create table if not exists daily_prices (
        symbol text not null,
        trade_date text not null,
        open real,
        high real,
        low real,
        close real,
        volume real,
        source text not null,
        ingested_at integer not null,
        primary key (symbol, trade_date)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists daily_prices_symbol_date
      on daily_prices (symbol, trade_date);
    `
  );
}
