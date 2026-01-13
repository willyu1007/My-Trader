declare module "sql.js" {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export type SqlValue = number | string | Uint8Array | null;

  export interface BindParams {
    [key: string]: SqlValue;
  }

  export interface ParamsObject {
    [key: string]: SqlValue;
  }

  export interface ParamsCallback {
    (obj: ParamsObject): void;
  }

  export interface Statement {
    bind(params?: BindParams | SqlValue[]): boolean;
    step(): boolean;
    getColumnNames(): string[];
    get(params?: BindParams | SqlValue[]): SqlValue[];
    getAsObject(params?: BindParams | SqlValue[]): ParamsObject;
    run(params?: BindParams | SqlValue[]): void;
    reset(): void;
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: BindParams | SqlValue[]): Database;
    exec(sql: string, params?: BindParams | SqlValue[]): QueryExecResult[];
    each(
      sql: string,
      params: BindParams | SqlValue[],
      callback: ParamsCallback,
      done: () => void
    ): Database;
    each(sql: string, callback: ParamsCallback, done: () => void): Database;
    prepare(sql: string, params?: BindParams | SqlValue[]): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
    create_function(name: string, func: (...args: SqlValue[]) => SqlValue): Database;
    create_aggregate(
      name: string,
      functions: {
        init?: () => void;
        step: (state: unknown, ...args: SqlValue[]) => void;
        finalize: (state: unknown) => SqlValue;
      }
    ): Database;
  }

  export interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
