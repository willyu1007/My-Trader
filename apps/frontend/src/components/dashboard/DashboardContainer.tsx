import {
  useState
} from "react";

import type {
  LedgerEntry,
  PerformanceRangeKey,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioSnapshot
} from "@mytrader/shared";
import {
  DEFAULT_LEDGER_END_DATE,
  DEFAULT_LEDGER_START_DATE,
  MARKET_EXPLORER_DEFAULT_WIDTH,
  MARKET_EXPLORER_MAX_WIDTH,
  MARKET_EXPLORER_MIN_WIDTH,
  MARKET_EXPLORER_WIDTH_STORAGE_KEY,
  TARGET_POOL_STRUCTURE_EMPTY,
  TARGETS_EDITOR_SPLIT_DEFAULT,
  TARGETS_EDITOR_SPLIT_MAX,
  TARGETS_EDITOR_SPLIT_MIN,
  TARGETS_EDITOR_SPLIT_STORAGE_KEY,
  UNIVERSE_POOL_BUCKET_ORDER,
  emptyPositionForm,
  emptyRiskForm,
  schedulerTimezoneDefaults
} from "./constants";
import type {
  DashboardProps,
  LedgerFilter,
  LedgerFormState,
  MarketChartRangeKey,
  MarketFilterMarket,
  MarketScope,
  PositionFormState,
  PortfolioTab,
  RiskFormState,
  TargetPoolStatsScope,
  TargetPoolStructureStats
} from "./types";
import {
  clampNumber,
  formatPct,
  toUserErrorMessage,
  formatInputDate,
  resolveMarketChartDateRange,
  createEmptyLedgerForm
} from "./shared";
import { DashboardContainerLayout } from "./views/DashboardContainerLayout";
import { useDashboardAnalysis } from "./hooks/use-dashboard-analysis";
import { useDashboardAnalysisDerived } from "./hooks/use-dashboard-analysis-derived";
import { useDashboardAnalysisRuntime } from "./hooks/use-dashboard-analysis-runtime";
import { useDashboardMarket } from "./hooks/use-dashboard-market";
import { useDashboardMarketDerived } from "./hooks/use-dashboard-market-derived";
import { useDashboardMarketAdminDerived } from "./hooks/use-dashboard-market-admin-derived";
import { useDashboardMarketTargetPoolDetail } from "./hooks/use-dashboard-market-target-pool-detail";
import { useDashboardMarketResize } from "./hooks/use-dashboard-market-resize";
import { useDashboardMarketOrchestration } from "./hooks/use-dashboard-market-orchestration";
import { useDashboardPortfolioActions } from "./hooks/use-dashboard-portfolio-actions";
import { useDashboardLedgerActions } from "./hooks/use-dashboard-ledger-actions";
import { useDashboardPortfolioDerived } from "./hooks/use-dashboard-portfolio-derived";
import { useDashboardPortfolioRuntime } from "./hooks/use-dashboard-portfolio-runtime";
import { useDashboardPortfolioState } from "./hooks/use-dashboard-portfolio-state";
import { useDashboardUiEffects } from "./hooks/use-dashboard-ui-effects";
import { useDashboardUi } from "./hooks/use-dashboard-ui";

