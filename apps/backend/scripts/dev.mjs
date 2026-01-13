import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const backendDir = process.cwd();
const frontendDir = path.resolve(backendDir, "../frontend");

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const require = createRequire(import.meta.url);
const electronPath = require("electron");

function spawnChild(command, args, options) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options
  });
}

function waitForHttpOk(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
          return;
        }
        setTimeout(tick, 250);
      });
      req.on("error", () => setTimeout(tick, 250));
    };
    tick();
  });
}

function waitForExitOk(child, name) {
  return new Promise((resolve, reject) => {
    child.on("exit", (code) => {
      if (!code || code === 0) resolve();
      else reject(new Error(`${name} exited with code ${code}`));
    });
  });
}

async function run() {
  const devServerUrl = "http://localhost:5173";

  const sharedDir = path.resolve(backendDir, "../../packages/shared");
  const sharedBuild = spawnChild(pnpmCmd, ["run", "build"], { cwd: sharedDir });

  const vite = spawnChild(pnpmCmd, ["dev"], { cwd: frontendDir });
  const build = spawnChild(pnpmCmd, ["run", "build"], { cwd: backendDir });

  const exit = (code) => {
    try {
      vite.kill("SIGTERM");
    } catch {}
    process.exit(code);
  };

  vite.on("exit", (code) => {
    if (code && code !== 0) exit(code);
  });

  await Promise.all([
    waitForHttpOk(devServerUrl, 30_000),
    waitForExitOk(sharedBuild, "shared build"),
    waitForExitOk(build, "backend build")
  ]);

  const childEnv = { ...process.env, MYTRADER_DEV_SERVER_URL: devServerUrl };
  delete childEnv.ELECTRON_RUN_AS_NODE;

  const electron = spawnChild(electronPath, ["."], {
    cwd: backendDir,
    env: childEnv
  });

  electron.on("exit", (code) => exit(code ?? 0));

  process.on("SIGINT", () => exit(130));
  process.on("SIGTERM", () => exit(143));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
