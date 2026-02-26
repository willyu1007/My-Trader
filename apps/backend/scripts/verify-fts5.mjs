import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js");

async function run() {
  const distWasmPath = path.join(process.cwd(), "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => distWasmPath });
  const db = new SQL.Database();
  db.run("create virtual table fts5_probe using fts5(content)");
  db.run("insert into fts5_probe(content) values ('policy alpha'), ('earnings beta')");
  const result = db.exec("select count(*) from fts5_probe where fts5_probe match 'policy'");
  const hits = Number(result?.[0]?.values?.[0]?.[0] ?? 0);
  if (hits !== 1) {
    throw new Error(`[verify-fts5] expected 1 hit, got ${hits}`);
  }
  console.log("[verify-fts5] ok");
}

run().catch((error) => {
  console.error("[verify-fts5] failed", error);
  process.exit(1);
});
