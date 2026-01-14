import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

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

function watchBuildOutputs(dir, files, onChange) {
  const watcher = fs.watch(dir, (event, filename) => {
    const name = typeof filename === "string" ? filename : filename?.toString();
    if (!name || !files.includes(name)) return;
    onChange(name);
  });
  return () => watcher.close();
}

async function run() {
  const devServerUrl = "http://localhost:5173";

  const sharedDir = path.resolve(backendDir, "../../packages/shared");
  const sharedDistDir = path.resolve(sharedDir, "dist");
  const backendDistDir = path.resolve(backendDir, "dist");
  const sharedBuild = spawnChild(pnpmCmd, ["run", "build"], { cwd: sharedDir });

  const vite = spawnChild(pnpmCmd, ["dev"], { cwd: frontendDir });
  const build = spawnChild(pnpmCmd, ["run", "build"], { cwd: backendDir });

  let electron = null;
  let sharedWatch = null;
  let backendWatch = null;
  let restartTimer = null;
  let restartArmed = false;
  let isRestarting = false;
  let sharedWarm = false;
  let backendWarm = false;
  const stopWatchers = [];

  const exit = (code) => {
    try {
      vite.kill("SIGTERM");
    } catch {}
    try {
      sharedWatch?.kill("SIGTERM");
    } catch {}
    try {
      backendWatch?.kill("SIGTERM");
    } catch {}
    try {
      electron?.kill("SIGTERM");
    } catch {}
    stopWatchers.forEach((stop) => stop());
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

  const scheduleRestart = () => {
    if (!electron || isRestarting) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!electron) return;
      isRestarting = true;
      try {
        electron.kill("SIGTERM");
      } catch {
        isRestarting = false;
      }
    }, 200);
  };

  sharedWatch = spawnChild(pnpmCmd, ["run", "dev"], { cwd: sharedDir });
  backendWatch = spawnChild(pnpmCmd, ["run", "build", "--", "--watch"], {
    cwd: backendDir
  });

  sharedWatch.on("exit", (code) => {
    if (code && code !== 0) exit(code);
  });

  backendWatch.on("exit", (code) => {
    if (code && code !== 0) exit(code);
  });

  const handleBuildOutput = (source) => {
    if (!restartArmed) {
      if (source === "backend") backendWarm = true;
      if (source === "shared") sharedWarm = true;
      if (backendWarm && sharedWarm) restartArmed = true;
      return;
    }
    scheduleRestart();
  };

  stopWatchers.push(
    watchBuildOutputs(backendDistDir, ["main.js", "preload.js"], () =>
      handleBuildOutput("backend")
    ),
    watchBuildOutputs(sharedDistDir, ["index.js", "ipc.js"], () =>
      handleBuildOutput("shared")
    )
  );

  const startElectron = () => {
    electron = spawnChild(electronPath, ["."], {
      cwd: backendDir,
      env: childEnv
    });

    electron.on("exit", (code) => {
      if (isRestarting) {
        isRestarting = false;
        startElectron();
        return;
      }
      exit(code ?? 0);
    });
  };

  startElectron();
  setTimeout(() => {
    restartArmed = true;
  }, 10000);

  process.on("SIGINT", () => exit(130));
  process.on("SIGTERM", () => exit(143));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
