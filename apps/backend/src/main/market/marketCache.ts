import { all, exec, get, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

export async function ensureMarketCacheSchema(
  db: SqliteDatabase
): Promise<void> {
  await transaction(db, async () => {
    await ensureMarketCacheSchemaInTransaction(db);
  });
}

async function ensureMarketCacheSchemaInTransaction(
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

  await ensureTargetAssetClassBaselineConvergence(db);

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
        pe_ttm real,
        pb real,
        ps_ttm real,
        ev_ebitda_ttm real,
        ev_sales_ttm real,
        dv_ttm real,
        turnover_rate real,
        source text not null,
        ingested_at integer not null,
        primary key (symbol, trade_date)
      );
    `
  );

  await ensureColumn(db, "daily_basics", "pe_ttm", "real");
  await ensureColumn(db, "daily_basics", "pb", "real");
  await ensureColumn(db, "daily_basics", "ps_ttm", "real");
  await ensureColumn(db, "daily_basics", "ev_ebitda_ttm", "real");
  await ensureColumn(db, "daily_basics", "ev_sales_ttm", "real");
  await ensureColumn(db, "daily_basics", "dv_ttm", "real");
  await ensureColumn(db, "daily_basics", "turnover_rate", "real");

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
      create table if not exists fx_pair_meta (
        symbol text primary key not null,
        base_ccy text,
        quote_ccy text,
        quote_convention text,
        is_active integer not null,
        updated_at integer not null
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists fx_pair_meta_active
      on fx_pair_meta (is_active, symbol);
    `
  );

  await exec(
    db,
    `
      create table if not exists macro_series_meta (
        series_key text primary key not null,
        region text not null,
        topic text not null,
        source_api text not null,
        frequency text not null,
        unit text,
        is_active integer not null,
        updated_at integer not null
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists macro_series_meta_region_topic
      on macro_series_meta (region, topic, series_key);
    `
  );

  await exec(
    db,
    `
      create table if not exists macro_observations_latest (
        series_key text not null,
        available_date text not null,
        value real not null,
        period_end text not null,
        release_date text not null,
        frequency text not null,
        source text not null,
        updated_at integer not null,
        primary key (series_key, available_date)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists macro_observations_latest_series
      on macro_observations_latest (series_key, available_date desc);
    `
  );

  await exec(
    db,
    `
      create table if not exists macro_module_snapshot (
        as_of_trade_date text not null,
        module_id text not null,
        status text not null,
        coverage_ratio real not null,
        available_date text,
        payload_json text not null,
        source_run_id text,
        updated_at integer not null,
        primary key (as_of_trade_date, module_id)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists macro_module_snapshot_module_date
      on macro_module_snapshot (module_id, as_of_trade_date desc);
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

  await exec(
    db,
    `
      create table if not exists completeness_status_v2 (
        scope_id text not null,
        check_id text not null,
        entity_type text not null,
        entity_id text not null,
        bucket_id text not null,
        domain_id text,
        module_id text,
        asset_class text,
        as_of_trade_date text,
        status text not null,
        coverage_ratio real,
        source_run_id text,
        detail_json text,
        updated_at integer not null,
        primary key (scope_id, check_id, entity_type, entity_id)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists completeness_status_v2_scope_status
      on completeness_status_v2 (scope_id, status, updated_at desc);
    `
  );

  await exec(
    db,
    `
      create index if not exists completeness_status_v2_bucket
      on completeness_status_v2 (scope_id, bucket_id, updated_at desc);
    `
  );

  await exec(
    db,
    `
      create table if not exists completeness_runs_v2 (
        id text primary key not null,
        scope_id text not null,
        status text not null,
        as_of_trade_date text,
        entity_count integer not null,
        complete_count integer not null,
        partial_count integer not null,
        missing_count integer not null,
        not_applicable_count integer not null,
        not_started_count integer not null,
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
      create index if not exists completeness_runs_v2_started_at
      on completeness_runs_v2 (started_at desc);
    `
  );

  await exec(
    db,
    `
      create table if not exists ingest_step_runs_v1 (
        ingest_run_id text not null,
        step_id text not null,
        scope_id text not null,
        domain_id text,
        module_id text,
        stage text not null,
        status text not null,
        input_rows integer,
        output_rows integer,
        dropped_rows integer,
        error_message text,
        started_at integer not null,
        finished_at integer,
        primary key (ingest_run_id, step_id)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists ingest_step_runs_v1_scope_stage
      on ingest_step_runs_v1 (scope_id, stage, started_at desc);
    `
  );

  await ensureCompletenessV2Backfill(db);
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

async function ensureCompletenessV2Backfill(
  db: SqliteDatabase
): Promise<void> {
  const markerKey = "completeness_v2_backfill_v1";
  const marker = await get<{ value: string }>(
    db,
    `select value from market_meta where key = ?`,
    [markerKey]
  );
  if (marker?.value === "1") return;

  await exec(
    db,
    `
      insert or ignore into completeness_status_v2 (
        scope_id,
        check_id,
        entity_type,
        entity_id,
        bucket_id,
        domain_id,
        module_id,
        asset_class,
        as_of_trade_date,
        status,
        coverage_ratio,
        source_run_id,
        detail_json,
        updated_at
      )
      select
        'target_pool' as scope_id,
        'target.' || module_id as check_id,
        'instrument' as entity_type,
        symbol as entity_id,
        case
          when asset_class in ('stock', 'etf', 'futures', 'spot') then asset_class
          else 'global'
        end as bucket_id,
        case
          when asset_class in ('stock', 'etf', 'futures', 'spot') then asset_class
          else null
        end as domain_id,
        module_id,
        asset_class,
        as_of_trade_date,
        case
          when status in ('complete', 'partial', 'missing', 'not_applicable') then status
          else 'missing'
        end as status,
        coverage_ratio,
        source_run_id,
        null as detail_json,
        updated_at
      from target_task_status;
    `
  );

  await exec(
    db,
    `
      insert or ignore into completeness_runs_v2 (
        id,
        scope_id,
        status,
        as_of_trade_date,
        entity_count,
        complete_count,
        partial_count,
        missing_count,
        not_applicable_count,
        not_started_count,
        source_run_id,
        error_message,
        started_at,
        finished_at
      )
      select
        id,
        'target_pool' as scope_id,
        status,
        as_of_trade_date,
        symbol_count as entity_count,
        complete_count,
        partial_count,
        missing_count,
        not_applicable_count,
        0 as not_started_count,
        source_run_id,
        error_message,
        started_at,
        finished_at
      from target_materialization_runs;
    `
  );

  await run(
    db,
    `
      insert into market_meta (key, value)
      values (?, '1')
      on conflict(key) do update set
        value = excluded.value
    `,
    [markerKey]
  );
}

async function ensureTargetAssetClassBaselineConvergence(
  db: SqliteDatabase
): Promise<void> {
  const markerKey = "targets_asset_class_baseline_v1";
  const marker = await get<{ value: string }>(
    db,
    `select value from market_meta where key = ?`,
    [markerKey]
  );
  if (marker?.value === "1") return;

  await exec(
    db,
    `
      update instruments
      set asset_class = null
      where asset_class in ('futures', 'spot');
    `
  );

  await run(
    db,
    `
      insert into market_meta (key, value)
      values (?, '1')
      on conflict(key) do update set
        value = excluded.value
    `,
    [markerKey]
  );
}
