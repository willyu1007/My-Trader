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
    listManualTags: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_MANUAL_TAGS_LIST, input ?? null),
    createManualTag: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_MANUAL_TAGS_CREATE, input),
    updateManualTag: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_MANUAL_TAGS_UPDATE, input),
    deleteManualTags: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_MANUAL_TAGS_DELETE, input),
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
    runIngestPreflight: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_PREFLIGHT_RUN, input ?? null),
    validateDataSourceReadiness: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_VALIDATE_SOURCE_READINESS, input ?? null),
    openProviderHomepage: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_PROVIDER_OPEN, input),
    listIngestRuns: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_RUNS_LIST, input ?? null),
    getIngestRunDetail: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_RUN_GET, input),
    removeIngestRun: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_RUN_REMOVE, input),
    clearIngestRuns: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_INGEST_RUNS_CLEAR),
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
    getRuntimePerfStats: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_RUNTIME_PERF_STATS_GET),
    getUniversePoolConfig: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_UNIVERSE_POOL_GET_CONFIG),
    setUniversePoolConfig: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_UNIVERSE_POOL_SET_CONFIG, input),
    getUniversePoolOverview: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_UNIVERSE_POOL_GET_OVERVIEW),
    getTargetTaskMatrixConfig: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TARGET_TASK_MATRIX_GET_CONFIG),
    setTargetTaskMatrixConfig: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TARGET_TASK_MATRIX_SET_CONFIG, input),
    previewTargetTaskCoverage: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TARGET_TASK_PREVIEW_COVERAGE),
    listTargetTaskStatus: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_TARGET_TASK_LIST_STATUS, input ?? null),
    runTargetMaterialization: (input) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.MARKET_TARGET_TASK_RUN_MATERIALIZATION,
        input ?? null
      ),
    getCompletenessConfig: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_COMPLETENESS_GET_CONFIG),
    setCompletenessConfig: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_COMPLETENESS_SET_CONFIG, input),
    previewCompletenessCoverage: (input) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.MARKET_COMPLETENESS_PREVIEW_COVERAGE,
        input ?? null
      ),
    listCompletenessStatus: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_COMPLETENESS_LIST_STATUS, input ?? null),
    runCompletenessMaterialization: (input) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.MARKET_COMPLETENESS_RUN_MATERIALIZATION,
        input ?? null
      ),
    getRolloutFlags: () =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_ROLLOUT_FLAGS_GET),
    setRolloutFlags: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.MARKET_ROLLOUT_FLAGS_SET, input),
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
  },
  insights: {
    listFacts: (input) => ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_FACT_LIST, input ?? null),
    createFact: (input) => ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_FACT_CREATE, input),
    removeFact: (input) => ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_FACT_DELETE, input),
    list: (input) => ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_LIST, input ?? null),
    get: (input) => ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_GET, input),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_CREATE, input),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_UPDATE, input),
    remove: (input) => ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_DELETE, input),
    search: (input) => ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_SEARCH, input),
    upsertScopeRule: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_SCOPE_UPSERT, input),
    removeScopeRule: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_SCOPE_DELETE, input),
    upsertEffectChannel: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_CHANNEL_UPSERT, input),
    removeEffectChannel: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_CHANNEL_DELETE, input),
    upsertEffectPoint: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_POINT_UPSERT, input),
    removeEffectPoint: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_POINT_DELETE, input),
    previewMaterializedTargets: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_MATERIALIZE_PREVIEW, input),
    excludeTarget: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_TARGET_EXCLUDE, input),
    unexcludeTarget: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_TARGET_UNEXCLUDE, input),
    listValuationMethods: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALUATION_METHOD_LIST, input ?? null),
    getValuationMethod: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALUATION_METHOD_GET, input),
    createCustomValuationMethod: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALUATION_METHOD_CREATE_CUSTOM, input),
    updateCustomValuationMethod: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALUATION_METHOD_UPDATE_CUSTOM, input),
    cloneBuiltinValuationMethod: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALUATION_METHOD_CLONE_BUILTIN, input),
    publishValuationMethodVersion: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALUATION_METHOD_PUBLISH_VERSION, input),
    setActiveValuationMethodVersion: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALUATION_METHOD_SET_ACTIVE_VERSION, input),
    previewValuationBySymbol: (input) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALUATION_PREVIEW_BY_SYMBOL, input)
  }
};

try {
  contextBridge.exposeInMainWorld("mytrader", api);
  console.log("[mytrader] preload 已注入 window.mytrader");
} catch (err) {
  console.error("[mytrader] preload 注入失败：", err);
  throw err;
}
