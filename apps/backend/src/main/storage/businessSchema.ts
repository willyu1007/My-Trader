import { exec, get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

const CURRENT_SCHEMA_VERSION = 2;

export async function ensureBusinessSchema(db: SqliteDatabase): Promise<void> {
  await exec(db, "pragma foreign_keys = on;");
  await exec(
    db,
    `
      create table if not exists app_meta (
        key text primary key not null,
        value text not null
      );
    `
  );

  const row = await get<{ value: string }>(
    db,
    `select value from app_meta where key = ?`,
    ["schema_version"]
  );
  const parsedVersion = row ? Number(row.value) : 0;
  const currentVersion = Number.isFinite(parsedVersion) ? parsedVersion : 0;

  if (!row) {
    await run(
      db,
      `insert into app_meta (key, value) values (?, ?)`,
      ["schema_version", "1"]
    );
  }

  if (currentVersion < 2) {
    await exec(
      db,
      `
        create table if not exists portfolios (
          id text primary key not null,
          name text not null,
          base_currency text not null,
          created_at integer not null,
          updated_at integer not null
        );
      `
    );

    await exec(
      db,
      `
        create table if not exists positions (
          id text primary key not null,
          portfolio_id text not null,
          symbol text not null,
          name text,
          asset_class text not null,
          market text not null,
          currency text not null,
          quantity real not null,
          cost real,
          open_date text,
          created_at integer not null,
          updated_at integer not null,
          foreign key (portfolio_id) references portfolios(id) on delete cascade
        );
      `
    );

    await exec(
      db,
      `
        create unique index if not exists positions_portfolio_symbol
        on positions (portfolio_id, symbol);
      `
    );

    await exec(
      db,
      `
        create table if not exists risk_limits (
          id text primary key not null,
          portfolio_id text not null,
          limit_type text not null,
          target text not null,
          threshold real not null,
          created_at integer not null,
          updated_at integer not null,
          foreign key (portfolio_id) references portfolios(id) on delete cascade
        );
      `
    );

    await exec(
      db,
      `
        create index if not exists risk_limits_portfolio
        on risk_limits (portfolio_id);
      `
    );

    await run(
      db,
      `insert or replace into app_meta (key, value) values (?, ?)`,
      ["schema_version", String(CURRENT_SCHEMA_VERSION)]
    );
  }
}
