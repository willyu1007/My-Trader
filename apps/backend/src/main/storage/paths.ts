import fs from "node:fs";
import path from "node:path";

import { ensureBusinessSchema } from "./businessSchema";
import { close, exec, openSqliteDatabase } from "./sqlite";

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
  await exec(businessDb, `pragma journal_mode = wal;`);
  await ensureBusinessSchema(businessDb);
  await close(businessDb);

  await fs.promises.open(analysisDbPath, "a").then((f) => f.close());

  return { businessDbPath, analysisDbPath };
}
