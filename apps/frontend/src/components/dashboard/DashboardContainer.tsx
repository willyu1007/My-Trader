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
  CONTRIBUTION_TOP_N,
  DEFAULT_LEDGER_END_DATE,
  DEFAULT_LEDGER_START_DATE,
  HHI_WARN_THRESHOLD,
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
  analysisTabs,
  assetClassLabels,
  emptyPositionForm,
  emptyRiskForm,
  ledgerEventTypeOptions,
  marketChartRanges,
  navItems,
  otherTabs,
  performanceRanges,
  portfolioTabs,
  riskLimitTypeLabels,
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
  TargetPoolStructureStats,
  WorkspaceView
} from "./types";
import {
  Panel,
  PlaceholderPanel,
  Modal,
  FormGroup,
  Input,
  Select,
  PopoverSelect,
  Button,
  IconButton,
  Badge,
  MarketQuoteHeader,
  ChartErrorBoundary,
  MarketAreaChart,
  MarketVolumeMiniChart,
  SummaryCard,
  EmptyState,
  ErrorState,
  HelpHint,
  ConfirmDialog,
  LedgerTable,
  LedgerForm,
  DataQualityCard,
  clampNumber,
  formatNumber,
  formatCnWanYiNullable,
  formatSignedCnWanYiNullable,
  formatCurrency,
  formatPct,
  formatPctNullable,
  formatSignedPctNullable,
  getCnChangeTone,
  getCnToneTextClass,
  formatPerformanceMethod,
  formatDateRange,
  sortTagMembersByChangePct,
  formatAssetClassLabel,
  formatRiskLimitTypeLabel,
  formatDateTime,
  formatDurationMs,
  formatMarketTokenSource,
  formatTagSourceLabel,
  formatIngestRunStatusLabel,
  formatIngestRunScopeLabel,
  formatIngestRunModeLabel,
  formatTargetsReasons,
  formatIngestRunTone,
  formatIngestControlStateLabel,
  getIngestControlStateDotClass,
  getUniversePoolBucketLabel,
  toUserErrorMessage,
  formatInputDate,
  formatCnDate,
  formatThemeLabel,
  resolveMarketChartDateRange,
  createEmptyLedgerForm,
  DescriptionItem,
  PerformanceChart,
  ContributionTable,
  RiskMetricCard
} from "./shared";
import { AccountView } from "./views/AccountView";
import { DataAnalysisView } from "./views/DataAnalysisView";
import { DashboardOverlays } from "./views/DashboardOverlays";
import { MarketView } from "./views/MarketView";
import { OtherView } from "./views/OtherView";
import { PortfolioView } from "./views/PortfolioView";
import { RiskView } from "./views/RiskView";
import { SidebarNav } from "./views/SidebarNav";
import { TopToolbar } from "./views/TopToolbar";
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

  const {
    latestMarketIngestRun,
    marketSelectedIndustry,
    marketSelectedThemes,
    marketSelectedManualThemes,
    marketSelectedPlainUserTags,
    marketTargetsDirty,
    marketSchedulerDirty,
    marketUniversePoolDirty,
    marketIngestControlState,
    marketCanTriggerIngestNow,
    marketCanPauseIngest,
    marketCanResumeIngest,
    marketCanCancelIngest,
    marketSchedulerTimezoneOptions,
    marketRegistryEntryEnabled,
    marketCurrentTargetsSource,
    marketFilteredCurrentTargets,
    marketFilteredAddedSymbols,
    marketFilteredRemovedSymbols,
    marketFilteredReasonChangedSymbols,
    marketFocusTargetSymbols,
    marketActiveTargetPoolStats,
    marketUniverseEnabledBuckets,
    marketUniverseBucketStatusById
  } = useDashboardMarketAdminDerived({
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

  const {
    marketTargetPoolMetricCards,
    marketTargetPoolDetailTitle,
    marketTargetPoolDetailValue,
    marketTargetPoolDetailDescription,
    marketTargetPoolDetailCategoryRows,
    marketTargetPoolActiveCategoryRow,
    marketTargetPoolDetailMembers,
    handleToggleTargetsSection,
    handleToggleDiffSection
  } = useDashboardMarketTargetPoolDetail({
    marketTargetPoolStatsScope,
    marketActiveTargetPoolStats,
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

  const {
    marketHoldingsSymbols,
    marketHoldingsSymbolsFiltered,
    marketSelectedQuote,
    marketActiveVolume,
    marketActiveMoneyflowVol,
    marketActiveMoneyflowRatio,
    marketNameBySymbol,
    marketEffectiveScope,
    marketCollectionSelectValue,
    marketSearchResultsFiltered,
    marketSearchResultSymbols,
    marketFilteredListSymbols,
    marketSelectedTagAggregate,
    marketSelectedTagSeriesReturnPct,
    marketSelectedTagSeriesTone,
    marketTagSeriesLatestCoverageLabel,
    marketFiltersActiveCount,
    marketLatestBar,
    marketChartHasEnoughData,
    marketRangeSummary,
    marketHoldingUnitCost,
    marketTargetPrice
  } = useDashboardMarketDerived({
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

  const {
    analysisInstrumentNameBySymbol,
    analysisInstrumentQuickSymbols,
    analysisInstrumentLatestBar,
    analysisInstrumentHasEnoughData,
    analysisInstrumentRangeSummary,
    analysisInstrumentPositionValuation,
    analysisInstrumentHoldingUnitCost,
    analysisInstrumentTargetPrice,
    analysisInstrumentTone
  } = useDashboardAnalysisDerived({
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
    analysisInstrumentQuickSymbols,
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

  const {
    cashTotal,
    performance,
    performanceSeries,
    contributionBreakdown,
    riskMetrics,
    dataQuality,
    hhiValue,
    filteredLedgerEntries,
    cashFlowTotals,
    ledgerDeleteSummary,
    toastMessage,
    selectedPerformance
  } = useDashboardPortfolioDerived({
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

  const {
    handleCreatePortfolio,
    handleRenamePortfolio,
    handleDeletePortfolio,
    handleEditPosition,
    handleCancelEditPosition,
    handleSubmitPosition,
    handleDeletePosition,
    handleEditRiskLimit,
    handleCancelRiskEdit,
    handleSubmitRiskLimit,
    handleDeleteRiskLimit
  } = useDashboardPortfolioActions({
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

  const {
    updateLedgerForm,
    handleOpenLedgerForm,
    handleEditLedgerEntry,
    handleCancelLedgerEdit,
    handleSubmitLedgerEntry,
    handleRequestDeleteLedgerEntry,
    handleConfirmDeleteLedgerEntry,
    handleCancelDeleteLedgerEntry,
    handleChooseCsv,
    handleImportHoldings,
    handleImportPrices
  } = useDashboardLedgerActions({
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

  const {
    refreshMarketTags,
    resetMarketFilters,
    refreshMarketTargets,
    refreshMarketTargetsDiff,
    refreshMarketIngestRuns,
    refreshMarketRegistry,
    refreshMarketIngestRunDetail,
    handleOpenMarketProvider,
    handleSaveMarketToken,
    handleClearMarketToken,
    handleTestMarketToken,
    handleToggleUniversePoolBucket,
    handleSaveUniversePoolConfig,
    handleTriggerMarketIngest,
    handleSyncInstrumentCatalog,
    handleSelectInstrument,
    handleSelectTag,
    handleSeedMarketDemoData,
    handleAddUserTag,
    handleRemoveUserTag,
    handleAddManualTheme,
    handleAddSelectedToWatchlist,
    handleRemoveWatchlistItem,
    handleAddTargetTag,
    handlePreviewManualTargetSymbols,
    handleApplyManualTargetSymbols,
    handleRemoveManualPreviewSymbol,
    handleRemoveTempTarget,
    handlePromoteTempTarget,
    handleSaveTargets,
    handleResetTargetsDraft,
    handleToggleTempTargetSelection,
    handleSelectAllTempTargets,
    handleBatchPromoteTempTargets,
    handleBatchRemoveTempTargets,
    handleBatchExtendTempTargets,
    handlePauseMarketIngest,
    handleResumeMarketIngest,
    handleCancelMarketIngest,
    updateMarketSchedulerConfig,
    handleSaveMarketSchedulerConfig,
    handleRunMarketIngestNow,
    handleToggleRegistrySymbol,
    handleToggleSelectAllRegistry,
    handleSetRegistryAutoIngest,
    handleBatchSetRegistryAutoIngest
  } = useDashboardMarketOrchestration({
    activeView,
    otherTab,
    analysisTab,
    activePortfolioId,
    marketState,
    marketEffectiveScope,
    marketHoldingsSymbolsFiltered,
    marketSearchResultSymbols,
    marketFocusTargetSymbols,
    marketTargetsDirty,
    marketIngestControlState,
    marketRegistryEntryEnabled,
    toUserErrorMessage,
    loadSnapshot,
    setError,
    setNotice,
    setActiveView,
    setOtherTab,
    universePoolBucketOrder: UNIVERSE_POOL_BUCKET_ORDER
  });

  return (
    <div className="flex h-full bg-white/90 dark:bg-background-dark/80 backdrop-blur-xl overflow-hidden">
      <SidebarNav
        activeView={activeView}
        isNavCollapsed={isNavCollapsed}
        items={navItems}
        onSelectView={(view) => setActiveView(view as WorkspaceView)}
        onToggleCollapse={() => setIsNavCollapsed((prev) => !prev)}
      />

      {/* Main Content */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white/85 dark:bg-background-dark/70 backdrop-blur-lg">
        <TopToolbar
          activeView={activeView}
          otherTab={otherTab}
          navItems={navItems}
          marketPriceAsOf={snapshot?.priceAsOf ?? null}
          onLock={onLock}
        />

        {activeView === "portfolio" && (
          <div className="border-b border-border-light dark:border-border-dark bg-white/90 dark:bg-background-dark/75">
            <div className="flex items-center gap-0 overflow-x-auto px-3">
              {portfolioTabs.map((tab) => {
                const isActive = portfolioTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
	                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
	                      isActive
	                        ? "text-slate-900 dark:text-white border-primary bg-slate-100 dark:bg-surface-dark"
	                        : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-background-dark/80"
	                    }`}
                    onClick={() => setPortfolioTab(tab.key)}
                  >
                    <span className="material-icons-outlined text-base">{tab.icon}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={`flex-1 p-0 scroll-smooth ${
            activeView === "market" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          
          {/* View: Account */}
          {activeView === "account" && (
            <AccountView account={account} formatDateTime={formatDateTime} />
          )}

          {/* View: Portfolio */}
          {activeView === "portfolio" && (
            <PortfolioView
              {...{
                Badge,
                Button,
                DataQualityCard,
                DescriptionItem,
                EmptyState,
                ErrorState,
                FormGroup,
                HHI_WARN_THRESHOLD,
                IconButton,
                Input,
                LedgerForm,
                LedgerTable,
                Panel,
                PerformanceChart,
                PlaceholderPanel,
                RiskMetricCard,
                Select,
                SummaryCard,
                ...portfolioState,
                activePortfolio,
                activePortfolioId,
                assetClassLabels,
                cashFlowTotals,
                cashTotal,
                dataQuality,
                filteredLedgerEntries,
                formatAssetClassLabel,
                formatCurrency,
                formatDateRange,
                formatNumber,
                formatPct,
                formatPctNullable,
                formatPerformanceMethod,
                handleCancelEditPosition,
                handleCancelLedgerEdit,
                handleCreatePortfolio,
                handleDeletePortfolio,
                handleDeletePosition,
                handleEditLedgerEntry,
                handleEditPosition,
                handleOpenLedgerForm,
                handleRenamePortfolio,
                handleRequestDeleteLedgerEntry,
                handleSubmitLedgerEntry,
                handleSubmitPosition,
                hhiValue,
                isLoading,
                ledgerEventTypeOptions,
                loadLedgerEntries,
                loadPerformance,
                performanceError,
                performanceLoading,
                performance,
                performanceRange,
                performanceRanges,
                performanceResult,
                performanceSeries,
                portfolioTab,
                portfolioTabs,
                portfolios,
                riskAnnualized,
                riskMetrics,
                selectedPerformance,
                setActivePortfolioId,
                setActiveView,
                setAnalysisTab,
                setOtherTab,
                setPerformanceError,
                setPerformanceRange,
                setRiskAnnualized,
                snapshot,
                toUserErrorMessage,
                updateLedgerForm,
              }}
            />
          )}

          {/* View: Risk */}
          {activeView === "risk" && (
            <RiskView
              snapshot={snapshot}
              formatAssetClassLabel={formatAssetClassLabel}
              formatPct={formatPct}
              formatCurrency={formatCurrency}
              formatRiskLimitTypeLabel={formatRiskLimitTypeLabel}
              handleEditRiskLimit={handleEditRiskLimit}
              handleDeleteRiskLimit={handleDeleteRiskLimit}
              riskForm={riskForm}
              setRiskForm={setRiskForm}
              riskLimitTypeLabels={riskLimitTypeLabels}
              handleSubmitRiskLimit={handleSubmitRiskLimit}
              handleCancelRiskEdit={handleCancelRiskEdit}
            />
          )}

          {/* View: Data Analysis */}
          {activeView === "data-analysis" && (
            <DataAnalysisView
              {...{
                Badge,
                CONTRIBUTION_TOP_N,
                ChartErrorBoundary,
                ContributionTable,
                EmptyState,
                ErrorState,
                Input,
                MarketAreaChart,
                Panel,
                PerformanceChart,
                PlaceholderPanel,
                RiskMetricCard,
                SummaryCard,
                ...analysisState,
                activePortfolio,
                activePortfolioId,
                analysisInstrumentHasEnoughData,
                analysisInstrumentHoldingUnitCost,
                analysisInstrumentLatestBar,
                analysisInstrumentNameBySymbol,
                analysisInstrumentPositionValuation,
                analysisInstrumentQuickSymbols,
                analysisInstrumentRangeSummary,
                analysisInstrumentTargetPrice,
                analysisInstrumentTone,
                analysisTab,
                analysisTabs,
                contributionBreakdown,
                formatCnWanYiNullable,
                formatDateRange,
                formatNumber,
                formatPctNullable,
                formatPerformanceMethod,
                formatSignedPctNullable,
                loadAnalysisInstrument,
                loadPerformance,
                marketChartRanges,
                performanceError,
                performanceLoading,
                performance,
                performanceRange,
                performanceRanges,
                performanceResult,
                performanceSeries,
                riskAnnualized,
                riskMetrics,
                selectedPerformance,
                setAnalysisTab,
                setPerformanceError,
                setPerformanceRange,
                setRiskAnnualized,
                setShowAllAssetContribution,
                setShowAllSymbolContribution,
                showAllAssetContribution,
                showAllSymbolContribution,
                toUserErrorMessage
              }}
            />
          )}

          {/* View: Market */}
          {activeView === "market" && (
            <MarketView
              {...{
                ...marketState,
                Button,
                ChartErrorBoundary,
                FormGroup,
                IconButton,
                Input,
                MarketAreaChart,
                MarketQuoteHeader,
                MarketVolumeMiniChart,
                Modal,
                PopoverSelect,
                formatCnDate,
                formatCnWanYiNullable,
                formatNumber,
                formatSignedCnWanYiNullable,
                formatSignedPctNullable,
                formatThemeLabel,
                getCnChangeTone,
                getCnToneTextClass,
                handleAddManualTheme,
                handleAddSelectedToWatchlist,
                handleAddTargetTag,
                handleAddUserTag,
                handleMarketExplorerResizeKeyDown,
                handleMarketExplorerResizePointerDown,
                handleRemoveUserTag,
                handleRemoveWatchlistItem,
                handleSelectInstrument,
                handleSelectTag,
                handleSyncInstrumentCatalog,
                marketActiveMoneyflowRatio,
                marketActiveMoneyflowVol,
                marketActiveVolume,
                marketChartHasEnoughData,
                marketChartRanges,
                marketCollectionSelectValue,
                marketEffectiveScope,
                marketFilteredListSymbols,
                marketFiltersActiveCount,
                marketHoldingUnitCost,
                marketHoldingsSymbols,
                marketHoldingsSymbolsFiltered,
                marketLatestBar,
                marketNameBySymbol,
                marketRangeSummary,
                marketSearchResultsFiltered,
                marketSelectedIndustry,
                marketSelectedManualThemes,
                marketSelectedPlainUserTags,
                marketSelectedQuote,
                marketSelectedTagAggregate,
                marketSelectedTagSeriesReturnPct,
                marketSelectedTagSeriesTone,
                marketSelectedThemes,
                marketTagSeriesLatestCoverageLabel,
                marketTargetPrice,
                refreshMarketTags,
                resetMarketFilters,
                snapshot,
                sortTagMembersByChangePct,
              }}
            />
          )}

          {/* View: Other */}
          {activeView === "other" && (
            <OtherView
              {...{
                ...marketState,
                ...portfolioState,
                Button,
                FormGroup,
                HelpHint,
                Input,
                Modal,
                Panel,
                PopoverSelect,
                UNIVERSE_POOL_BUCKET_ORDER,
                activePortfolio,
                dataQuality,
                formatCnDate,
                formatDateTime,
                formatDurationMs,
                formatIngestControlStateLabel,
                formatIngestRunModeLabel,
                formatIngestRunScopeLabel,
                formatIngestRunStatusLabel,
                formatIngestRunTone,
                formatMarketTokenSource,
                formatPctNullable,
                formatTagSourceLabel,
                formatTargetsReasons,
                getIngestControlStateDotClass,
                getUniversePoolBucketLabel,
                handleApplyManualTargetSymbols,
                handleBatchExtendTempTargets,
                handleBatchPromoteTempTargets,
                handleBatchRemoveTempTargets,
                handleBatchSetRegistryAutoIngest,
                handleCancelMarketIngest,
                handleChooseCsv,
                handleClearMarketToken,
                handleImportHoldings,
                handleImportPrices,
                handleOpenMarketProvider,
                handlePauseMarketIngest,
                handlePreviewManualTargetSymbols,
                handlePromoteTempTarget,
                handleRemoveManualPreviewSymbol,
                handleRemoveTempTarget,
                handleResetTargetsDraft,
                handleResumeMarketIngest,
                handleRunMarketIngestNow,
                handleSaveMarketSchedulerConfig,
                handleSaveMarketToken,
                handleSaveTargets,
                handleSaveUniversePoolConfig,
                handleSeedMarketDemoData,
                handleSelectAllTempTargets,
                handleSetRegistryAutoIngest,
                handleTargetsEditorResizeKeyDown,
                handleTargetsEditorResizePointerDown,
                handleTestMarketToken,
                handleToggleDiffSection,
                handleToggleRegistrySymbol,
                handleToggleSelectAllRegistry,
                handleToggleTargetsSection,
                handleToggleTempTargetSelection,
                handleToggleUniversePoolBucket,
                handleTriggerMarketIngest,
                latestMarketIngestRun,
                marketActiveTargetPoolStats,
                marketCanCancelIngest,
                marketCanPauseIngest,
                marketCanResumeIngest,
                marketCanTriggerIngestNow,
                marketFilteredAddedSymbols,
                marketFilteredReasonChangedSymbols,
                marketFilteredRemovedSymbols,
                marketRegistryEntryEnabled,
                marketSchedulerDirty,
                marketSchedulerTimezoneOptions,
                marketTargetPoolMetricCards,
                marketTargetsDirty,
                marketUniverseBucketStatusById,
                marketUniverseEnabledBuckets,
                marketUniversePoolDirty,
                otherTab,
                otherTabs,
                refreshMarketIngestRunDetail,
                refreshMarketIngestRuns,
                refreshMarketRegistry,
                refreshMarketTags,
                refreshMarketTargets,
                refreshMarketTargetsDiff,
                setActiveView,
                setOtherTab,
                snapshot,
                targetsEditorGridRef,
                updateMarketSchedulerConfig,
              }}
            />
          )}

          {/* Placeholders */}
          {["opportunities", "backtest", "insights", "alerts", "index-tracking"].includes(activeView) && (
            <PlaceholderPanel 
              title={navItems.find(n => n.key === activeView)?.label ?? ""}
              description={navItems.find(n => n.key === activeView)?.description ?? ""}
            />
          )}

        </div>

        <DashboardOverlays
          {...{
            ...marketState,
            Button,
            ConfirmDialog,
            Input,
            error,
            formatPct,
            formatTargetsReasons,
            handleCancelDeleteLedgerEntry,
            handleConfirmDeleteLedgerEntry,
            ledgerDeleteSummary,
            ledgerDeleteTarget,
            marketActiveTargetPoolStats,
            marketCurrentTargetsSource,
            marketFilteredCurrentTargets,
            marketTargetPoolActiveCategoryRow,
            marketTargetPoolDetailCategoryRows,
            marketTargetPoolDetailDescription,
            marketTargetPoolDetailMembers,
            marketTargetPoolDetailTitle,
            marketTargetPoolDetailValue,
            notice,
            setError,
            setNotice,
            toastMessage,
          }}
        />

      </section>
    </div>
  );
}
