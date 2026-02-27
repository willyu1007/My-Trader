import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = dirname(__filename);

export const REPO_ROOT = resolve(scriptsDir, "..");
export const PID_FILE = resolve(REPO_ROOT, ".mytrader-dev.pid");
export const LOG_FILE = resolve(REPO_ROOT, ".mytrader-dev.log");

export function readPid() {
  try {
    const raw = readFileSync(PID_FILE, "utf8").trim();
    if (!raw) return null;
    const pid = Number.parseInt(raw, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function clearStalePidFile() {
  try {
    unlinkSync(PID_FILE);
  } catch {}
}

export function savePid(pid) {
  writeFileSync(PID_FILE, `${pid}\n`, "utf8");
}
