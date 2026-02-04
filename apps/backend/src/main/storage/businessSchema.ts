import { all, exec, get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";
import { backfillBaselineLedgerFromPositions } from "./ledgerBaseline";

const CURRENT_SCHEMA_VERSION = 5;

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
  let currentVersion = Number.isFinite(parsedVersion) ? parsedVersion : 0;

  if (!row) {
    await run(
      db,
      `insert into app_meta (key, value) values (?, ?)`,
      ["schema_version", "1"]
    );
  }

  if (currentVersion < 2) {
    currentVersion = 2;
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
      ["schema_version", String(currentVersion)]
    );
  }

  if (currentVersion < 3) {
    currentVersion = 3;
    await exec(
      db,
      `
        create table if not exists ledger_entries (
          id text primary key not null,
          portfolio_id text not null,
          account_key text,
          event_type text not null,
          trade_date text not null,
          event_ts integer,
          sequence integer,
          instrument_id text,
          symbol text,
          side text,
          quantity numeric,
          price numeric,
          price_currency text,
          cash_amount integer,
          cash_currency text,
          fee integer,
          tax integer,
          note text,
          source text not null,
          external_id text,
          meta_json text,
          created_at integer not null,
          updated_at integer not null,
          deleted_at integer,
          foreign key (portfolio_id) references portfolios(id) on delete cascade,
          check (side in ('buy', 'sell') or side is null),
          check (quantity is null or quantity >= 0),
          check (price is null or price >= 0),
          check (fee is null or fee >= 0),
          check (tax is null or tax >= 0),
          check (event_ts is null or event_ts > 0),
          check (sequence is null or sequence >= 0),
          check (cash_amount is null or cash_currency is not null)
        );
      `
    );

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_date
        on ledger_entries (portfolio_id, trade_date, created_at);
      `
    );

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_symbol_date
        on ledger_entries (portfolio_id, symbol, trade_date);
      `
    );

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_type_date
        on ledger_entries (portfolio_id, event_type, trade_date);
      `
    );

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_instrument_date
        on ledger_entries (portfolio_id, instrument_id, trade_date);
      `
    );

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_ts
        on ledger_entries (portfolio_id, event_ts);
      `
    );

    await exec(
      db,
      `
        create unique index if not exists ledger_entries_portfolio_source_external_id
        on ledger_entries (portfolio_id, source, external_id);
      `
    );

    await backfillBaselineLedgerFromPositions(db);
    await run(
      db,
      `insert or replace into app_meta (key, value) values (?, ?)`,
      ["ledger_baseline_backfill_v1", "1"]
    );

    await run(
      db,
      `insert or replace into app_meta (key, value) values (?, ?)`,
      ["schema_version", String(currentVersion)]
    );
  }

  if (currentVersion < 4) {
    currentVersion = 4;

    const ledgerColumns = await getTableColumns(db, "ledger_entries");
    if (!ledgerColumns.has("account_key")) {
      await exec(db, `alter table ledger_entries add column account_key text;`);
    }
    if (!ledgerColumns.has("event_ts")) {
      await exec(db, `alter table ledger_entries add column event_ts integer;`);
    }
    if (!ledgerColumns.has("sequence")) {
      await exec(db, `alter table ledger_entries add column sequence integer;`);
    }
    if (!ledgerColumns.has("instrument_id")) {
      await exec(db, `alter table ledger_entries add column instrument_id text;`);
    }
    if (!ledgerColumns.has("price_currency")) {
      await exec(db, `alter table ledger_entries add column price_currency text;`);
    }

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_instrument_date
        on ledger_entries (portfolio_id, instrument_id, trade_date);
      `
    );

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_ts
        on ledger_entries (portfolio_id, event_ts);
      `
    );

    await exec(
      db,
      `
        create table if not exists portfolio_instruments (
          id text primary key not null,
          portfolio_id text not null,
          symbol text not null,
          market text,
          name text,
          alias_json text,
          created_at integer not null,
          updated_at integer not null,
          foreign key (portfolio_id) references portfolios(id) on delete cascade
        );
      `
    );

    await exec(
      db,
      `
        create unique index if not exists portfolio_instruments_portfolio_symbol
        on portfolio_instruments (portfolio_id, symbol);
      `
    );

    await run(
      db,
      `insert or replace into app_meta (key, value) values (?, ?)`,
      ["schema_version", String(currentVersion)]
    );
  }

  if (currentVersion < 5) {
    currentVersion = 5;

    await exec(
      db,
      `
        create table if not exists watchlist_items (
          id text primary key not null,
          symbol text not null,
          name text,
          group_name text,
          note text,
          created_at integer not null,
          updated_at integer not null
        );
      `
    );
    await exec(
      db,
      `
        create unique index if not exists watchlist_items_symbol
        on watchlist_items (symbol);
      `
    );

    await exec(
      db,
      `
        create table if not exists instrument_tags (
          id text primary key not null,
          symbol text not null,
          tag text not null,
          created_at integer not null,
          updated_at integer not null
        );
      `
    );
    await exec(
      db,
      `
        create unique index if not exists instrument_tags_symbol_tag
        on instrument_tags (symbol, tag);
      `
    );
    await exec(
      db,
      `
        create index if not exists instrument_tags_tag
        on instrument_tags (tag, symbol);
      `
    );

    await exec(
      db,
      `
        create table if not exists market_settings (
          key text primary key not null,
          value_json text not null
        );
      `
    );

    await run(
      db,
      `insert or replace into app_meta (key, value) values (?, ?)`,
      ["schema_version", String(currentVersion)]
    );
  }

  if (currentVersion >= 3) {
    const baselineRow = await get<{ value: string }>(
      db,
      `select value from app_meta where key = ?`,
      ["ledger_baseline_backfill_v1"]
    );
    if (!baselineRow) {
      await backfillBaselineLedgerFromPositions(db);
      await run(
        db,
        `insert or replace into app_meta (key, value) values (?, ?)`,
        ["ledger_baseline_backfill_v1", "1"]
      );
    }
  }

  if (currentVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `[mytrader] business DB schema_version=${currentVersion} is newer than supported=${CURRENT_SCHEMA_VERSION}.`
    );
  }
}

async function getTableColumns(
  db: SqliteDatabase,
  tableName: string
): Promise<Set<string>> {
  const rows = await all<{ name: string }>(
    db,
    `pragma table_info(${tableName});`
  );
  return new Set(rows.map((row) => row.name));
}
