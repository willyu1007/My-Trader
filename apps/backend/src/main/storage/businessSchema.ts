import { all, exec, execVolatile, get, run, transaction } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";
import { backfillBaselineLedgerFromPositions } from "./ledgerBaseline";

const CURRENT_SCHEMA_VERSION = 13;

export async function ensureBusinessSchema(db: SqliteDatabase): Promise<void> {
  await execVolatile(db, "pragma foreign_keys = on;");

  await transaction(db, async () => {
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

    if (currentVersion < 6) {
      currentVersion = 6;

      await exec(
        db,
        `
          create table if not exists insights (
            id text primary key not null,
            title text not null,
            thesis text not null,
            status text not null,
            valid_from text,
            valid_to text,
            tags_json text not null,
            meta_json text not null,
            created_at integer not null,
            updated_at integer not null,
            deleted_at integer
          );
        `
      );
      await exec(
        db,
        `
          create index if not exists insights_status_updated
          on insights (status, updated_at desc);
        `
      );
      await exec(
        db,
        `
          create index if not exists insights_valid_window
          on insights (valid_from, valid_to);
        `
      );

      await exec(
        db,
        `
          create table if not exists insight_scope_rules (
            id text primary key not null,
            insight_id text not null,
            scope_type text not null,
            scope_key text not null,
            mode text not null,
            enabled integer not null default 1,
            created_at integer not null,
            updated_at integer not null,
            foreign key (insight_id) references insights(id) on delete cascade
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists insight_scope_rules_unique
          on insight_scope_rules (insight_id, scope_type, scope_key, mode);
        `
      );
      await exec(
        db,
        `
          create index if not exists insight_scope_rules_insight
          on insight_scope_rules (insight_id, enabled);
        `
      );

      await exec(
        db,
        `
          create table if not exists insight_target_exclusions (
            id text primary key not null,
            insight_id text not null,
            symbol text not null,
            reason text,
            created_at integer not null,
            updated_at integer not null,
            foreign key (insight_id) references insights(id) on delete cascade
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists insight_target_exclusions_unique
          on insight_target_exclusions (insight_id, symbol);
        `
      );

      await exec(
        db,
        `
          create table if not exists insight_effect_channels (
            id text primary key not null,
            insight_id text not null,
            method_key text not null,
            metric_key text not null,
            stage text not null,
            operator text not null,
            priority integer not null default 100,
            enabled integer not null default 1,
            meta_json text not null,
            created_at integer not null,
            updated_at integer not null,
            foreign key (insight_id) references insights(id) on delete cascade
          );
        `
      );
      await exec(
        db,
        `
          create index if not exists insight_effect_channels_insight
          on insight_effect_channels (insight_id, stage, priority, created_at);
        `
      );

      await exec(
        db,
        `
          create table if not exists insight_effect_points (
            id text primary key not null,
            channel_id text not null,
            effect_date text not null,
            effect_value real not null,
            created_at integer not null,
            updated_at integer not null,
            foreign key (channel_id) references insight_effect_channels(id) on delete cascade
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists insight_effect_points_unique
          on insight_effect_points (channel_id, effect_date);
        `
      );
      await exec(
        db,
        `
          create index if not exists insight_effect_points_channel_date
          on insight_effect_points (channel_id, effect_date);
        `
      );

      await exec(
        db,
        `
          create table if not exists insight_materialized_targets (
            id text primary key not null,
            insight_id text not null,
            symbol text not null,
            source_scope_type text not null,
            source_scope_key text not null,
            materialized_at integer not null,
            foreign key (insight_id) references insights(id) on delete cascade
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists insight_materialized_targets_unique
          on insight_materialized_targets (insight_id, symbol, source_scope_type, source_scope_key);
        `
      );
      await exec(
        db,
        `
          create index if not exists insight_materialized_targets_lookup
          on insight_materialized_targets (symbol, insight_id);
        `
      );

      await exec(
        db,
        `
          create virtual table if not exists insight_fts using fts5(
            insight_id unindexed,
            title,
            thesis,
            tags
          );
        `
      );
      await exec(db, `delete from insight_fts;`);
      await exec(
        db,
        `
          insert into insight_fts (insight_id, title, thesis, tags)
          select id, title, thesis, coalesce(tags_json, '')
          from insights
          where deleted_at is null;
        `
      );
      await exec(
        db,
        `
          create trigger if not exists insights_ai
          after insert on insights
          begin
            insert into insight_fts (insight_id, title, thesis, tags)
            select new.id, new.title, new.thesis, coalesce(new.tags_json, '')
            where new.deleted_at is null;
          end;
        `
      );
      await exec(
        db,
        `
          create trigger if not exists insights_au
          after update on insights
          begin
            delete from insight_fts where insight_id = old.id;
            insert into insight_fts (insight_id, title, thesis, tags)
            select new.id, new.title, new.thesis, coalesce(new.tags_json, '')
            where new.deleted_at is null;
          end;
        `
      );
      await exec(
        db,
        `
          create trigger if not exists insights_ad
          after delete on insights
          begin
            delete from insight_fts where insight_id = old.id;
          end;
        `
      );

      await exec(
        db,
        `
          create table if not exists valuation_methods (
            id text primary key not null,
            method_key text not null,
            name text not null,
            description text,
            is_builtin integer not null,
            status text not null,
            asset_scope_json text not null,
            active_version_id text,
            created_at integer not null,
            updated_at integer not null,
            deleted_at integer
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists valuation_methods_method_key
          on valuation_methods (method_key);
        `
      );
      await exec(
        db,
        `
          create index if not exists valuation_methods_builtin_status
          on valuation_methods (is_builtin, status);
        `
      );

      await exec(
        db,
        `
          create table if not exists valuation_method_versions (
            id text primary key not null,
            method_id text not null,
            version integer not null,
            effective_from text,
            effective_to text,
            graph_json text not null,
            param_schema_json text not null,
            metric_schema_json text not null,
            formula_manifest_json text not null,
            input_schema_json text not null default '[]',
            created_at integer not null,
            updated_at integer not null,
            foreign key (method_id) references valuation_methods(id) on delete cascade
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists valuation_method_versions_unique
          on valuation_method_versions (method_id, version);
        `
      );
      await exec(
        db,
        `
          create index if not exists valuation_method_versions_effective
          on valuation_method_versions (method_id, effective_from, effective_to, version desc);
        `
      );

      await exec(
        db,
        `
          create table if not exists valuation_adjustment_snapshots (
            id text primary key not null,
            symbol text not null,
            as_of_date text not null,
            method_key text not null,
            base_metrics_json text not null,
            adjusted_metrics_json text not null,
            applied_effects_json text not null,
            confidence text,
            degradation_reasons_json text not null default '[]',
            input_breakdown_json text not null default '[]',
            created_at integer not null,
            updated_at integer not null
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists valuation_adjustment_snapshots_unique
          on valuation_adjustment_snapshots (symbol, as_of_date, method_key);
        `
      );

      await seedBuiltinValuationMethods(db);

      await run(
        db,
        `insert or replace into app_meta (key, value) values (?, ?)`,
        ["schema_version", String(currentVersion)]
      );
    }

    if (currentVersion < 7) {
      currentVersion = 7;
      const now = Date.now();

      await exec(
        db,
        `
          create table if not exists manual_tags (
            tag text primary key not null,
            name text not null,
            description text,
            color text not null,
            is_reserved integer not null default 0,
            created_at integer not null,
            updated_at integer not null
          );
        `
      );
      await exec(
        db,
        `
          create index if not exists manual_tags_reserved_name
          on manual_tags (is_reserved desc, name asc);
        `
      );

      await run(
        db,
        `
          insert into manual_tags (
            tag, name, description, color, is_reserved, created_at, updated_at
          )
          values
            ('user:自选', '自选', '系统保留标签，用于核心自选观察。', '#64748B', 1, ?, ?),
            ('user:重点关注', '重点关注', '系统保留标签，用于重点跟踪标的。', '#0EA5E9', 1, ?, ?)
          on conflict(tag) do update set
            name = excluded.name,
            description = excluded.description,
            color = excluded.color,
            is_reserved = 1,
            updated_at = excluded.updated_at
        `,
        [now, now, now, now]
      );

      await run(
        db,
        `insert or replace into app_meta (key, value) values (?, ?)`,
        ["schema_version", String(currentVersion)]
      );
    }

    if (currentVersion < 8) {
      currentVersion = 8;

      await exec(
        db,
        `
          create table if not exists insight_facts (
            id text primary key not null,
            content text not null,
            created_at integer not null,
            updated_at integer not null
          );
        `
      );
      await exec(
        db,
        `
          create index if not exists insight_facts_created_at
          on insight_facts (created_at desc, id asc);
        `
      );

      await run(
        db,
        `insert or replace into app_meta (key, value) values (?, ?)`,
        ["schema_version", String(currentVersion)]
      );
    }

    if (currentVersion < 9) {
      currentVersion = 9;

      await exec(
        db,
        `
          create table if not exists valuation_objective_metric_snapshots (
            id text primary key not null,
            symbol text not null,
            method_key text not null,
            metric_key text not null,
            as_of_date text not null,
            value real,
            quality text not null,
            source text,
            created_at integer not null,
            updated_at integer not null
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists valuation_objective_metric_unique
          on valuation_objective_metric_snapshots (symbol, method_key, metric_key, as_of_date);
        `
      );
      await exec(
        db,
        `
          create index if not exists valuation_objective_metric_updated
          on valuation_objective_metric_snapshots (updated_at desc);
        `
      );

      await exec(
        db,
        `
          create table if not exists valuation_subjective_defaults (
            id text primary key not null,
            method_key text not null,
            input_key text not null,
            market text,
            industry_tag text,
            value real not null,
            source text,
            created_at integer not null,
            updated_at integer not null
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists valuation_subjective_defaults_unique
          on valuation_subjective_defaults (
            method_key,
            input_key,
            ifnull(market, ''),
            ifnull(industry_tag, '')
          );
        `
      );

      await exec(
        db,
        `
          create table if not exists valuation_subjective_symbol_overrides (
            id text primary key not null,
            symbol text not null,
            method_key text not null,
            input_key text not null,
            value real not null,
            note text,
            created_at integer not null,
            updated_at integer not null
          );
        `
      );
      await exec(
        db,
        `
          create unique index if not exists valuation_subjective_overrides_unique
          on valuation_subjective_symbol_overrides (symbol, method_key, input_key);
        `
      );

      await exec(
        db,
        `
          create table if not exists valuation_refresh_runs (
            id text primary key not null,
            status text not null,
            reason text,
            total_symbols integer not null,
            refreshed integer not null,
            failed integer not null,
            message text,
            started_at integer not null,
            finished_at integer,
            created_at integer not null,
            updated_at integer not null
          );
        `
      );
      await exec(
        db,
        `
          create index if not exists valuation_refresh_runs_started_at
          on valuation_refresh_runs (started_at desc);
        `
      );

      const versionColumns = await getTableColumns(db, "valuation_method_versions");
      if (!versionColumns.has("input_schema_json")) {
        await exec(
          db,
          `
            alter table valuation_method_versions
            add column input_schema_json text not null default '[]';
          `
        );
      }

      const snapshotColumns = await getTableColumns(
        db,
        "valuation_adjustment_snapshots"
      );
      if (!snapshotColumns.has("confidence")) {
        await exec(
          db,
          `
            alter table valuation_adjustment_snapshots
            add column confidence text;
          `
        );
      }
      if (!snapshotColumns.has("degradation_reasons_json")) {
        await exec(
          db,
          `
            alter table valuation_adjustment_snapshots
            add column degradation_reasons_json text not null default '[]';
          `
        );
      }
      if (!snapshotColumns.has("input_breakdown_json")) {
        await exec(
          db,
          `
            alter table valuation_adjustment_snapshots
            add column input_breakdown_json text not null default '[]';
          `
        );
      }

      await run(
        db,
        `
          update valuation_method_versions
          set input_schema_json = '[]'
          where input_schema_json is null or trim(input_schema_json) = '';
        `
      );
      await run(
        db,
        `
          update valuation_adjustment_snapshots
          set degradation_reasons_json = '[]'
          where degradation_reasons_json is null or trim(degradation_reasons_json) = '';
        `
      );
      await run(
        db,
        `
          update valuation_adjustment_snapshots
          set input_breakdown_json = '[]'
          where input_breakdown_json is null or trim(input_breakdown_json) = '';
        `
      );

      await seedBuiltinValuationMethods(db);

      await run(
        db,
        `insert or replace into app_meta (key, value) values (?, ?)`,
        ["schema_version", String(currentVersion)]
      );
    }

    if (currentVersion < 10) {
      currentVersion = 10;
      await seedBuiltinValuationMethods(db);
      await run(
        db,
        `insert or replace into app_meta (key, value) values (?, ?)`,
        ["schema_version", String(currentVersion)]
      );
    }

    if (currentVersion < 11) {
      currentVersion = 11;
      await seedBuiltinValuationMethods(db);
      await run(
        db,
        `insert or replace into app_meta (key, value) values (?, ?)`,
        ["schema_version", String(currentVersion)]
      );
    }

    if (currentVersion < 12) {
      currentVersion = 12;
      await seedBuiltinValuationMethods(db);
      await run(
        db,
        `insert or replace into app_meta (key, value) values (?, ?)`,
        ["schema_version", String(currentVersion)]
      );
    }

    if (currentVersion < 13) {
      currentVersion = 13;
      await seedBuiltinValuationMethods(db);
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
  });
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

interface BuiltinValuationMethodSeed {
  id: string;
  methodKey: string;
  name: string;
  description: string;
  assetScope: {
    kinds: string[];
    assetClasses: string[];
    markets: string[];
    domains: string[];
  };
  formulaId: string;
  metricSchema: Record<string, unknown>;
  paramSchema: Record<string, unknown>;
  inputSchema?: Array<Record<string, unknown>>;
}

const BUILTIN_VALUATION_METHOD_SEEDS: BuiltinValuationMethodSeed[] = [
  {
    id: "builtin.stock.pe.relative",
    methodKey: "builtin.stock.pe.relative.v1",
    name: "股票 PE 相对估值",
    description: "基于个股 PE 与行业中位数偏离估算公允价值。",
    assetScope: {
      kinds: ["stock", "fund"],
      assetClasses: ["stock", "etf"],
      markets: ["CN", "HK", "US"],
      domains: ["stock", "etf", "hk_stock", "us_stock"]
    },
    formulaId: "stock_pe_relative_v1",
    metricSchema: {
      required: ["market.price", "valuation.pe_ttm"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      targetPe: 18
    }
  },
  {
    id: "builtin.stock.pb.relative",
    methodKey: "builtin.stock.pb.relative.v1",
    name: "股票 PB 相对估值",
    description: "基于 PB 与行业中位数偏离估算公允价值。",
    assetScope: {
      kinds: ["stock", "fund"],
      assetClasses: ["stock", "etf"],
      markets: ["CN", "HK", "US"],
      domains: ["stock", "etf", "hk_stock", "us_stock"]
    },
    formulaId: "stock_pb_relative_v1",
    metricSchema: {
      required: ["market.price", "valuation.pb"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      targetPb: 2.5
    }
  },
  {
    id: "builtin.stock.ps.relative",
    methodKey: "builtin.stock.ps.relative.v1",
    name: "股票 PS 相对估值",
    description: "基于 PS 与行业中位数偏离估算公允价值。",
    assetScope: {
      kinds: ["stock", "fund"],
      assetClasses: ["stock", "etf"],
      markets: ["CN", "HK", "US"],
      domains: ["stock", "etf", "hk_stock", "us_stock"]
    },
    formulaId: "stock_ps_relative_v1",
    metricSchema: {
      required: ["market.price", "valuation.ps_ttm"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      targetPs: 3
    }
  },
  {
    id: "builtin.stock.peg.relative",
    methodKey: "builtin.stock.peg.relative.v1",
    name: "股票 PEG 估值",
    description: "基于 PE 与成长假设计算 PEG 目标估值。",
    assetScope: {
      kinds: ["stock"],
      assetClasses: ["stock"],
      markets: ["CN", "HK", "US"],
      domains: ["stock", "hk_stock", "us_stock"]
    },
    formulaId: "stock_peg_relative_v1",
    metricSchema: {
      required: ["market.price", "valuation.pe_ttm"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      growthRate: 0.12,
      targetPeg: 1
    }
  },
  {
    id: "builtin.stock.ev_ebitda.relative",
    methodKey: "builtin.stock.ev_ebitda.relative.v1",
    name: "股票 EV/EBITDA 估值",
    description: "基于 EV/EBITDA 偏离估值。",
    assetScope: {
      kinds: ["stock"],
      assetClasses: ["stock"],
      markets: ["CN", "HK", "US"],
      domains: ["stock", "hk_stock", "us_stock"]
    },
    formulaId: "stock_ev_ebitda_relative_v1",
    metricSchema: {
      required: ["market.price", "valuation.ev_ebitda_ttm"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      targetEvEbitda: 12
    }
  },
  {
    id: "builtin.stock.ev_sales.relative",
    methodKey: "builtin.stock.ev_sales.relative.v1",
    name: "股票 EV/Sales 估值",
    description: "基于 EV/Sales 偏离估值。",
    assetScope: {
      kinds: ["stock"],
      assetClasses: ["stock"],
      markets: ["CN", "HK", "US"],
      domains: ["stock", "hk_stock", "us_stock"]
    },
    formulaId: "stock_ev_sales_relative_v1",
    metricSchema: {
      required: ["market.price", "valuation.ps_ttm"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      targetEvSales: 4
    }
  },
  {
    id: "builtin.stock.ddm.gordon",
    methodKey: "builtin.stock.ddm.gordon.v1",
    name: "股票 DDM Gordon 估值",
    description: "股利折现（Gordon）估值。",
    assetScope: {
      kinds: ["stock"],
      assetClasses: ["stock"],
      markets: ["CN", "HK", "US"],
      domains: ["stock", "hk_stock", "us_stock"]
    },
    formulaId: "stock_ddm_gordon_v1",
    metricSchema: {
      required: ["market.price"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      dividendYield: 0.03,
      growthRate: 0.05,
      discountRate: 0.1
    }
  },
  {
    id: "builtin.stock.fcff.twostage",
    methodKey: "builtin.stock.fcff.twostage.v1",
    name: "股票 FCFF 两阶段估值",
    description: "自由现金流两阶段折现估值。",
    assetScope: {
      kinds: ["stock"],
      assetClasses: ["stock"],
      markets: ["CN", "HK", "US"],
      domains: ["stock", "hk_stock", "us_stock"]
    },
    formulaId: "stock_fcff_twostage_v1",
    metricSchema: {
      required: ["market.price"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      fcffYield: 0.05,
      highGrowthYears: 5,
      highGrowthRate: 0.1,
      terminalGrowthRate: 0.03,
      wacc: 0.1
    }
  },
  {
    id: "builtin.etf.pe.relative",
    methodKey: "builtin.etf.pe.relative.v1",
    name: "ETF PE 相对估值",
    description: "基于 ETF 口径（或持仓穿透）PE 估算公允价值。",
    assetScope: {
      kinds: ["fund"],
      assetClasses: ["etf"],
      markets: ["CN", "HK", "US"],
      domains: ["etf"]
    },
    formulaId: "stock_pe_relative_v1",
    metricSchema: {
      required: ["market.price", "valuation.pe_ttm"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      targetPe: 18
    }
  },
  {
    id: "builtin.etf.pb.relative",
    methodKey: "builtin.etf.pb.relative.v1",
    name: "ETF PB 相对估值",
    description: "基于 ETF 口径（或持仓穿透）PB 估算公允价值。",
    assetScope: {
      kinds: ["fund"],
      assetClasses: ["etf"],
      markets: ["CN", "HK", "US"],
      domains: ["etf"]
    },
    formulaId: "stock_pb_relative_v1",
    metricSchema: {
      required: ["market.price", "valuation.pb"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      targetPb: 2.5
    }
  },
  {
    id: "builtin.etf.ps.relative",
    methodKey: "builtin.etf.ps.relative.v1",
    name: "ETF PS 相对估值",
    description: "基于 ETF 口径（或持仓穿透）PS 估算公允价值。",
    assetScope: {
      kinds: ["fund"],
      assetClasses: ["etf"],
      markets: ["CN", "HK", "US"],
      domains: ["etf"]
    },
    formulaId: "stock_ps_relative_v1",
    metricSchema: {
      required: ["market.price", "valuation.ps_ttm"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      targetPs: 3
    }
  },
  {
    id: "builtin.equity.factor",
    methodKey: "builtin.equity.factor",
    name: "股票/ETF 多因子估值",
    description: "覆盖估值、盈利预期、动量、波动率与风险参数。",
    assetScope: {
      kinds: ["stock", "fund", "index"],
      assetClasses: ["stock", "etf"],
      markets: ["CN", "HK", "US"],
      domains: ["stock", "etf", "index", "hk_stock", "us_stock"]
    },
    formulaId: "equity_factor_v1",
    metricSchema: {
      required: ["market.price", "factor.momentum.20d", "risk.volatility.20d"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      alphaWeight: 0.45,
      momentumWeight: 0.35,
      volatilityPenalty: 0.2
    }
  },
  {
    id: "builtin.futures.basis",
    methodKey: "builtin.futures.basis",
    name: "期货基差估值",
    description: "适用于期货标的，关注基差、持仓与波动。",
    assetScope: {
      kinds: ["futures"],
      assetClasses: ["futures"],
      markets: ["CN"],
      domains: ["futures"]
    },
    formulaId: "futures_basis_v1",
    metricSchema: {
      required: ["market.price", "factor.basis", "risk.volatility.20d"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      basisWeight: 0.7,
      volPenalty: 0.3
    }
  },
  {
    id: "builtin.futures.trend.vol",
    methodKey: "builtin.futures.trend.vol.v1",
    name: "期货趋势-波动估值",
    description: "基于动量趋势与波动率惩罚估算期货公允值。",
    assetScope: {
      kinds: ["futures"],
      assetClasses: ["futures"],
      markets: ["CN", "US"],
      domains: ["futures"]
    },
    formulaId: "futures_trend_vol_v1",
    metricSchema: {
      required: ["market.price", "factor.momentum.20d", "risk.volatility.20d"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      momentumWeight: 0.65,
      volatilityPenalty: 0.3
    }
  },
  {
    id: "builtin.futures.term.structure",
    methodKey: "builtin.futures.term.structure.v1",
    name: "期货期限结构估值",
    description: "基于预期基差与展期收益修正现价。",
    assetScope: {
      kinds: ["futures"],
      assetClasses: ["futures"],
      markets: ["CN", "US"],
      domains: ["futures"]
    },
    formulaId: "futures_term_structure_v1",
    metricSchema: {
      required: ["market.price"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      expectedBasisPct: 0.01,
      rollYieldPct: 0.005
    }
  },
  {
    id: "builtin.volatility.discount",
    methodKey: "builtin.volatility.discount.v1",
    name: "波动率折价估值",
    description: "以实现波动率作为风险折价项，修正当前价格。",
    assetScope: {
      kinds: ["stock", "fund", "index", "futures", "spot", "forex"],
      assetClasses: ["stock", "etf", "futures", "spot"],
      markets: ["CN", "HK", "US", "FX"],
      domains: ["volatility"]
    },
    formulaId: "volatility_discount_v1",
    metricSchema: {
      required: ["market.price", "risk.volatility.20d"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      volatilityDiscountWeight: 0.6
    }
  },
  {
    id: "builtin.volatility.risk.premium",
    methodKey: "builtin.volatility.risk.premium.v1",
    name: "波动率风险溢价估值",
    description: "基于隐含与实现波动率差值，映射风险溢价到估值修正。",
    assetScope: {
      kinds: ["stock", "fund", "index", "futures", "spot", "forex"],
      assetClasses: ["stock", "etf", "futures", "spot"],
      markets: ["CN", "HK", "US", "FX"],
      domains: ["volatility"]
    },
    formulaId: "volatility_risk_premium_v1",
    metricSchema: {
      required: ["market.price", "risk.volatility.20d"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      impliedVolatility: 0.28,
      vrpBeta: 0.8
    }
  },
  {
    id: "builtin.volatility.percentile.band",
    methodKey: "builtin.volatility.percentile.band.v1",
    name: "波动率分位区间估值",
    description: "基于波动率分位偏离锚点生成风险调整估值。",
    assetScope: {
      kinds: ["stock", "fund", "index", "futures", "spot", "forex"],
      assetClasses: ["stock", "etf", "futures", "spot"],
      markets: ["CN", "HK", "US", "FX"],
      domains: ["volatility"]
    },
    formulaId: "volatility_percentile_band_v1",
    metricSchema: {
      required: ["market.price", "risk.volatility.20d"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      volatilityPercentile: 0.5,
      percentileAnchor: 0.5,
      percentileSensitivity: 0.4
    }
  },
  {
    id: "builtin.spot.carry",
    methodKey: "builtin.spot.carry",
    name: "现货 Carry 估值",
    description: "适用于现货（含贵金属）标的，关注 carry 与风险补偿。",
    assetScope: {
      kinds: ["spot"],
      assetClasses: ["spot"],
      markets: ["CN"],
      domains: ["spot"]
    },
    formulaId: "spot_carry_v1",
    metricSchema: {
      required: ["market.price", "factor.carry.annualized"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      carryWeight: 1.0
    }
  },
  {
    id: "builtin.spot.mean.reversion",
    methodKey: "builtin.spot.mean.reversion.v1",
    name: "现货均值回归估值",
    description: "基于短期动量偏离做均值回归修正。",
    assetScope: {
      kinds: ["spot"],
      assetClasses: ["spot"],
      markets: ["CN"],
      domains: ["spot"]
    },
    formulaId: "spot_mean_reversion_v1",
    metricSchema: {
      required: ["market.price", "factor.momentum.20d"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      reversionStrength: 0.35
    }
  },
  {
    id: "builtin.spot.inventory.risk",
    methodKey: "builtin.spot.inventory.risk.v1",
    name: "现货库存风险估值",
    description: "库存溢价与波动风险联合修正现货估值。",
    assetScope: {
      kinds: ["spot"],
      assetClasses: ["spot"],
      markets: ["CN"],
      domains: ["spot"]
    },
    formulaId: "spot_inventory_risk_v1",
    metricSchema: {
      required: ["market.price", "risk.volatility.20d"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      inventoryPremium: 0.04,
      volatilityPenalty: 0.35
    }
  },
  {
    id: "builtin.forex.ppp",
    methodKey: "builtin.forex.ppp",
    name: "外汇 PPP 估值",
    description: "适用于外汇标的，关注 PPP 偏离与动量。",
    assetScope: {
      kinds: ["forex"],
      assetClasses: [],
      markets: ["FX"],
      domains: ["fx"]
    },
    formulaId: "forex_ppp_v1",
    metricSchema: {
      required: ["market.price", "factor.ppp_gap"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      pppWeight: 0.8,
      momentumWeight: 0.2
    }
  },
  {
    id: "builtin.forex.rate.differential",
    methodKey: "builtin.forex.rate.differential.v1",
    name: "外汇利差估值",
    description: "基于利差与持有期估计汇率公允值。",
    assetScope: {
      kinds: ["forex"],
      assetClasses: [],
      markets: ["FX"],
      domains: ["fx"]
    },
    formulaId: "forex_rate_differential_v1",
    metricSchema: {
      required: ["market.price"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      carryDifferential: 0.01,
      horizonYears: 1
    }
  },
  {
    id: "builtin.forex.reer.reversion",
    methodKey: "builtin.forex.reer.reversion.v1",
    name: "外汇 REER 回归估值",
    description: "基于 REER 偏离与短期动量做回归估值。",
    assetScope: {
      kinds: ["forex"],
      assetClasses: [],
      markets: ["FX"],
      domains: ["fx"]
    },
    formulaId: "forex_reer_reversion_v1",
    metricSchema: {
      required: ["market.price", "factor.momentum.20d"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      reerGap: 0.03,
      reversionSpeed: 0.45
    }
  },
  {
    id: "builtin.bond.yield",
    methodKey: "builtin.bond.yield",
    name: "债券收益率曲线估值",
    description: "债券/利率资产模板方法（未接入域可返回 not_applicable）。",
    assetScope: {
      kinds: ["bond", "rate"],
      assetClasses: [],
      markets: ["CN"],
      domains: ["bond", "macro"]
    },
    formulaId: "bond_yield_v1",
    metricSchema: {
      required: ["market.price", "risk.duration", "risk.yield_shift"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      durationWeight: 1.0
    }
  },
  {
    id: "builtin.bond.spread.duration",
    methodKey: "builtin.bond.spread.duration.v1",
    name: "债券利差-久期估值",
    description: "基于信用利差变化、久期与凸性修正债券价格。",
    assetScope: {
      kinds: ["bond", "rate"],
      assetClasses: [],
      markets: ["CN", "US"],
      domains: ["bond", "macro"]
    },
    formulaId: "bond_spread_duration_v1",
    metricSchema: {
      required: ["market.price"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      duration: 6,
      spreadChange: 0.002,
      convexity: 0.5
    }
  },
  {
    id: "builtin.bond.real.rate",
    methodKey: "builtin.bond.real.rate.v1",
    name: "债券实际利率估值",
    description: "基于实际利率偏离与敏感度估值债券/利率资产。",
    assetScope: {
      kinds: ["bond", "rate"],
      assetClasses: [],
      markets: ["CN", "US"],
      domains: ["bond", "macro"]
    },
    formulaId: "bond_real_rate_v1",
    metricSchema: {
      required: ["market.price"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      realRateGap: -0.005,
      sensitivity: 4
    }
  },
  {
    id: "builtin.generic.factor",
    methodKey: "builtin.generic.factor",
    name: "通用多因子估值模板",
    description: "开放集合兜底方法，保障协议稳定。",
    assetScope: {
      kinds: [],
      assetClasses: [],
      markets: [],
      domains: ["stock", "etf", "index", "futures", "spot", "fx", "bond", "macro"]
    },
    formulaId: "generic_factor_v1",
    metricSchema: {
      required: ["market.price"],
      outputs: ["output.fair_value", "output.return_gap"]
    },
    paramSchema: {
      momentumWeight: 0.5,
      volatilityPenalty: 0.15
    }
  }
];

async function seedBuiltinValuationMethods(db: SqliteDatabase): Promise<void> {
  const now = Date.now();
  for (const seed of BUILTIN_VALUATION_METHOD_SEEDS) {
    const graph = buildDefaultMetricGraph(seed.formulaId);
    const inputSchema = seed.inputSchema ?? buildDefaultInputSchema(seed.formulaId);
    const versionId = `${seed.id}.v1`;
    await run(
      db,
      `
        insert into valuation_methods (
          id, method_key, name, description, is_builtin, status,
          asset_scope_json, active_version_id, created_at, updated_at, deleted_at
        )
        values (?, ?, ?, ?, 1, 'active', ?, ?, ?, ?, null)
        on conflict(method_key) do update set
          name = excluded.name,
          description = excluded.description,
          is_builtin = 1,
          status = excluded.status,
          asset_scope_json = excluded.asset_scope_json,
          updated_at = excluded.updated_at
      `,
      [
        seed.id,
        seed.methodKey,
        seed.name,
        seed.description,
        JSON.stringify(seed.assetScope),
        versionId,
        now,
        now
      ]
    );

    await run(
      db,
      `
        insert into valuation_method_versions (
          id, method_id, version, effective_from, effective_to,
          graph_json, param_schema_json, metric_schema_json, formula_manifest_json, input_schema_json,
          created_at, updated_at
        )
        values (?, ?, 1, null, null, ?, ?, ?, ?, ?, ?, ?)
        on conflict(method_id, version) do update set
          graph_json = excluded.graph_json,
          param_schema_json = excluded.param_schema_json,
          metric_schema_json = excluded.metric_schema_json,
          formula_manifest_json = excluded.formula_manifest_json,
          input_schema_json = excluded.input_schema_json,
          updated_at = excluded.updated_at
      `,
      [
        versionId,
        seed.id,
        JSON.stringify(graph),
        JSON.stringify(seed.paramSchema),
        JSON.stringify(seed.metricSchema),
        JSON.stringify({ formulaId: seed.formulaId, locked: true }),
        JSON.stringify(inputSchema),
        now,
        now
      ]
    );

    await run(
      db,
      `
        update valuation_methods
        set active_version_id = ?, updated_at = ?
        where method_key = ?
      `,
      [versionId, now, seed.methodKey]
    );
  }
}

function buildDefaultMetricGraph(formulaId: string): Array<Record<string, unknown>> {
  return [
    {
      key: "market.price",
      label: "市场价格",
      layer: "top",
      unit: "currency",
      dependsOn: [],
      formulaId,
      editable: false
    },
    {
      key: "factor.momentum.20d",
      label: "20日动量",
      layer: "first_order",
      unit: "pct",
      dependsOn: ["market.price"],
      formulaId,
      editable: true
    },
    {
      key: "risk.volatility.20d",
      label: "20日波动率",
      layer: "first_order",
      unit: "pct",
      dependsOn: ["market.price"],
      formulaId,
      editable: true
    },
    {
      key: "risk.beta",
      label: "Beta",
      layer: "second_order",
      unit: "number",
      dependsOn: ["factor.momentum.20d", "risk.volatility.20d"],
      formulaId,
      editable: true
    },
    {
      key: "output.fair_value",
      label: "估计公允值",
      layer: "output",
      unit: "currency",
      dependsOn: ["factor.momentum.20d", "risk.volatility.20d", "risk.beta"],
      formulaId,
      editable: false
    },
    {
      key: "output.return_gap",
      label: "收益偏离",
      layer: "output",
      unit: "pct",
      dependsOn: ["output.fair_value", "market.price"],
      formulaId,
      editable: false
    }
  ];
}

function buildDefaultInputSchema(
  formulaId: string
): Array<Record<string, unknown>> {
  const common: Array<Record<string, unknown>> = [
    {
      key: "market.price",
      label: "市场价格",
      kind: "objective",
      unit: "currency",
      editable: false,
      objectiveSource: "market.daily_prices.close",
      defaultPolicy: "none",
      defaultValue: null,
      displayOrder: 1,
      description: "标的最新收盘价。"
    },
    {
      key: "output.fair_value",
      label: "公允价值",
      kind: "derived",
      unit: "currency",
      editable: false,
      objectiveSource: null,
      defaultPolicy: "none",
      defaultValue: null,
      displayOrder: 999,
      description: "模型输出。"
    },
    {
      key: "output.return_gap",
      label: "收益偏离",
      kind: "derived",
      unit: "pct",
      editable: false,
      objectiveSource: null,
      defaultPolicy: "none",
      defaultValue: null,
      displayOrder: 1000,
      description: "模型输出。"
    }
  ];

  const objectivePe = {
    key: "valuation.pe_ttm",
    label: "PE(TTM)",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.daily_basics.pe_ttm",
    defaultPolicy: "none",
    defaultValue: null,
    description: "来自基础面表。"
  };
  const objectivePb = {
    key: "valuation.pb",
    label: "PB",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.daily_basics.pb",
    defaultPolicy: "none",
    defaultValue: null,
    description: "来自基础面表。"
  };
  const objectivePs = {
    key: "valuation.ps_ttm",
    label: "PS(TTM)",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.daily_basics.ps_ttm",
    defaultPolicy: "none",
    defaultValue: null,
    description: "来自基础面表。"
  };
  const objectiveEvEbitda = {
    key: "valuation.ev_ebitda_ttm",
    label: "EV/EBITDA(TTM)",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.daily_basics.ev_ebitda_ttm",
    defaultPolicy: "none",
    defaultValue: null,
    description: "来自基础面表。"
  };
  const objectiveDv = {
    key: "valuation.dv_ttm",
    label: "股息率(TTM)",
    kind: "objective",
    unit: "pct",
    editable: false,
    objectiveSource: "market.daily_basics.dv_ttm",
    defaultPolicy: "none",
    defaultValue: null,
    description: "来自基础面表。"
  };
  const objectiveMomentum = {
    key: "factor.momentum.20d",
    label: "20日动量",
    kind: "objective",
    unit: "pct",
    editable: false,
    objectiveSource: "market.daily_prices.derived.momentum_20d",
    defaultPolicy: "none",
    defaultValue: null,
    description: "由日线价格序列计算。"
  };
  const objectiveVolatility = {
    key: "risk.volatility.20d",
    label: "20日波动率",
    kind: "objective",
    unit: "pct",
    editable: false,
    objectiveSource: "market.daily_prices.derived.volatility_20d",
    defaultPolicy: "none",
    defaultValue: null,
    description: "由日线价格序列计算。"
  };
  const objectiveBasis = {
    key: "factor.basis",
    label: "基差",
    kind: "objective",
    unit: "number",
    editable: false,
    objectiveSource: "market.derived.basis",
    defaultPolicy: "none",
    defaultValue: null,
    description: "现货-期货价差或近远月价差。"
  };

  switch (formulaId) {
    case "stock_pe_relative_v1":
      return [
        ...common,
        { ...objectivePe, displayOrder: 10 },
        {
          key: "targetPe",
          label: "目标PE",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 18,
          displayOrder: 20,
          description: "行业/市场/全局基准回退。"
        }
      ];
    case "stock_pb_relative_v1":
      return [
        ...common,
        { ...objectivePb, displayOrder: 10 },
        {
          key: "targetPb",
          label: "目标PB",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 2.5,
          displayOrder: 20,
          description: "行业/市场/全局基准回退。"
        }
      ];
    case "stock_ps_relative_v1":
      return [
        ...common,
        { ...objectivePs, displayOrder: 10 },
        {
          key: "targetPs",
          label: "目标PS",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 3,
          displayOrder: 20,
          description: "行业/市场/全局基准回退。"
        }
      ];
    case "stock_peg_relative_v1":
      return [
        ...common,
        { ...objectivePe, displayOrder: 10 },
        {
          key: "growthRate",
          label: "增长率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.12,
          displayOrder: 20,
          description: "主观增长假设。"
        },
        {
          key: "targetPeg",
          label: "目标PEG",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 1,
          displayOrder: 21,
          description: "用于将增长率转换为目标PE。"
        }
      ];
    case "stock_ev_ebitda_relative_v1":
      return [
        ...common,
        { ...objectiveEvEbitda, displayOrder: 10 },
        {
          key: "targetEvEbitda",
          label: "目标EV/EBITDA",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 12,
          displayOrder: 20,
          description: "行业/市场/全局基准回退。"
        }
      ];
    case "stock_ev_sales_relative_v1":
      return [
        ...common,
        { ...objectivePs, displayOrder: 10 },
        {
          key: "targetEvSales",
          label: "目标EV/Sales",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 4,
          displayOrder: 20,
          description: "行业/市场/全局基准回退。"
        }
      ];
    case "stock_ddm_gordon_v1":
      return [
        ...common,
        { ...objectiveDv, displayOrder: 10 },
        {
          key: "dividendYield",
          label: "股息率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.03,
          displayOrder: 20,
          description: "可参考历史分红率。"
        },
        {
          key: "growthRate",
          label: "长期增长率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.05,
          displayOrder: 21,
          description: "长期股利增长假设。"
        },
        {
          key: "discountRate",
          label: "折现率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.1,
          displayOrder: 22,
          description: "估值贴现率。"
        }
      ];
    case "stock_fcff_twostage_v1":
      return [
        ...common,
        {
          key: "fcffYield",
          label: "FCFF收益率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.05,
          displayOrder: 20,
          description: "初始自由现金流收益率。"
        },
        {
          key: "highGrowthYears",
          label: "高增阶段年数",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 5,
          displayOrder: 21,
          description: "两阶段模型第一阶段长度。"
        },
        {
          key: "highGrowthRate",
          label: "高增阶段增速",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 0.1,
          displayOrder: 22,
          description: "第一阶段增长假设。"
        },
        {
          key: "terminalGrowthRate",
          label: "永续增长率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.03,
          displayOrder: 23,
          description: "第二阶段长期增长假设。"
        },
        {
          key: "wacc",
          label: "WACC",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.1,
          displayOrder: 24,
          description: "加权资本成本。"
        }
      ];
    case "futures_basis_v1":
      return [
        ...common,
        { ...objectiveBasis, displayOrder: 10 },
        { ...objectiveVolatility, displayOrder: 11 },
        {
          key: "basisWeight",
          label: "基差权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.7,
          displayOrder: 20,
          description: "基差对估值影响的权重。"
        },
        {
          key: "volPenalty",
          label: "波动惩罚",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.3,
          displayOrder: 21,
          description: "波动率惩罚系数。"
        }
      ];
    case "futures_trend_vol_v1":
      return [
        ...common,
        { ...objectiveMomentum, displayOrder: 10 },
        { ...objectiveVolatility, displayOrder: 11 },
        {
          key: "momentumWeight",
          label: "动量权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.65,
          displayOrder: 20,
          description: "动量因子权重。"
        },
        {
          key: "volatilityPenalty",
          label: "波动惩罚",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.3,
          displayOrder: 21,
          description: "波动率惩罚系数。"
        }
      ];
    case "futures_term_structure_v1":
      return [
        ...common,
        {
          key: "expectedBasisPct",
          label: "预期基差(%)",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.01,
          displayOrder: 20,
          description: "近月合约相对现货的预期基差。"
        },
        {
          key: "rollYieldPct",
          label: "展期收益(%)",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.005,
          displayOrder: 21,
          description: "期限结构带来的展期收益。"
        }
      ];
    case "volatility_discount_v1":
      return [
        ...common,
        { ...objectiveVolatility, displayOrder: 10 },
        {
          key: "volatilityDiscountWeight",
          label: "波动率折价系数",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.6,
          displayOrder: 20,
          description: "将实现波动率映射到价格折价比例。"
        }
      ];
    case "volatility_risk_premium_v1":
      return [
        ...common,
        { ...objectiveVolatility, displayOrder: 10 },
        {
          key: "impliedVolatility",
          label: "隐含波动率",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.28,
          displayOrder: 20,
          description: "可来自期权隐含波动率或研究输入。"
        },
        {
          key: "vrpBeta",
          label: "风险溢价系数",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.8,
          displayOrder: 21,
          description: "隐含与实现波动率差值对价格影响的传导系数。"
        }
      ];
    case "volatility_percentile_band_v1":
      return [
        ...common,
        { ...objectiveVolatility, displayOrder: 10 },
        {
          key: "volatilityPercentile",
          label: "波动率分位数",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.5,
          displayOrder: 20,
          description: "当前波动率在历史样本中的分位位置（0-1）。"
        },
        {
          key: "percentileAnchor",
          label: "分位锚点",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "constant",
          defaultValue: 0.5,
          displayOrder: 21,
          description: "分位估值的中性锚点。"
        },
        {
          key: "percentileSensitivity",
          label: "分位敏感度",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.4,
          displayOrder: 22,
          description: "分位偏离锚点后的估值调整强度。"
        }
      ];
    case "spot_carry_v1":
      return [
        ...common,
        {
          key: "factor.carry.annualized",
          label: "Carry 年化",
          kind: "objective",
          unit: "pct",
          editable: false,
          objectiveSource: "market.daily_prices.derived.carry_annualized",
          defaultPolicy: "none",
          defaultValue: null,
          displayOrder: 10,
          description: "基于历史价格近似计算的 carry。"
        },
        {
          key: "carryWeight",
          label: "Carry 权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 1,
          displayOrder: 20,
          description: "carry 对估值影响权重。"
        }
      ];
    case "spot_mean_reversion_v1":
      return [
        ...common,
        { ...objectiveMomentum, displayOrder: 10 },
        {
          key: "reversionStrength",
          label: "回归强度",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.35,
          displayOrder: 20,
          description: "动量向均值回归的强度。"
        }
      ];
    case "spot_inventory_risk_v1":
      return [
        ...common,
        { ...objectiveVolatility, displayOrder: 10 },
        {
          key: "inventoryPremium",
          label: "库存溢价",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "industry_median",
          defaultValue: 0.04,
          displayOrder: 20,
          description: "库存紧张带来的价格溢价。"
        },
        {
          key: "volatilityPenalty",
          label: "波动惩罚",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.35,
          displayOrder: 21,
          description: "波动率惩罚系数。"
        }
      ];
    case "forex_ppp_v1":
      return [
        ...common,
        {
          key: "factor.ppp_gap",
          label: "PPP 偏离",
          kind: "objective",
          unit: "pct",
          editable: false,
          objectiveSource: "macro.ppp_gap",
          defaultPolicy: "none",
          defaultValue: null,
          displayOrder: 10,
          description: "购买力平价偏离估计。"
        },
        {
          key: "pppWeight",
          label: "PPP 权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.8,
          displayOrder: 20,
          description: "PPP 对估值贡献权重。"
        },
        {
          key: "momentumWeight",
          label: "动量权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.2,
          displayOrder: 21,
          description: "动量项补充权重。"
        }
      ];
    case "forex_rate_differential_v1":
      return [
        ...common,
        {
          key: "carryDifferential",
          label: "利差(年化)",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.01,
          displayOrder: 20,
          description: "两币种政策利率或掉期点差。"
        },
        {
          key: "horizonYears",
          label: "持有期(年)",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "constant",
          defaultValue: 1,
          displayOrder: 21,
          description: "估值持有期。"
        }
      ];
    case "forex_reer_reversion_v1":
      return [
        ...common,
        { ...objectiveMomentum, displayOrder: 10 },
        {
          key: "reerGap",
          label: "REER 偏离",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.03,
          displayOrder: 20,
          description: "有效汇率偏离幅度。"
        },
        {
          key: "reversionSpeed",
          label: "回归速度",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.45,
          displayOrder: 21,
          description: "REER 回归的速度系数。"
        }
      ];
    case "bond_yield_v1":
      return [
        ...common,
        {
          key: "risk.duration",
          label: "久期",
          kind: "objective",
          unit: "number",
          editable: false,
          objectiveSource: "bond.curve.duration",
          defaultPolicy: "none",
          defaultValue: null,
          displayOrder: 10,
          description: "组合或券种久期。"
        },
        {
          key: "risk.yield_shift",
          label: "收益率冲击",
          kind: "objective",
          unit: "pct",
          editable: false,
          objectiveSource: "bond.curve.yield_shift",
          defaultPolicy: "none",
          defaultValue: null,
          displayOrder: 11,
          description: "期限结构变动冲击。"
        },
        {
          key: "durationWeight",
          label: "久期权重",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "constant",
          defaultValue: 1,
          displayOrder: 20,
          description: "久期冲击传导权重。"
        }
      ];
    case "bond_spread_duration_v1":
      return [
        ...common,
        {
          key: "duration",
          label: "久期",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 6,
          displayOrder: 20,
          description: "利差冲击对应久期。"
        },
        {
          key: "spreadChange",
          label: "利差变动",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: 0.002,
          displayOrder: 21,
          description: "信用/期限利差变化。"
        },
        {
          key: "convexity",
          label: "凸性",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 0.5,
          displayOrder: 22,
          description: "二阶修正项。"
        }
      ];
    case "bond_real_rate_v1":
      return [
        ...common,
        {
          key: "realRateGap",
          label: "实际利率偏离",
          kind: "subjective",
          unit: "pct",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "market_median",
          defaultValue: -0.005,
          displayOrder: 20,
          description: "当前实际利率相对中枢偏离。"
        },
        {
          key: "sensitivity",
          label: "敏感度",
          kind: "subjective",
          unit: "number",
          editable: true,
          objectiveSource: null,
          defaultPolicy: "global_median",
          defaultValue: 4,
          displayOrder: 21,
          description: "价格对实际利率偏离敏感度。"
        }
      ];
    default:
      if (formulaId.startsWith("stock_")) {
        return [
          ...common,
          { ...objectivePe, displayOrder: 10 },
          { ...objectivePb, displayOrder: 11 },
          { ...objectivePs, displayOrder: 12 }
        ];
      }
      return common;
  }
}
