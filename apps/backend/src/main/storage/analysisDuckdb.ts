import path from "node:path";

import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

export type AnalysisDuckdbQueryResult = {
  toArray: () => Array<Record<string, unknown>>;
};

export type AnalysisDuckdbConnection = {
  query: (sql: string) => Promise<AnalysisDuckdbQueryResult>;
  close: () => Promise<void>;
};

export type AnalysisDuckdbHandle = {
  connect: () => Promise<AnalysisDuckdbConnection>;
  close: () => Promise<void>;
};

export async function openAnalysisDuckdb(
  analysisDbPath: string
): Promise<AnalysisDuckdbHandle> {
  const instance = await DuckDBInstance.create(path.resolve(analysisDbPath), {
    access_mode: "read_write"
  });
  const openedConnections = new Set<DuckDBConnection>();
  let closed = false;

  const closeConnection = (connection: DuckDBConnection): void => {
    if (!openedConnections.delete(connection)) return;
    try {
      connection.closeSync();
    } catch {
      // ignore close errors during teardown
    }
  };

  return {
    connect: async () => {
      if (closed) {
        throw new Error("[mytrader] analysis.duckdb handle already closed.");
      }
      const rawConnection = await instance.connect();
      openedConnections.add(rawConnection);
      return {
        query: async (sql: string) => {
          const reader = await rawConnection.runAndReadAll(sql);
          const rows =
            (reader.getRowObjectsJson() as Array<Record<string, unknown>>) ?? [];
          return {
            toArray: () => rows
          };
        },
        close: async () => {
          closeConnection(rawConnection);
        }
      };
    },
    close: async () => {
      if (closed) return;
      closed = true;
      for (const connection of openedConnections) {
        try {
          connection.closeSync();
        } catch {
          // ignore close errors during teardown
        }
      }
      openedConnections.clear();
      instance.closeSync();
    }
  };
}

export async function ensureAnalysisDuckdbSchema(
  handle: AnalysisDuckdbHandle
): Promise<void> {
  const conn = await handle.connect();
  try {
    await conn.query(`
      create table if not exists analysis_meta (
        key varchar primary key,
        value varchar not null
      );
    `);

    await conn.query(`
      create table if not exists instrument_meta (
        symbol varchar not null,
        kind varchar not null,
        name varchar,
        market varchar,
        currency varchar,
        asset_class varchar,
        updated_at bigint not null,
        primary key (symbol)
      );
    `);

    await conn.query(`
      alter table instrument_meta add column if not exists asset_subclass varchar;
    `);

    await conn.query(`
      alter table instrument_meta add column if not exists commodity_group varchar;
    `);

    await conn.query(`
      alter table instrument_meta add column if not exists metal_type varchar;
    `);

    await conn.query(`
      create table if not exists trade_calendar (
        market varchar not null,
        date varchar not null,
        is_open boolean not null,
        ingested_at bigint not null,
        primary key (market, date)
      );
    `);

    await conn.query(`
      create table if not exists daily_prices (
        symbol varchar not null,
        trade_date varchar not null,
        open double,
        high double,
        low double,
        close double,
        volume double,
        source varchar not null,
        ingested_at bigint not null,
        primary key (symbol, trade_date)
      );
    `);

    await conn.query(`
      create table if not exists daily_basics (
        symbol varchar not null,
        trade_date varchar not null,
        circ_mv double,
        total_mv double,
        source varchar not null,
        ingested_at bigint not null,
        primary key (symbol, trade_date)
      );
    `);

    await conn.query(`
      create table if not exists daily_moneyflows (
        symbol varchar not null,
        trade_date varchar not null,
        net_mf_vol double,
        net_mf_amount double,
        source varchar not null,
        ingested_at bigint not null,
        primary key (symbol, trade_date)
      );
    `);

    await conn.query(`
      create table if not exists futures_contract_meta (
        ts_code varchar not null,
        symbol varchar,
        exchange varchar,
        fut_code varchar,
        name varchar,
        trade_unit varchar,
        per_unit varchar,
        quote_unit varchar,
        list_date varchar,
        delist_date varchar,
        updated_at bigint not null,
        primary key (ts_code)
      );
    `);

    await conn.query(`
      create table if not exists spot_sge_contract_meta (
        ts_code varchar not null,
        ts_name varchar,
        trade_type varchar,
        t_unit varchar,
        p_unit varchar,
        min_change varchar,
        price_limit varchar,
        min_vol varchar,
        max_vol varchar,
        trade_mode varchar,
        updated_at bigint not null,
        primary key (ts_code)
      );
    `);

    await conn.query(`
      create table if not exists futures_daily_ext (
        symbol varchar not null,
        trade_date varchar not null,
        pre_close double,
        pre_settle double,
        settle double,
        change1 double,
        change2 double,
        amount double,
        oi double,
        oi_chg double,
        delv_settle double,
        source varchar not null,
        ingested_at bigint not null,
        primary key (symbol, trade_date)
      );
    `);

    await conn.query(`
      create table if not exists spot_sge_daily_ext (
        symbol varchar not null,
        trade_date varchar not null,
        price_avg double,
        change double,
        pct_change double,
        amount double,
        oi double,
        settle_vol double,
        settle_dire varchar,
        source varchar not null,
        ingested_at bigint not null,
        primary key (symbol, trade_date)
      );
    `);

    await conn.query(
      `insert into analysis_meta (key, value) values ('schema_version', '1') on conflict(key) do nothing;`
    );
  } finally {
    await conn.close();
  }
}
