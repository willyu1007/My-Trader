import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS } from "@mytrader/shared";

import type { MyTraderApi } from "@mytrader/shared";

const api: MyTraderApi = {
  account: {
    getActive: () => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_GET_ACTIVE),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_LIST),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_CREATE, input),
    unlock: (input) => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_UNLOCK, input),
    lock: () => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_LOCK),
    chooseDataRootDir: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ACCOUNT_CHOOSE_DATA_ROOT_DIR)
  },
  portfolio: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PORTFOLIO_LIST),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.PORTFOLIO_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.PORTFOLIO_UPDATE, input),
    remove: (portfolioId) =>
      ipcRenderer.invoke(IPC_CHANNELS.PORTFOLIO_REMOVE, portfolioId),
    getSnapshot: (portfolioId) =>
      ipcRenderer.invoke(IPC_CHANNELS.PORTFOLIO_GET_SNAPSHOT, portfolioId)
  },
  position: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.POSITION_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.POSITION_UPDATE, input),
    remove: (positionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.POSITION_REMOVE, positionId)
  },
  risk: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.RISK_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.RISK_UPDATE, input),
    remove: (riskLimitId) =>
      ipcRenderer.invoke(IPC_CHANNELS.RISK_REMOVE, riskLimitId)
  },
  market: {
    chooseCsvFile: (kind) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_CHOOSE_CSV_FILE, kind),
    importHoldingsCsv: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_IMPORT_HOLDINGS_CSV, input),
    importPricesCsv: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_IMPORT_PRICES_CSV, input),
    ingestTushare: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_TUSHARE, input)
  }
};

try {
  contextBridge.exposeInMainWorld("mytrader", api);
  console.log("[mytrader] preload 已注入 window.mytrader");
} catch (err) {
  console.error("[mytrader] preload 注入失败：", err);
  throw err;
}
