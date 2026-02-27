import { all, exec, execVolatile, get, run, transaction } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";
import { backfillBaselineLedgerFromPositions } from "./ledgerBaseline";

const CURRENT_SCHEMA_VERSION = 7;

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
}

const BUILTIN_VALUATION_METHOD_SEEDS: BuiltinValuationMethodSeed[] = [
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
          graph_json, param_schema_json, metric_schema_json, formula_manifest_json,
          created_at, updated_at
        )
        values (?, ?, 1, null, null, ?, ?, ?, ?, ?, ?)
        on conflict(method_id, version) do update set
          graph_json = excluded.graph_json,
          param_schema_json = excluded.param_schema_json,
          metric_schema_json = excluded.metric_schema_json,
          formula_manifest_json = excluded.formula_manifest_json,
          updated_at = excluded.updated_at
      `,
      [
        versionId,
        seed.id,
        JSON.stringify(graph),
        JSON.stringify(seed.paramSchema),
        JSON.stringify(seed.metricSchema),
        JSON.stringify({ formulaId: seed.formulaId, locked: true }),
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
