import path from "node:path";
import fs from "node:fs";
import { Worker as NodeWorker } from "node:worker_threads";

import type {
  AsyncDuckDB,
  AsyncDuckDBConnection,
  DuckDBAccessMode
} from "@duckdb/duckdb-wasm";

export type AnalysisDuckdbConnection = AsyncDuckDBConnection;

type DuckdbModule = typeof import("@duckdb/duckdb-wasm");

type WorkerLike = {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage: (data: unknown, transferList?: ArrayBuffer[]) => void;
  terminate: () => void;
  addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
};

let duckdbModule: DuckdbModule | null = null;

async function getDuckdbModule(): Promise<DuckdbModule> {
  if (!duckdbModule) {
    duckdbModule = await import("@duckdb/duckdb-wasm");
  }
  return duckdbModule;
}

function createNodeWebWorker(modulePath: string): WorkerLike {
  const bootstrap = `
    const { parentPort, workerData } = require('node:worker_threads');
    const listeners = new Map();
    function dispatch(type, data) {
      const event = { type, data, target: globalThis, currentTarget: globalThis };
      const handler = globalThis['on' + type];
      if (typeof handler === 'function') {
        try { handler(event); } catch (e) { console.error(e); }
      }
      const list = listeners.get(type);
      if (list) {
        for (const fn of list) {
          try { fn.call(globalThis, event); } catch (e) { console.error(e); }
        }
      }
    }
    globalThis.addEventListener = (type, fn) => {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    };
    globalThis.removeEventListener = (type, fn) => {
      const list = listeners.get(type);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    };
    globalThis.dispatchEvent = (event) => dispatch(event.type, event.data);
    globalThis.postMessage = (data, transferList) => parentPort.postMessage(data, transferList);
    parentPort.on('message', (data) => dispatch('message', data));
    parentPort.on('error', (err) => dispatch('error', err));
    require(workerData.modulePath);
  `;

  const worker = new NodeWorker(bootstrap, {
    eval: true,
    workerData: { modulePath }
  });

  const wrapper: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(data, transferList) {
      worker.postMessage(data, transferList as any);
    },
    terminate() {
      worker.terminate();
    }
  };

  const listeners = {
    message: new Set<(event: unknown) => void>(),
    error: new Set<(event: unknown) => void>()
  } as const;

  wrapper.addEventListener = (type, listener) => {
    if (type === "message") listeners.message.add(listener);
    else if (type === "error") listeners.error.add(listener);
  };

  wrapper.removeEventListener = (type, listener) => {
    if (type === "message") listeners.message.delete(listener);
    else if (type === "error") listeners.error.delete(listener);
  };

  worker.on("message", (data) => {
    const event = { data };
    if (typeof wrapper.onmessage === "function") wrapper.onmessage(event);
    for (const listener of listeners.message) listener(event);
  });
  worker.on("error", (error) => {
    if (typeof wrapper.onerror === "function") wrapper.onerror(error);
    for (const listener of listeners.error) listener(error);
  });

  return wrapper;
}

export type AnalysisDuckdbHandle = {
  db: AsyncDuckDB;
  connect: () => Promise<AsyncDuckDBConnection>;
  close: () => Promise<void>;
};

export async function openAnalysisDuckdb(
  analysisDbPath: string
): Promise<AnalysisDuckdbHandle> {
  const duckdb = await getDuckdbModule();
  const resolvedPath = path.resolve(analysisDbPath);
  const tempDir = path.join(path.dirname(resolvedPath), "duckdb-temp");
  fs.mkdirSync(tempDir, { recursive: true });

  const wasmMvp = require.resolve("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm");
  const wasmEh = require.resolve("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm");
  const workerMvp = require.resolve(
    "@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs"
  );
  const workerEh = require.resolve(
    "@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs"
  );

  const bundles = {
    mvp: { mainModule: wasmMvp, mainWorker: workerMvp },
    eh: { mainModule: wasmEh, mainWorker: workerEh }
  } as const;

  const bundle = await duckdb.selectBundle(bundles as any);
  if (!bundle.mainWorker) {
    throw new Error("[mytrader] DuckDB bundle missing worker entry.");
  }
  const worker = createNodeWebWorker(bundle.mainWorker);

  const logger = new duckdb.VoidLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker as any);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  const accessMode = duckdb.DuckDBAccessMode.READ_WRITE as DuckDBAccessMode;
  await db.open({
    path: resolvedPath,
    accessMode
  });

  await applyDuckdbRuntimeSettings(db, tempDir);

  return {
    db,
    connect: async () => await db.connect(),
    close: async () => {
      await db.terminate();
    }
  };
}

async function applyDuckdbRuntimeSettings(
  db: AsyncDuckDB,
  tempDirectory: string
): Promise<void> {
  const conn = await db.connect();
  try {
    const tempDirSql = escapeDuckdbString(tempDirectory);
    await conn.query(`set temp_directory='${tempDirSql}';`);

    const optionalSettings = [
      "set memory_limit='1GB';",
      "set preserve_insertion_order=false;",
      "set threads=1;"
    ];
    for (const sql of optionalSettings) {
      try {
        await conn.query(sql);
      } catch (error) {
        console.warn(`[mytrader] duckdb runtime setting failed: ${sql}`);
        console.warn(error);
      }
    }
  } finally {
    await conn.close();
  }
}

function escapeDuckdbString(value: string): string {
  return value.replace(/'/g, "''");
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
      create table if not exists fx_pair_meta (
        symbol varchar not null,
        base_ccy varchar,
        quote_ccy varchar,
        quote_convention varchar,
        is_active boolean not null,
        updated_at bigint not null,
        primary key (symbol)
      );
    `);

    await conn.query(`
      create table if not exists macro_series_meta (
        series_key varchar not null,
        region varchar not null,
        topic varchar not null,
        source_api varchar not null,
        frequency varchar not null,
        unit varchar,
        is_active boolean not null,
        updated_at bigint not null,
        primary key (series_key)
      );
    `);

    await conn.query(`
      create table if not exists macro_observations (
        series_key varchar not null,
        period_end varchar not null,
        release_date varchar not null,
        available_date varchar not null,
        value double not null,
        unit varchar,
        frequency varchar not null,
        revision_no integer not null,
        source varchar not null,
        ingested_at bigint not null,
        primary key (series_key, period_end, release_date)
      );
    `);

    await conn.query(`
      create table if not exists macro_module_snapshot (
        as_of_trade_date varchar not null,
        module_id varchar not null,
        status varchar not null,
        coverage_ratio double not null,
        available_date varchar,
        payload_json varchar not null,
        source_run_id varchar,
        updated_at bigint not null,
        primary key (as_of_trade_date, module_id)
      );
    `);

    await conn.query(
      `insert into analysis_meta (key, value) values ('schema_version', '1') on conflict(key) do nothing;`
    );
  } finally {
    await conn.close();
  }
}
