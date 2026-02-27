import { LOG_FILE, clearStalePidFile, isPidAlive, readPid } from "./dev-run-action-common.mjs";

const pid = readPid();

if (!pid) {
  console.log("[run-action] 未检测到运行中的 dev 进程（缺少 pid 文件）");
  process.exit(0);
}

if (!isPidAlive(pid)) {
  clearStalePidFile();
  console.log("[run-action] 发现陈旧 pid 文件，已清理");
  process.exit(0);
}

console.log(`[run-action] MyTrader dev 运行中 (pid=${pid})`);
console.log(`[run-action] 日志: ${LOG_FILE}`);
