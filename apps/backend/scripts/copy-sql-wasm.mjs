import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const customSource = path.join(rootDir, "vendor", "sql-wasm-fts5.wasm");
const fallbackSource = path.join(
  rootDir,
  "node_modules",
  "sql.js",
  "dist",
  "sql-wasm.wasm"
);
const source = fs.existsSync(customSource) ? customSource : fallbackSource;
const targetDir = path.join(rootDir, "dist");
const target = path.join(targetDir, "sql-wasm.wasm");

if (!fs.existsSync(source)) {
  console.error(`[mytrader] sql.js wasm not found at ${source}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`[mytrader] copied sql.js wasm to ${target}`);
