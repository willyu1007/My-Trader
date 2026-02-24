import { BrowserWindow, app } from "electron";

import { createMainWindow } from "./createMainWindow";
import { registerIpcHandlers, shutdownBackendRuntime } from "./ipc/registerIpcHandlers";

const QUIT_CLEANUP_TIMEOUT_MS = 2_000;
let quitCleanupStarted = false;

app.whenReady().then(() => {
  return (async () => {
    await registerIpcHandlers();
    createMainWindow();

    app.on("activate", () => {
      if (process.platform !== "darwin") return;
      const existing = BrowserWindow.getAllWindows()[0] ?? null;
      if (existing) {
        if (existing.isMinimized()) existing.restore();
        if (!existing.isVisible()) existing.show();
        existing.focus();
        return;
      }
      createMainWindow();
    });
  })();
});

app.on("before-quit", (event) => {
  if (quitCleanupStarted) return;
  event.preventDefault();
  quitCleanupStarted = true;

  void Promise.race([
    shutdownBackendRuntime().catch((error) => {
      console.error("[mytrader] failed to shutdown runtime cleanly", error);
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, QUIT_CLEANUP_TIMEOUT_MS);
    })
  ]).finally(() => {
    app.exit(0);
  });
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
  app.quit();
});
