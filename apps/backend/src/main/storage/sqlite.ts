import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";

export type SqliteDatabase = SqlJsDatabase;

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

const WASM_FILENAME = "sql-wasm.wasm";
const FLUSH_DEBOUNCE_MS = 250;
const RECENT_FLUSH_LIMIT = 50;

// Map to track database file paths for persistence
const dbFilePaths = new Map<SqlJsDatabase, string>();
const transactionDepths = new Map<SqlJsDatabase, number>();
const dirtyDatabases = new Set<SqlJsDatabase>();
const flushTimers = new Map<SqlJsDatabase, NodeJS.Timeout>();

type FlushTrigger = "scheduled" | "transaction_commit" | "close" | "manual";

type FlushRecord = {
  filePath: string;
  trigger: FlushTrigger;
  bytes: number;
  durationMs: number;
  timestamp: number;
};

const runtimeStats = {
  flushDebounceMs: FLUSH_DEBOUNCE_MS,
  dirtyDbCount: 0,
  scheduledFlushCount: 0,
  completedFlushCount: 0,
  totalFlushBytes: 0,
  totalFlushDurationMs: 0,
  lastFlushError: null as string | null,
  recentFlushes: [] as FlushRecord[]
};

export type SqliteRuntimePerfStats = {
  flushDebounceMs: number;
  dirtyDbCount: number;
  scheduledFlushCount: number;
  completedFlushCount: number;
  totalFlushBytes: number;
  totalFlushDurationMs: number;
  lastFlushError: string | null;
  recentFlushes: FlushRecord[];
};

function resolveSqlJsWasmPath(): string {
  const distPath = path.join(__dirname, WASM_FILENAME);
  if (fs.existsSync(distPath)) return distPath;

  const nodeModulesPath = path.join(
    process.cwd(),
    "node_modules",
    "sql.js",
    "dist",
    WASM_FILENAME
  );
  if (fs.existsSync(nodeModulesPath)) return nodeModulesPath;

  throw new Error(
    `[mytrader] 未找到 sql.js wasm 文件。期望路径：${distPath} 或 ${nodeModulesPath}`
  );
}

async function getSqlJs() {
  if (!SQL) {
    const wasmPath = resolveSqlJsWasmPath();
    SQL = await initSqlJs({
      locateFile: () => wasmPath
    });
  }
  return SQL;
}

export async function openSqliteDatabase(filePath: string): Promise<SqlJsDatabase> {
  const sqlJs = await getSqlJs();

  let db: SqlJsDatabase;
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    db = new sqlJs.Database(buffer);
  } else {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new sqlJs.Database();
  }

  dbFilePaths.set(db, filePath);
  return db;
}

function updateDirtyDbCount(): void {
  runtimeStats.dirtyDbCount = dirtyDatabases.size;
}

function clearScheduledFlush(db: SqlJsDatabase): void {
  const timer = flushTimers.get(db);
  if (timer) {
    clearTimeout(timer);
    flushTimers.delete(db);
  }
}

function recordFlush(
  db: SqlJsDatabase,
  trigger: FlushTrigger,
  bytes: number,
  durationMs: number
): void {
  const filePath = dbFilePaths.get(db);
  if (!filePath) return;

  const record: FlushRecord = {
    filePath,
    trigger,
    bytes,
    durationMs,
    timestamp: Date.now()
  };
  runtimeStats.completedFlushCount += 1;
  runtimeStats.totalFlushBytes += bytes;
  runtimeStats.totalFlushDurationMs += durationMs;
  runtimeStats.recentFlushes.push(record);
  if (runtimeStats.recentFlushes.length > RECENT_FLUSH_LIMIT) {
    runtimeStats.recentFlushes.splice(
      0,
      runtimeStats.recentFlushes.length - RECENT_FLUSH_LIMIT
    );
  }
}

function saveDatabaseAtomic(db: SqlJsDatabase, trigger: FlushTrigger): void {
  const filePath = dbFilePaths.get(db);
  if (!filePath) return;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const flushStart = Date.now();
  const data = db.export();
  const buffer = Buffer.from(data);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;

  try {
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, filePath);
    runtimeStats.lastFlushError = null;
    recordFlush(db, trigger, buffer.byteLength, Date.now() - flushStart);
  } catch (error) {
    runtimeStats.lastFlushError =
      error instanceof Error ? error.message : String(error);
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // ignore temp cleanup errors
    }
    throw error;
  }
}

function isTransactionActive(db: SqlJsDatabase): boolean {
  return (transactionDepths.get(db) ?? 0) > 0;
}

function markDirty(db: SqlJsDatabase): void {
  dirtyDatabases.add(db);
  updateDirtyDbCount();
}

function flushDatabase(
  db: SqlJsDatabase,
  trigger: FlushTrigger,
  force = false
): void {
  if (!force && !dirtyDatabases.has(db)) return;
  if (!force && isTransactionActive(db)) return;
  saveDatabaseAtomic(db, trigger);
  dirtyDatabases.delete(db);
  updateDirtyDbCount();
}

