import { openSync, closeSync } from "node:fs";
import { spawn } from "node:child_process";

import {
  LOG_FILE,
  clearStalePidFile,
  isPidAlive,
  readPid,
  savePid,
  REPO_ROOT
} from "./dev-run-action-common.mjs";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const existingPid = readPid();

if (existingPid && isPidAlive(existingPid)) {
  console.log(`[run-action] MyTrader dev 已在运行 (pid=${existingPid})`);
  console.log(`[run-action] 日志: ${LOG_FILE}`);
  process.exit(0);
}

if (existingPid) {
  clearStalePidFile();
}

const logFd = openSync(LOG_FILE, "a");
const child = spawn(pnpmCmd, ["dev"], {
  cwd: REPO_ROOT,
  detached: true,
  stdio: ["ignore", logFd, logFd],
  env: process.env,
  shell: process.platform === "win32"
});

if (!child.pid) {
  closeSync(logFd);
  throw new Error("无法启动 dev 进程");
}

savePid(child.pid);
child.unref();
closeSync(logFd);

console.log(`[run-action] 已后台启动 MyTrader dev (pid=${child.pid})`);
console.log(`[run-action] 日志: ${LOG_FILE}`);
console.log("[run-action] 可用 `pnpm run dev:run-action:status` 查看状态");
