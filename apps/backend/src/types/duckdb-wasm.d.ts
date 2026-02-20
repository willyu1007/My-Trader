declare module "@duckdb/duckdb-wasm" {
  export type DuckDBAccessMode = number;

  export const DuckDBAccessMode: {
    READ_ONLY: DuckDBAccessMode;
    READ_WRITE: DuckDBAccessMode;
    AUTOMATIC: DuckDBAccessMode;
  };

  export class VoidLogger {}

  export interface AsyncDuckDBConnection {
    query(sql: string): Promise<any>;
    close(): Promise<void>;
  }

  export class AsyncDuckDB {
    constructor(logger: any, worker: any);
    instantiate(mainModule: string, pthreadWorker?: string): Promise<void>;
    open(config: { path: string; accessMode?: DuckDBAccessMode }): Promise<void>;
    connect(): Promise<AsyncDuckDBConnection>;
    terminate(): Promise<void>;
  }

  export function selectBundle(bundles: any): Promise<{
    mainModule: string;
    mainWorker?: string;
    pthreadWorker?: string;
  }>;
}
