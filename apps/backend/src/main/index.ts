import { BrowserWindow, app } from "electron";

import { createMainWindow } from "./createMainWindow";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";

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

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
  app.quit();
});
