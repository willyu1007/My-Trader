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
      ipcRenderer.invoke(IPC_CHANNELS.PORTFOLIO_GET_SNAPSHOT, portfolioId),
    getPerformance: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.PORTFOLIO_GET_PERFORMANCE, input)
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
  ledger: {
    list: (portfolioId) => ipcRenderer.invoke(IPC_CHANNELS.LEDGER_LIST, portfolioId),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.LEDGER_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.LEDGER_UPDATE, input),
    remove: (ledgerEntryId) =>
      ipcRenderer.invoke(IPC_CHANNELS.LEDGER_REMOVE, ledgerEntryId)
  },
  market: {
    chooseCsvFile: (kind) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_CHOOSE_CSV_FILE, kind),
    importHoldingsCsv: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_IMPORT_HOLDINGS_CSV, input),
    importPricesCsv: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_IMPORT_PRICES_CSV, input),
    ingestTushare: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_TUSHARE, input),
    syncInstrumentCatalog: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_SYNC_INSTRUMENT_CATALOG),
    searchInstruments: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_SEARCH_INSTRUMENTS, input),
    getInstrumentProfile: (symbol) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_GET_INSTRUMENT_PROFILE, symbol),
    getTargets: () => ipcRenderer.invoke(IPC_CHANNELS.MARKET_GET_TARGETS),
    setTargets: (config) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_SET_TARGETS, config),
    previewTargets: () => ipcRenderer.invoke(IPC_CHANNELS.MARKET_PREVIEW_TARGETS),
    listWatchlist: () => ipcRenderer.invoke(IPC_CHANNELS.MARKET_WATCHLIST_LIST),
    upsertWatchlistItem: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_WATCHLIST_UPSERT, input),
    removeWatchlistItem: (symbol) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_WATCHLIST_REMOVE, symbol),
    listInstrumentTags: (symbol) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TAGS_LIST, symbol),
    addInstrumentTag: (symbol, tag) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TAGS_ADD, symbol, tag),
    removeInstrumentTag: (symbol, tag) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TAGS_REMOVE, symbol, tag),
    listTags: (input) => ipcRenderer.invoke(IPC_CHANNELS.MARKET_LIST_TAGS, input),
    getTagMembers: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_GET_TAG_MEMBERS, input),
    getTagSeries: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_GET_TAG_SERIES, input),
    getQuotes: (input) => ipcRenderer.invoke(IPC_CHANNELS.MARKET_GET_QUOTES, input),
    getDailyBars: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_GET_DAILY_BARS, input),
    seedDemoData: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_SEED_DEMO_DATA, input ?? null),
    getTokenStatus: () => ipcRenderer.invoke(IPC_CHANNELS.MARKET_TOKEN_GET_STATUS),
    setToken: (input) => ipcRenderer.invoke(IPC_CHANNELS.MARKET_TOKEN_SET, input),
    testToken: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TOKEN_TEST, input ?? null),
    getDataSourceCatalog: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_DATA_SOURCE_GET_CATALOG),
    getDataSourceConfig: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_DATA_SOURCE_GET_CONFIG),
    setDataSourceConfig: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_DATA_SOURCE_SET_CONFIG, input),
    getTokenMatrixStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TOKEN_GET_MATRIX_STATUS),
    setMainToken: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TOKEN_SET_MAIN, input),
    setDomainToken: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TOKEN_SET_DOMAIN, input),
    clearDomainToken: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TOKEN_CLEAR_DOMAIN, input),
    testDomainConnectivity: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TEST_DOMAIN_CONNECTIVITY, input),
    testModuleConnectivity: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TEST_MODULE_CONNECTIVITY, input),
    listConnectivityTests: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_LIST_CONNECTIVITY_TESTS),
    validateDataSourceReadiness: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_VALIDATE_SOURCE_READINESS, input ?? null),
    openProviderHomepage: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_PROVIDER_OPEN, input),
    listIngestRuns: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_RUNS_LIST, input ?? null),
    getIngestRunDetail: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_RUN_GET, input),
    triggerIngest: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_TRIGGER, input),
    getIngestControlStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_CONTROL_STATUS),
    pauseIngest: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_CONTROL_PAUSE),
    resumeIngest: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_CONTROL_RESUME),
    cancelIngest: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_CONTROL_CANCEL),
    getIngestSchedulerConfig: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_SCHEDULER_GET),
    setIngestSchedulerConfig: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_SCHEDULER_SET, input),
    getUniversePoolConfig: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_UNIVERSE_POOL_GET_CONFIG),
    setUniversePoolConfig: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_UNIVERSE_POOL_SET_CONFIG, input),
    getUniversePoolOverview: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_UNIVERSE_POOL_GET_OVERVIEW),
    listTempTargets: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TEMP_TARGETS_LIST),
    touchTempTarget: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TEMP_TARGETS_TOUCH, input),
    removeTempTarget: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TEMP_TARGETS_REMOVE, input),
    promoteTempTarget: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TEMP_TARGETS_PROMOTE, input),
    previewTargetsDraft: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TARGETS_PREVIEW_DRAFT, input),
    listInstrumentRegistry: (input) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.MARKET_INSTRUMENT_REGISTRY_LIST,
        input ?? null
      ),
    setInstrumentAutoIngest: (input) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.MARKET_INSTRUMENT_REGISTRY_SET_AUTO_INGEST,
        input
      ),
    batchSetInstrumentAutoIngest: (input) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.MARKET_INSTRUMENT_REGISTRY_BATCH_SET_AUTO_INGEST,
        input
      )
  }
};

try {
  contextBridge.exposeInMainWorld("mytrader", api);
  console.log("[mytrader] preload 已注入 window.mytrader");
} catch (err) {
  console.error("[mytrader] preload 注入失败：", err);
  throw err;
}
