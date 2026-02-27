import { spawnSync } from "node:child_process";

import { clearStalePidFile, isPidAlive, readPid } from "./dev-run-action-common.mjs";

const pid = readPid();

if (!pid) {
  console.log("[run-action] 未检测到运行中的 dev 进程");
  process.exit(0);
}

if (!isPidAlive(pid)) {
  clearStalePidFile();
  console.log("[run-action] 进程已退出，已清理 pid 文件");
  process.exit(0);
}

if (process.platform === "win32") {
  const result = spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)], {
    stdio: "inherit",
    shell: true
  });
  if (result.status && result.status !== 0) {
    process.exit(result.status);
  }
} else {
  try {
    // negative pid targets the detached process group
    process.kill(-pid, "SIGTERM");
  } catch {
    process.kill(pid, "SIGTERM");
  }
}

clearStalePidFile();
console.log(`[run-action] 已停止 dev 进程 (pid=${pid})`);
