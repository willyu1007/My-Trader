import { all, exec } from "../storage/sqlite";
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
        auto_ingest integer not null default 1,
        created_at integer not null,
        updated_at integer not null
      );
    `
  );

  await exec(
    db,
    `
      create table if not exists instrument_data_sources (
        symbol text not null,
        domain text not null,
        source text not null,
        updated_at integer not null,
        primary key (symbol, domain)
      );
    `
  );

  await exec(
    db,
    `
      create table if not exists sw_industries (
        level text not null,
        code text not null,
        name text not null,
        parent_code text,
        updated_at integer not null,
        primary key (level, code)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists sw_industries_level_name
      on sw_industries (level, name);
    `
  );

  await exec(
    db,
    `
      create index if not exists sw_industries_parent_code
      on sw_industries (parent_code, level);
    `
  );

  await exec(
    db,
    `
      create index if not exists instrument_data_sources_domain_symbol
      on instrument_data_sources (domain, symbol);
    `
  );

  await exec(
    db,
    `
      create index if not exists instrument_data_sources_symbol_domain
      on instrument_data_sources (symbol, domain);
    `
  );

  await ensureColumn(
    db,
    "instruments",
    "auto_ingest",
    "integer not null default 1"
  );

  await exec(
    db,
    `
      create index if not exists instruments_auto_ingest
      on instruments (auto_ingest, symbol);
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

  await exec(
    db,
    `
      create table if not exists instrument_profiles (
        symbol text primary key not null,
        provider text not null,
        kind text not null,
        name text,
        asset_class text,
        market text,
        currency text,
        tags_json text not null,
        provider_data_json text not null,
        created_at integer not null,
        updated_at integer not null
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists instrument_profiles_name
      on instrument_profiles (name);
    `
  );

  await exec(
    db,
    `
      create table if not exists instrument_profile_tags (
        tag text not null,
        symbol text not null,
        primary key (tag, symbol)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists instrument_profile_tags_tag
      on instrument_profile_tags (tag, symbol);
    `
  );

  await exec(
    db,
    `
      create index if not exists instrument_profile_tags_symbol
      on instrument_profile_tags (symbol, tag);
    `
  );

  await exec(
    db,
    `
      create table if not exists daily_basics (
        symbol text not null,
        trade_date text not null,
        circ_mv real,
        total_mv real,
        source text not null,
        ingested_at integer not null,
        primary key (symbol, trade_date)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists daily_basics_symbol_date
      on daily_basics (symbol, trade_date);
    `
  );

  await exec(
    db,
    `
      create index if not exists daily_basics_date_symbol
      on daily_basics (trade_date, symbol);
    `
  );

  await exec(
    db,
    `
      create table if not exists daily_moneyflows (
        symbol text not null,
        trade_date text not null,
        net_mf_vol real,
        net_mf_amount real,
        source text not null,
        ingested_at integer not null,
        primary key (symbol, trade_date)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists daily_moneyflows_symbol_date
      on daily_moneyflows (symbol, trade_date);
    `
  );

  await exec(
    db,
    `
      create index if not exists daily_moneyflows_date_symbol
      on daily_moneyflows (trade_date, symbol);
    `
  );

  await exec(
    db,
    `
      create table if not exists trading_calendar (
        market text not null,
        date text not null,
        is_open integer not null,
        source text not null,
        ingested_at integer not null,
        primary key (market, date)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists trading_calendar_market_date
      on trading_calendar (market, date);
    `
  );

  await exec(
    db,
    `
      create table if not exists ingest_runs (
        id text primary key not null,
        scope text not null,
        mode text not null,
        status text not null,
        as_of_trade_date text,
        started_at integer not null,
        finished_at integer,
        symbol_count integer,
        inserted integer,
        updated integer,
        errors integer,
        error_message text,
        meta_json text
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists ingest_runs_started_at
      on ingest_runs (started_at desc);
    `
  );

  await exec(
    db,
    `
      create index if not exists ingest_runs_scope_status
      on ingest_runs (scope, status, started_at desc);
    `
  );

  await exec(
    db,
    `
      create table if not exists target_task_status (
        symbol text not null,
        module_id text not null,
        asset_class text,
        as_of_trade_date text,
        status text not null,
        coverage_ratio real,
        source_run_id text,
        last_error text,
        updated_at integer not null,
        primary key (symbol, module_id)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists target_task_status_symbol
      on target_task_status (symbol, updated_at desc);
    `
  );

  await exec(
    db,
    `
      create index if not exists target_task_status_module
      on target_task_status (module_id, status, updated_at desc);
    `
  );

  await exec(
    db,
    `
      create table if not exists target_materialization_runs (
        id text primary key not null,
        as_of_trade_date text,
        status text not null,
        symbol_count integer not null,
        complete_count integer not null,
        partial_count integer not null,
        missing_count integer not null,
        not_applicable_count integer not null,
        source_run_id text,
        error_message text,
        started_at integer not null,
        finished_at integer
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists target_materialization_runs_started_at
      on target_materialization_runs (started_at desc);
    `
  );
}

async function ensureColumn(
  db: SqliteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const columns = await all<{ name: string }>(
    db,
    `pragma table_info(${table});`
  );
  if (columns.some((entry) => entry.name === column)) return;
  await exec(db, `alter table ${table} add column ${column} ${definition};`);
}