export function Dashboard({ account, onLock, onActivePortfolioChange }: DashboardProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {
    error,
    setError,
    notice,
    setNotice,
    activeView,
    setActiveView,
    otherTab,
    setOtherTab,
    analysisTab,
    setAnalysisTab,
    isNavCollapsed,
    setIsNavCollapsed
  } = useDashboardUi();
  const analysisState = useDashboardAnalysis<MarketChartRangeKey>({
    defaultInstrumentRange: "6M"
  });
  const {
    analysisInstrumentQuery,
    analysisInstrumentSearchResults,
    setAnalysisInstrumentSearchResults,
    setAnalysisInstrumentSearchLoading,
    analysisInstrumentSymbol,
    setAnalysisInstrumentSymbol,
    analysisInstrumentRange,
    analysisInstrumentProfile,
    setAnalysisInstrumentProfile,
    analysisInstrumentUserTags,
    setAnalysisInstrumentUserTags,
    analysisInstrumentQuote,
    setAnalysisInstrumentQuote,
    analysisInstrumentBars,
    setAnalysisInstrumentBars,
    setAnalysisInstrumentLoading,
    setAnalysisInstrumentError
  } = analysisState;
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("overview");
  const [performanceRange, setPerformanceRange] = useState<PerformanceRangeKey>(
    "1Y"
  );
  const [performanceResult, setPerformanceResult] =
    useState<PortfolioPerformanceRangeResult | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [showAllSymbolContribution, setShowAllSymbolContribution] =
    useState(false);
  const [showAllAssetContribution, setShowAllAssetContribution] =
    useState(false);
  const [riskAnnualized, setRiskAnnualized] = useState(true);

  const marketState = useDashboardMarket({
    clampNumber,
    defaultMarketScope: "holdings" as MarketScope,
    defaultMarketFilterMarket: "all" as MarketFilterMarket,
    defaultMarketChartRange: "6M" as MarketChartRangeKey,
    defaultTokenProvider: "tushare",
    marketExplorerDefaultWidth: MARKET_EXPLORER_DEFAULT_WIDTH,
    marketExplorerMinWidth: MARKET_EXPLORER_MIN_WIDTH,
    marketExplorerMaxWidth: MARKET_EXPLORER_MAX_WIDTH,
    marketExplorerStorageKey: MARKET_EXPLORER_WIDTH_STORAGE_KEY,
    targetsEditorSplitDefault: TARGETS_EDITOR_SPLIT_DEFAULT,
    targetsEditorSplitMin: TARGETS_EDITOR_SPLIT_MIN,
    targetsEditorSplitMax: TARGETS_EDITOR_SPLIT_MAX,
    targetsEditorSplitStorageKey: TARGETS_EDITOR_SPLIT_STORAGE_KEY,
    defaultTargetsConfig: {
      includeHoldings: true,
      includeRegistryAutoIngest: false,
      includeWatchlist: true,
      portfolioIds: null,
      explicitSymbols: [],
      tagFilters: []
    },
    defaultManualSymbolPreview: {
      addable: [],
      existing: [],
      invalid: [],
      duplicates: 0
    },
    defaultTargetsSectionOpen: {
      scope: true,
      symbols: true
    },
    defaultDiffSectionOpen: {
      added: false,
      removed: false,
      reasonChanged: false
    },
    defaultTargetPoolStatsScope: "focus" as TargetPoolStatsScope,
    defaultTargetPoolStatsByScope: {
      universe: { ...TARGET_POOL_STRUCTURE_EMPTY },
      focus: { ...TARGET_POOL_STRUCTURE_EMPTY }
    } as Record<TargetPoolStatsScope, TargetPoolStructureStats>,
    defaultRegistryAutoFilter: "all",
    activeView,
    snapshotPriceAsOf: snapshot?.priceAsOf ?? null,
    toUserErrorMessage,
    reportError: (message) => setError(message),
    resolveMarketChartDateRange,
    formatInputDate
  });
  const {
    marketSearchQuery,
    marketSearchResults,
    marketScope,
    marketExplorerWidth,
    setMarketExplorerWidth,
    targetsEditorLeftPct,
    setTargetsEditorLeftPct,
    marketSelectedTag,
    marketTagMembers,
    marketFilterMarket,
    marketFilterAssetClasses,
    marketFilterKinds,
    marketQuotesBySymbol,
    marketChartBars,
    marketTagSeriesResult,
    marketTagSeriesBars,
    setMarketInstrumentDetailsOpen,
    setMarketTagMembersModalOpen,
    marketTokenStatus,
    marketIngestRuns,
    marketSelectedSymbol,
    marketSelectedProfile,
    marketSelectedUserTags,
    marketWatchlistItems,
    marketTargetsConfig,
    marketTargetsSavedConfig,
    marketTargetsPreview,
    marketTargetsDiffPreview,
    marketCurrentTargetsFilter,
    marketTargetPoolDetailMetric,
    marketTargetPoolDetailCategoryKey,
    setMarketTargetPoolDetailCategoryKey,
    marketTargetPoolDetailMemberFilter,
    setMarketTargetPoolDetailMemberFilter,
    setMarketTargetsSectionOpen,
    setMarketDiffSectionOpen,
    marketTargetPoolStatsScope,
    marketTargetPoolStatsByScope,
    marketIngestControlStatus,
    marketIngestControlUpdating,
    marketSchedulerConfig,
    marketSchedulerSavedConfig,
    marketUniversePoolConfig,
    marketUniversePoolSavedConfig,
    marketUniversePoolOverview,
    marketChartHoverDate
  } = marketState;
  const {
    targetsEditorGridRef,
    handleMarketExplorerResizePointerDown,
    handleMarketExplorerResizeKeyDown,
    handleTargetsEditorResizePointerDown,
    handleTargetsEditorResizeKeyDown
  } = useDashboardMarketResize({
    clampNumber,
    marketExplorerWidth,
    marketExplorerMinWidth: MARKET_EXPLORER_MIN_WIDTH,
    marketExplorerMaxWidth: MARKET_EXPLORER_MAX_WIDTH,
    targetsEditorLeftPct,
    targetsEditorSplitMin: TARGETS_EDITOR_SPLIT_MIN,
    targetsEditorSplitMax: TARGETS_EDITOR_SPLIT_MAX,
    setMarketExplorerWidth,
    setTargetsEditorLeftPct
  });

  const marketAdminDerived = useDashboardMarketAdminDerived({
    marketIngestRuns,
    marketSelectedProfile,
    marketSelectedUserTags,
    marketTargetsSavedConfig,
    marketTargetsConfig,
    marketSchedulerConfig,
    marketSchedulerSavedConfig,
    marketUniversePoolConfig,
    marketUniversePoolSavedConfig,
    marketIngestControlStatus,
    marketIngestControlUpdating,
    marketTokenStatus,
    schedulerTimezoneDefaults,
    marketTargetsDiffPreview,
    marketTargetsPreview,
    marketCurrentTargetsFilter,
    marketTargetPoolStatsByScope,
    marketTargetPoolStatsScope,
    marketUniversePoolOverview,
    universePoolBucketOrder: UNIVERSE_POOL_BUCKET_ORDER
  });

  const marketTargetPoolDetail = useDashboardMarketTargetPoolDetail({
    marketTargetPoolStatsScope,
    marketActiveTargetPoolStats: marketAdminDerived.marketActiveTargetPoolStats,
    marketTargetPoolDetailMetric,
    marketTargetPoolDetailCategoryKey,
    marketTargetPoolDetailMemberFilter,
    formatPct,
    setMarketTargetPoolDetailCategoryKey,
    setMarketTargetPoolDetailMemberFilter,
    setMarketTargetsSectionOpen,
    setMarketDiffSectionOpen
  });

  const { activePortfolio, portfolioState } = useDashboardPortfolioState<
    PositionFormState,
    RiskFormState,
    LedgerFormState,
    LedgerEntry,
    LedgerFilter
  >({
    portfolios,
    activePortfolioId,
    onActivePortfolioChange,
    emptyPositionForm,
    emptyRiskForm,
    createEmptyLedgerForm,
    defaultBaseCurrency: "CNY",
    defaultLedgerFilter: "all",
    defaultLedgerStartDate: DEFAULT_LEDGER_START_DATE,
    defaultLedgerEndDate: DEFAULT_LEDGER_END_DATE
  });
  const {
    portfolioName,
    setPortfolioName,
    portfolioBaseCurrency,
    setPortfolioBaseCurrency,
    portfolioRename,
    setPortfolioRename,
    positionForm,
    setPositionForm,
    riskForm,
    setRiskForm,
    ledgerEntries,
    setLedgerEntries,
    setLedgerLoading,
    setLedgerError,
    ledgerFilter,
    ledgerStartDate,
    ledgerEndDate,
    ledgerForm,
    setLedgerForm,
    setIsLedgerFormOpen,
    ledgerDeleteTarget,
    setLedgerDeleteTarget,
    holdingsCsvPath,
    setHoldingsCsvPath,
    pricesCsvPath,
    setPricesCsvPath
  } = portfolioState;

  const {
    loadPortfolios,
    loadSnapshot,
    loadLedgerEntries,
    loadPerformance
  } = useDashboardPortfolioRuntime({
    activePortfolioId,
    activeView,
    analysisTab,
    portfolioTab,
    performanceRange,
    toUserErrorMessage,
    setError,
    setIsLoading,
    setPortfolios,
    setActivePortfolioId,
    setPortfolioRename,
    setSnapshot,
    setLedgerEntries,
    setLedgerLoading,
    setLedgerError,
    setPerformanceLoading,
    setPerformanceError,
    setPerformanceResult
  });

  const marketDerived = useDashboardMarketDerived({
    snapshot,
    marketFilterMarket,
    marketFilterAssetClasses,
    marketFilterKinds,
    marketSelectedSymbol,
    marketQuotesBySymbol,
    marketChartBars,
    marketChartHoverDate,
    marketWatchlistItems,
    marketSearchResults,
    marketSelectedProfile,
    marketSearchQuery,
    marketScope,
    marketSelectedTag,
    marketTagMembers,
    marketTagSeriesBars,
    marketTagSeriesResult,
    marketSelectedUserTags,
    ledgerEntries
  });

  const analysisDerived = useDashboardAnalysisDerived({
    snapshot,
    marketWatchlistItems,
    analysisInstrumentSearchResults,
    analysisInstrumentProfile,
    analysisInstrumentBars,
    analysisInstrumentSymbol,
    ledgerEntries,
    analysisInstrumentUserTags,
    analysisInstrumentQuote
  });

  const { loadAnalysisInstrument } = useDashboardAnalysisRuntime({
    activeView,
    analysisTab,
    analysisInstrumentQuery,
    analysisInstrumentSymbol,
    analysisInstrumentRange,
    analysisInstrumentQuickSymbols: analysisDerived.analysisInstrumentQuickSymbols,
    snapshotPriceAsOf: snapshot?.priceAsOf,
    toUserErrorMessage,
    resolveMarketChartDateRange,
    formatInputDate,
    setAnalysisInstrumentSearchResults,
    setAnalysisInstrumentSearchLoading,
    setAnalysisInstrumentSymbol,
    setAnalysisInstrumentLoading,
    setAnalysisInstrumentError,
    setAnalysisInstrumentProfile,
    setAnalysisInstrumentUserTags,
    setAnalysisInstrumentQuote,
    setAnalysisInstrumentBars
  });

  const portfolioDerived = useDashboardPortfolioDerived({
    snapshot,
    performanceResult,
    ledgerEntries,
    ledgerFilter,
    ledgerStartDate,
    ledgerEndDate,
    ledgerDeleteTarget,
    error,
    notice
  });

  useDashboardUiEffects({
    activeView,
    activePortfolioId,
    performanceRange,
    error,
    notice,
    setMarketInstrumentDetailsOpen,
    setMarketTagMembersModalOpen,
    setPortfolioTab,
    setShowAllSymbolContribution,
    setShowAllAssetContribution,
    setError,
    setNotice
  });

  const portfolioActions = useDashboardPortfolioActions({
    activePortfolio,
    portfolioName,
    portfolioBaseCurrency,
    portfolioRename,
    positionForm,
    riskForm,
    emptyPositionForm,
    emptyRiskForm,
    loadPortfolios,
    loadSnapshot,
    setError,
    setNotice,
    setPortfolioName,
    setPortfolioBaseCurrency,
    setPositionForm,
    setRiskForm
  });

  const ledgerActions = useDashboardLedgerActions({
    activePortfolio,
    ledgerForm,
    ledgerDeleteTarget,
    holdingsCsvPath,
    pricesCsvPath,
    toUserErrorMessage,
    loadLedgerEntries,
    loadSnapshot,
    setError,
    setNotice,
    setLedgerForm,
    setIsLedgerFormOpen,
    setLedgerDeleteTarget,
    setHoldingsCsvPath,
    setPricesCsvPath
  });

  const marketOrchestration = useDashboardMarketOrchestration({
    activeView,
    otherTab,
    analysisTab,
    activePortfolioId,
    marketState,
    marketEffectiveScope: marketDerived.marketEffectiveScope,
    marketHoldingsSymbolsFiltered: marketDerived.marketHoldingsSymbolsFiltered,
    marketSearchResultSymbols: marketDerived.marketSearchResultSymbols,
    marketFocusTargetSymbols: marketAdminDerived.marketFocusTargetSymbols,
    marketTargetsDirty: marketAdminDerived.marketTargetsDirty,
    marketIngestControlState: marketAdminDerived.marketIngestControlState,
    marketRegistryEntryEnabled: marketAdminDerived.marketRegistryEntryEnabled,
    toUserErrorMessage,
    loadSnapshot,
    setError,
    setNotice,
    setActiveView,
    setOtherTab,
    universePoolBucketOrder: UNIVERSE_POOL_BUCKET_ORDER
  });

  return (
    <DashboardContainerLayout
      account={account}
      onLock={onLock}
      activeView={activeView}
      setActiveView={setActiveView}
      isNavCollapsed={isNavCollapsed}
      setIsNavCollapsed={setIsNavCollapsed}
      otherTab={otherTab}
      setOtherTab={setOtherTab}
      analysisTab={analysisTab}
      setAnalysisTab={setAnalysisTab}
      portfolioTab={portfolioTab}
      setPortfolioTab={setPortfolioTab}
      snapshot={snapshot}
      activePortfolio={activePortfolio}
      activePortfolioId={activePortfolioId}
      setActivePortfolioId={setActivePortfolioId}
      portfolios={portfolios}
      isLoading={isLoading}
      error={error}
      notice={notice}
      setError={setError}
      setNotice={setNotice}
      performanceRange={performanceRange}
      setPerformanceRange={setPerformanceRange}
      performanceLoading={performanceLoading}
      performanceError={performanceError}
      setPerformanceError={setPerformanceError}
      performanceResult={performanceResult}
      riskAnnualized={riskAnnualized}
      setRiskAnnualized={setRiskAnnualized}
      showAllSymbolContribution={showAllSymbolContribution}
      setShowAllSymbolContribution={setShowAllSymbolContribution}
      showAllAssetContribution={showAllAssetContribution}
      setShowAllAssetContribution={setShowAllAssetContribution}
      portfolioState={portfolioState}
      analysisState={analysisState}
      marketState={marketState}
      marketAdminDerived={marketAdminDerived}
      marketTargetPoolDetail={marketTargetPoolDetail}
      marketDerived={marketDerived}
      analysisDerived={analysisDerived}
      portfolioDerived={portfolioDerived}
      portfolioActions={portfolioActions}
      ledgerActions={ledgerActions}
      marketOrchestration={marketOrchestration}
      loadLedgerEntries={loadLedgerEntries}
      loadPerformance={loadPerformance}
      loadAnalysisInstrument={loadAnalysisInstrument}
      targetsEditorGridRef={targetsEditorGridRef}
      handleMarketExplorerResizePointerDown={handleMarketExplorerResizePointerDown}
      handleMarketExplorerResizeKeyDown={handleMarketExplorerResizeKeyDown}
      handleTargetsEditorResizePointerDown={handleTargetsEditorResizePointerDown}
      handleTargetsEditorResizeKeyDown={handleTargetsEditorResizeKeyDown}
    />
  );
}