function scheduleFlush(db: SqlJsDatabase): void {
  if (!dirtyDatabases.has(db)) return;
  if (isTransactionActive(db)) return;
  if (flushTimers.has(db)) return;
  if (!dbFilePaths.has(db)) return;

  runtimeStats.scheduledFlushCount += 1;
  const timer = setTimeout(() => {
    flushTimers.delete(db);
    try {
      flushDatabase(db, "scheduled");
    } catch (error) {
      console.error("[mytrader] sqlite scheduled flush failed", error);
    } finally {
      if (dirtyDatabases.has(db) && !isTransactionActive(db)) {
        scheduleFlush(db);
      }
    }
  }, FLUSH_DEBOUNCE_MS);
  timer.unref?.();
  flushTimers.set(db, timer);
}

export function getSqliteRuntimePerfStats(): SqliteRuntimePerfStats {
  return {
    flushDebounceMs: runtimeStats.flushDebounceMs,
    dirtyDbCount: runtimeStats.dirtyDbCount,
    scheduledFlushCount: runtimeStats.scheduledFlushCount,
    completedFlushCount: runtimeStats.completedFlushCount,
    totalFlushBytes: runtimeStats.totalFlushBytes,
    totalFlushDurationMs: runtimeStats.totalFlushDurationMs,
    lastFlushError: runtimeStats.lastFlushError,
    recentFlushes: [...runtimeStats.recentFlushes]
  };
}

export function exec(db: SqlJsDatabase, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      db.exec(sql);
      markDirty(db);
      scheduleFlush(db);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export function execVolatile(db: SqlJsDatabase, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      db.exec(sql);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export function run(
  db: SqlJsDatabase,
  sql: string,
  params: unknown[] = []
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      db.run(sql, params as (string | number | null | Uint8Array)[]);
      markDirty(db);
      scheduleFlush(db);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export function get<T>(
  db: SqlJsDatabase,
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params as (string | number | null | Uint8Array)[]);

      if (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row: Record<string, unknown> = {};
        columns.forEach((col: string, i: number) => {
          row[col] = values[i];
        });
        stmt.free();
        resolve(row as T);
      } else {
        stmt.free();
        resolve(undefined);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export function all<T>(
  db: SqlJsDatabase,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params as (string | number | null | Uint8Array)[]);

      const rows: T[] = [];
      while (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        const row: Record<string, unknown> = {};
        columns.forEach((col: string, i: number) => {
          row[col] = values[i];
        });
        rows.push(row as T);
      }
      stmt.free();
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

export function close(db: SqlJsDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      clearScheduledFlush(db);
      if (dirtyDatabases.has(db)) {
        if (isTransactionActive(db)) {
          throw new Error("[mytrader] cannot close sqlite database during active transaction");
        }
        flushDatabase(db, "close");
      }
      dbFilePaths.delete(db);
      transactionDepths.delete(db);
      dirtyDatabases.delete(db);
      updateDirtyDbCount();
      db.close();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export async function transaction<T>(
  db: SqlJsDatabase,
  fn: () => Promise<T>
): Promise<T> {
  const previousDepth = transactionDepths.get(db) ?? 0;
  const nextDepth = previousDepth + 1;
  const savepointName = `mytrader_tx_${nextDepth}`;
  const isNested = previousDepth > 0;

  if (!isNested && dirtyDatabases.has(db)) {
    clearScheduledFlush(db);
    flushDatabase(db, "manual", true);
  }

  transactionDepths.set(db, nextDepth);
  try {
    if (isNested) {
      db.exec(`savepoint ${savepointName}`);
    } else {
      db.exec("begin");
    }
  } catch (err) {
    if (previousDepth <= 0) {
      transactionDepths.delete(db);
    } else {
      transactionDepths.set(db, previousDepth);
    }
    throw err;
  }

  try {
    const result = await fn();
    if (isNested) {
      db.exec(`release savepoint ${savepointName}`);
      transactionDepths.set(db, previousDepth);
      return result;
    }

    db.exec("commit");
    transactionDepths.delete(db);
    clearScheduledFlush(db);
    flushDatabase(db, "transaction_commit");
    return result;
  } catch (err) {
    try {
      if (isNested) {
        db.exec(`rollback to savepoint ${savepointName}`);
        db.exec(`release savepoint ${savepointName}`);
      } else {
        db.exec("rollback");
      }
    } catch (rollbackError) {
      console.error("[mytrader] failed to rollback transaction", rollbackError);
    }

    if (isNested) {
      transactionDepths.set(db, previousDepth);
    } else {
      transactionDepths.delete(db);
      dirtyDatabases.delete(db);
      updateDirtyDbCount();
      clearScheduledFlush(db);
    }
    throw err;
  } finally {
    if (!isTransactionActive(db) && dirtyDatabases.has(db)) {
      scheduleFlush(db);
    }
  }
}
