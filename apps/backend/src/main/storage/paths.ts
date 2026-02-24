import fs from "node:fs";
import path from "node:path";

import { ensureBusinessSchema } from "./businessSchema";
import { close, execVolatile, openSqliteDatabase } from "./sqlite";

export interface AccountDataLayout {
  businessDbPath: string;
  analysisDbPath: string;
}

export async function ensureAccountDataLayout(
  accountDir: string
): Promise<AccountDataLayout> {
  await fs.promises.mkdir(accountDir, { recursive: true });

  const businessDbPath = path.join(accountDir, "business.sqlite");
  const analysisDbPath = path.join(accountDir, "analysis.duckdb");

  const businessDb = await openSqliteDatabase(businessDbPath);
  await execVolatile(businessDb, `pragma journal_mode = delete;`);
  await execVolatile(businessDb, `pragma temp_store = memory;`);
  await ensureBusinessSchema(businessDb);
  await close(businessDb);

  // duckdb-wasm expects a valid DuckDB file; a pre-created empty file is invalid.
  // For historical accounts, remove the zero-byte placeholder before first open.
  try {
    const stat = await fs.promises.stat(analysisDbPath);
    if (stat.size === 0) {
      await fs.promises.unlink(analysisDbPath);
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") throw error;
  }

  return { businessDbPath, analysisDbPath };
}
