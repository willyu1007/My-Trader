import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import { createHash } from "node:crypto";

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

function terminateChild(child, name) {
  if (!child || child.killed) return;
  const pid = child.pid;
  if (!pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/T", "/F", "/PID", String(pid)], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }
  try {
    child.kill("SIGTERM");
  } catch {
    console.warn(`[mytrader] failed to terminate ${name ?? "child process"}`);
  }
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1" }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort, attempts = 20) {
  const base = Number(startPort);
  const total = Number(attempts);
  for (let i = 0; i < total; i += 1) {
    const port = base + i;
    // eslint-disable-next-line no-await-in-loop
    const available = await checkPortAvailable(port);
    if (available) return port;
  }
  throw new Error(
    `[mytrader] no available dev server port from ${base} to ${base + total - 1}`
  );
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
  const watcher = fs.watch(dir, (_event, filename) => {
    const name = typeof filename === "string" ? filename : filename?.toString();
    if (!name || !files.includes(name)) return;
    onChange(name);
  });
  return () => watcher.close();
}

async function run() {
  const STARTUP_STABILIZE_MS = 12000;
  const RESTART_COOLDOWN_MS = 2000;
  const basePort = Number(process.env.MYTRADER_DEV_PORT ?? 5173);
  const devPort = await findAvailablePort(basePort, 30);
  const devServerUrl = `http://localhost:${devPort}`;

  const sharedDir = path.resolve(backendDir, "../../packages/shared");
  const sharedDistDir = path.resolve(sharedDir, "dist");
  const backendDistDir = path.resolve(backendDir, "dist");
  const sharedBuild = spawnChild(pnpmCmd, ["run", "build"], { cwd: sharedDir });

  const vite = spawnChild(
    pnpmCmd,
    ["exec", "vite", "--port", String(devPort)],
    { cwd: frontendDir }
  );
  const build = spawnChild(pnpmCmd, ["run", "build"], { cwd: backendDir });

  let electron = null;
  let sharedWatch = null;
  let backendWatch = null;
  let restartTimer = null;
  let restartArmed = false;
  let restartSuppressUntil = 0;
  let isRestarting = false;
  let sharedWarm = false;
  let backendWarm = false;
  let watchWarmResolved = false;
  let resolveWatchWarm;
  const outputHashByPath = new Map();
  const watchWarmReady = new Promise((resolve) => {
    resolveWatchWarm = resolve;
  });
  const stopWatchers = [];

  const exit = (code) => {
    terminateChild(vite, "vite");
    terminateChild(sharedWatch, "shared");
    terminateChild(backendWatch, "backend");
    terminateChild(electron, "electron");
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

  const armRestart = (suppressMs = 1500) => {
    restartArmed = true;
    restartSuppressUntil = Date.now() + suppressMs;
  };

  const markWatchWarmReady = () => {
    if (watchWarmResolved) return;
    watchWarmResolved = true;
    resolveWatchWarm();
  };

  const scheduleRestart = () => {
    if (!electron || isRestarting) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!electron) return;
      isRestarting = true;
      terminateChild(electron, "electron");
    }, 200);
  };

  sharedWatch = spawnChild(pnpmCmd, ["run", "dev"], { cwd: sharedDir });
  backendWatch = spawnChild(pnpmCmd, ["exec", "tsup", "--watch", "--no-clean"], {
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
      if (backendWarm && sharedWarm) {
        markWatchWarmReady();
      }
      return;
    }
    if (Date.now() < restartSuppressUntil) return;
    scheduleRestart();
  };

  const toOutputHash = (filePath) => {
    try {
      const content = fs.readFileSync(filePath);
      return createHash("sha1").update(content).digest("hex");
    } catch {
      return null;
    }
  };

  const handleBuildOutputWithHash = (source, filePath) => {
    const hash = toOutputHash(filePath);
    if (!hash) return;
    const prev = outputHashByPath.get(filePath);
    if (prev === hash) return;
    outputHashByPath.set(filePath, hash);

    handleBuildOutput(source);
  };

  const watchedBackendFiles = ["main.js", "preload.js"];
  const watchedSharedFiles = ["index.js", "ipc.js"];

  stopWatchers.push(
    watchBuildOutputs(backendDistDir, watchedBackendFiles, (name) =>
      handleBuildOutputWithHash("backend", path.join(backendDistDir, name))
    ),
    watchBuildOutputs(sharedDistDir, watchedSharedFiles, (name) =>
      handleBuildOutputWithHash("shared", path.join(sharedDistDir, name))
    )
  );

  // Prime output hashes so initial watcher churn with unchanged content won't trigger restarts.
  for (const file of watchedBackendFiles) {
    const filePath = path.join(backendDistDir, file);
    const hash = toOutputHash(filePath);
    if (hash) outputHashByPath.set(filePath, hash);
  }
  for (const file of watchedSharedFiles) {
    const filePath = path.join(sharedDistDir, file);
    const hash = toOutputHash(filePath);
    if (hash) outputHashByPath.set(filePath, hash);
  }

  const startElectron = () => {
    electron = spawnChild(electronPath, ["."], {
      cwd: backendDir,
      env: childEnv,
      shell: false
    });

    electron.on("exit", (code) => {
      if (isRestarting) {
        isRestarting = false;
        armRestart(RESTART_COOLDOWN_MS);
        startElectron();
        return;
      }
      exit(code ?? 0);
    });
  };

  setTimeout(() => {
    markWatchWarmReady();
  }, 10000);

  await watchWarmReady;
  startElectron();
  // Enable hot-restart only after startup settles to avoid launch-time restart storms.
  setTimeout(() => {
    armRestart(RESTART_COOLDOWN_MS);
  }, STARTUP_STABILIZE_MS);

  process.on("SIGINT", () => exit(130));
  process.on("SIGTERM", () => exit(143));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
