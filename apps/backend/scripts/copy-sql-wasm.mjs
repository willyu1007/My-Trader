import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const source = path.join(rootDir, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
const targetDir = path.join(rootDir, "dist");
const target = path.join(targetDir, "sql-wasm.wasm");

if (!fs.existsSync(source)) {
  console.error(`[mytrader] sql.js wasm not found at ${source}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`[mytrader] copied sql.js wasm to ${target}`);
