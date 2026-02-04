import path from "node:path";
import { Worker as NodeWorker } from "node:worker_threads";

import type {
  AsyncDuckDB,
  AsyncDuckDBConnection,
  DuckDBAccessMode
} from "@duckdb/duckdb-wasm";

type DuckdbModule = typeof import("@duckdb/duckdb-wasm");

type WorkerLike = {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage: (data: unknown, transferList?: ArrayBuffer[]) => void;
  terminate: () => void;
  addEventListener?: (type: string, listener: (event: { data: unknown }) => void) => void;
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

  worker.on("message", (data) => {
    if (typeof wrapper.onmessage === "function") wrapper.onmessage({ data });
  });
  worker.on("error", (error) => {
    if (typeof wrapper.onerror === "function") wrapper.onerror(error);
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
    path: path.resolve(analysisDbPath),
    accessMode
  });

  return {
    db,
    connect: async () => await db.connect(),
    close: async () => {
      await db.terminate();
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

    await conn.query(
      `insert into analysis_meta (key, value) values ('schema_version', '1') on conflict(key) do nothing;`
    );
  } finally {
    await conn.close();
  }
}
