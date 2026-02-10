import type { Dispatch, SetStateAction } from "react";

import type {
  LedgerEntry,
  PerformanceRangeKey,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioSnapshot
} from "@mytrader/shared";

import {
  CONTRIBUTION_TOP_N,
  HHI_WARN_THRESHOLD,
  UNIVERSE_POOL_BUCKET_ORDER,
  analysisTabs,
  assetClassLabels,
  ledgerEventTypeOptions,
  marketChartRanges,
  navItems,
  otherTabs,
  performanceRanges,
  portfolioTabs,
  riskLimitTypeLabels
} from "../constants";
import {
  Badge,
  Button,
  ChartErrorBoundary,
  ConfirmDialog,
  ContributionTable,
  DataQualityCard,
  DescriptionItem,
  EmptyState,
  ErrorState,
  FormGroup,
  HelpHint,
  IconButton,
  Input,
  LedgerForm,
  LedgerTable,
  MarketAreaChart,
  MarketQuoteHeader,
  MarketVolumeMiniChart,
  Modal,
  Panel,
  PerformanceChart,
  PlaceholderPanel,
  PopoverSelect,
  RiskMetricCard,
  Select,
  SummaryCard,
  formatAssetClassLabel,
  formatCnDate,
  formatCnWanYiNullable,
  formatCurrency,
  formatDateRange,
  formatDateTime,
  formatDurationMs,
  formatIngestControlStateLabel,
  formatIngestRunModeLabel,
  formatIngestRunScopeLabel,
  formatIngestRunStatusLabel,
  formatIngestRunTone,
  formatMarketTokenSource,
  formatNumber,
  formatPct,
  formatPctNullable,
  formatPerformanceMethod,
  formatRiskLimitTypeLabel,
  formatSignedCnWanYiNullable,
  formatSignedPctNullable,
  formatTagSourceLabel,
  formatTargetsReasons,
  formatThemeLabel,
  getCnChangeTone,
  getCnToneTextClass,
  getIngestControlStateDotClass,
  getUniversePoolBucketLabel,
  sortTagMembersByChangePct,
  toUserErrorMessage
} from "../shared";
import type {
  AnalysisTab,
  DashboardProps,
  LedgerFilter,
  LedgerFormState,
  MarketChartRangeKey,
  MarketFilterMarket,
  MarketScope,
  OtherTab,
  PositionFormState,
  PortfolioTab,
  RiskFormState,
  TargetPoolStatsScope,
  TargetPoolStructureStats,
  WorkspaceView
} from "../types";
import type { UseDashboardAnalysisResult } from "../hooks/use-dashboard-analysis";
import type { UseDashboardPortfolioResult } from "../hooks/use-dashboard-portfolio";
import { AccountView } from "./AccountView";
import { DataAnalysisView } from "./DataAnalysisView";
import { DashboardOverlays } from "./DashboardOverlays";
import { MarketView } from "./MarketView";
import { OtherView } from "./OtherView";
import { PortfolioView } from "./PortfolioView";
import { RiskView } from "./RiskView";
import { SidebarNav } from "./SidebarNav";
import { TopToolbar } from "./TopToolbar";

type DashboardMarketState = ReturnType<
  typeof import("../hooks/use-dashboard-market").useDashboardMarket<
    MarketScope,
    MarketFilterMarket,
    MarketChartRangeKey,
    TargetPoolStatsScope,
    TargetPoolStructureStats
  >
>;
type DashboardMarketAdminDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-admin-derived").useDashboardMarketAdminDerived<TargetPoolStatsScope>
>;
type DashboardMarketTargetPoolDetail = ReturnType<
  typeof import("../hooks/use-dashboard-market-target-pool-detail").useDashboardMarketTargetPoolDetail
>;
type DashboardMarketDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-derived").useDashboardMarketDerived
>;
type DashboardAnalysisDerived = ReturnType<
  typeof import("../hooks/use-dashboard-analysis-derived").useDashboardAnalysisDerived
>;
type DashboardPortfolioDerived = ReturnType<
  typeof import("../hooks/use-dashboard-portfolio-derived").useDashboardPortfolioDerived
>;
type DashboardPortfolioActions = ReturnType<
  typeof import("../hooks/use-dashboard-portfolio-actions").useDashboardPortfolioActions
>;
type DashboardLedgerActions = ReturnType<
  typeof import("../hooks/use-dashboard-ledger-actions").useDashboardLedgerActions
>;
type DashboardMarketOrchestration = ReturnType<
  typeof import("../hooks/use-dashboard-market-orchestration").useDashboardMarketOrchestration
>;
type DashboardMarketResizeResult = ReturnType<
  typeof import("../hooks/use-dashboard-market-resize").useDashboardMarketResize
>;

interface DashboardContainerLayoutProps {
  account: DashboardProps["account"];
  onLock: DashboardProps["onLock"];
  activeView: WorkspaceView;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  isNavCollapsed: boolean;
  setIsNavCollapsed: Dispatch<SetStateAction<boolean>>;
  otherTab: OtherTab;
  setOtherTab: Dispatch<SetStateAction<OtherTab>>;
  analysisTab: AnalysisTab;
  setAnalysisTab: Dispatch<SetStateAction<AnalysisTab>>;
  portfolioTab: PortfolioTab;
  setPortfolioTab: Dispatch<SetStateAction<PortfolioTab>>;
  snapshot: PortfolioSnapshot | null;
  activePortfolio: Portfolio | null;
  activePortfolioId: string | null;
  setActivePortfolioId: Dispatch<SetStateAction<string | null>>;
  portfolios: Portfolio[];
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  performanceRange: PerformanceRangeKey;
  setPerformanceRange: Dispatch<SetStateAction<PerformanceRangeKey>>;
  performanceLoading: boolean;
  performanceError: string | null;
  setPerformanceError: Dispatch<SetStateAction<string | null>>;
  performanceResult: PortfolioPerformanceRangeResult | null;
  riskAnnualized: boolean;
  setRiskAnnualized: Dispatch<SetStateAction<boolean>>;
  showAllSymbolContribution: boolean;
  setShowAllSymbolContribution: Dispatch<SetStateAction<boolean>>;
  showAllAssetContribution: boolean;
  setShowAllAssetContribution: Dispatch<SetStateAction<boolean>>;
  portfolioState: UseDashboardPortfolioResult<
    PositionFormState,
    RiskFormState,
    LedgerFormState,
    LedgerEntry,
    LedgerFilter
  >;
  analysisState: UseDashboardAnalysisResult<MarketChartRangeKey>;
  marketState: DashboardMarketState;
  marketAdminDerived: DashboardMarketAdminDerived;
  marketTargetPoolDetail: DashboardMarketTargetPoolDetail;
  marketDerived: DashboardMarketDerived;
  analysisDerived: DashboardAnalysisDerived;
  portfolioDerived: DashboardPortfolioDerived;
  portfolioActions: DashboardPortfolioActions;
  ledgerActions: DashboardLedgerActions;
  marketOrchestration: DashboardMarketOrchestration;
  loadLedgerEntries: (portfolioId: string) => Promise<void>;
  loadPerformance: (
    portfolioId: string,
    range: PerformanceRangeKey
  ) => Promise<void>;
  loadAnalysisInstrument: (symbol: string) => Promise<void>;
  targetsEditorGridRef: DashboardMarketResizeResult["targetsEditorGridRef"];
  handleMarketExplorerResizePointerDown: DashboardMarketResizeResult["handleMarketExplorerResizePointerDown"];
  handleMarketExplorerResizeKeyDown: DashboardMarketResizeResult["handleMarketExplorerResizeKeyDown"];
  handleTargetsEditorResizePointerDown: DashboardMarketResizeResult["handleTargetsEditorResizePointerDown"];
  handleTargetsEditorResizeKeyDown: DashboardMarketResizeResult["handleTargetsEditorResizeKeyDown"];
}

export function DashboardContainerLayout({
  account,
  onLock,
  activeView,
  setActiveView,
  isNavCollapsed,
  setIsNavCollapsed,
  otherTab,
  setOtherTab,
  analysisTab,
  setAnalysisTab,
  portfolioTab,
  setPortfolioTab,
  snapshot,
  activePortfolio,
  activePortfolioId,
  setActivePortfolioId,
  portfolios,
  isLoading,
  error,
  notice,
  setError,
  setNotice,
  performanceRange,
  setPerformanceRange,
  performanceLoading,
  performanceError,
  setPerformanceError,
  performanceResult,
  riskAnnualized,
  setRiskAnnualized,
  showAllSymbolContribution,
  setShowAllSymbolContribution,
  showAllAssetContribution,
  setShowAllAssetContribution,
  portfolioState,
  analysisState,
  marketState,
  marketAdminDerived,
  marketTargetPoolDetail,
  marketDerived,
  analysisDerived,
  portfolioDerived,
  portfolioActions,
  ledgerActions,
  marketOrchestration,
  loadLedgerEntries,
  loadPerformance,
  loadAnalysisInstrument,
  targetsEditorGridRef,
  handleMarketExplorerResizePointerDown,
  handleMarketExplorerResizeKeyDown,
  handleTargetsEditorResizePointerDown,
  handleTargetsEditorResizeKeyDown
}: DashboardContainerLayoutProps) {
  return (
    <div className="flex h-full bg-white/90 dark:bg-background-dark/80 backdrop-blur-xl overflow-hidden">
      <SidebarNav
        activeView={activeView}
        isNavCollapsed={isNavCollapsed}
        items={navItems}
        onSelectView={(view) => setActiveView(view as WorkspaceView)}
        onToggleCollapse={() => setIsNavCollapsed((prev) => !prev)}
      />

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
          {activeView === "account" && (
            <AccountView account={account} formatDateTime={formatDateTime} />
          )}

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
                cashFlowTotals: portfolioDerived.cashFlowTotals,
                cashTotal: portfolioDerived.cashTotal,
                dataQuality: portfolioDerived.dataQuality,
                filteredLedgerEntries: portfolioDerived.filteredLedgerEntries,
                formatAssetClassLabel,
                formatCurrency,
                formatDateRange,
                formatNumber,
                formatPct,
                formatPctNullable,
                formatPerformanceMethod,
                handleCancelEditPosition: portfolioActions.handleCancelEditPosition,
                handleCancelLedgerEdit: ledgerActions.handleCancelLedgerEdit,
                handleCreatePortfolio: portfolioActions.handleCreatePortfolio,
                handleDeletePortfolio: portfolioActions.handleDeletePortfolio,
                handleDeletePosition: portfolioActions.handleDeletePosition,
                handleEditLedgerEntry: ledgerActions.handleEditLedgerEntry,
                handleEditPosition: portfolioActions.handleEditPosition,
                handleOpenLedgerForm: ledgerActions.handleOpenLedgerForm,
                handleRenamePortfolio: portfolioActions.handleRenamePortfolio,
                handleRequestDeleteLedgerEntry:
                  ledgerActions.handleRequestDeleteLedgerEntry,
                handleSubmitLedgerEntry: ledgerActions.handleSubmitLedgerEntry,
                handleSubmitPosition: portfolioActions.handleSubmitPosition,
                hhiValue: portfolioDerived.hhiValue,
                isLoading,
                ledgerEventTypeOptions,
                loadLedgerEntries,
                loadPerformance,
                performanceError,
                performanceLoading,
                performance: portfolioDerived.performance,
                performanceRange,
                performanceRanges,
                performanceResult,
                performanceSeries: portfolioDerived.performanceSeries,
                portfolioTab,
                portfolioTabs,
                portfolios,
                riskAnnualized,
                riskMetrics: portfolioDerived.riskMetrics,
                selectedPerformance: portfolioDerived.selectedPerformance,
                setActivePortfolioId,
                setActiveView,
                setAnalysisTab,
                setOtherTab,
                setPerformanceError,
                setPerformanceRange,
                setRiskAnnualized,
                snapshot,
                toUserErrorMessage,
                updateLedgerForm: ledgerActions.updateLedgerForm
              }}
            />
          )}

          {activeView === "risk" && (
            <RiskView
              snapshot={snapshot}
              formatAssetClassLabel={formatAssetClassLabel}
              formatPct={formatPct}
              formatCurrency={formatCurrency}
              formatRiskLimitTypeLabel={formatRiskLimitTypeLabel}
              handleEditRiskLimit={portfolioActions.handleEditRiskLimit}
              handleDeleteRiskLimit={portfolioActions.handleDeleteRiskLimit}
              riskForm={portfolioState.riskForm}
              setRiskForm={portfolioState.setRiskForm}
              riskLimitTypeLabels={riskLimitTypeLabels}
              handleSubmitRiskLimit={portfolioActions.handleSubmitRiskLimit}
              handleCancelRiskEdit={portfolioActions.handleCancelRiskEdit}
            />
          )}

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
                analysisInstrumentHasEnoughData:
                  analysisDerived.analysisInstrumentHasEnoughData,
                analysisInstrumentHoldingUnitCost:
                  analysisDerived.analysisInstrumentHoldingUnitCost,
                analysisInstrumentLatestBar: analysisDerived.analysisInstrumentLatestBar,
                analysisInstrumentNameBySymbol:
                  analysisDerived.analysisInstrumentNameBySymbol,
                analysisInstrumentPositionValuation:
                  analysisDerived.analysisInstrumentPositionValuation,
                analysisInstrumentQuickSymbols:
                  analysisDerived.analysisInstrumentQuickSymbols,
                analysisInstrumentRangeSummary:
                  analysisDerived.analysisInstrumentRangeSummary,
                analysisInstrumentTargetPrice:
                  analysisDerived.analysisInstrumentTargetPrice,
                analysisInstrumentTone: analysisDerived.analysisInstrumentTone,
                analysisTab,
                analysisTabs,
                contributionBreakdown: portfolioDerived.contributionBreakdown,
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
                performance: portfolioDerived.performance,
                performanceRange,
                performanceRanges,
                performanceResult,
                performanceSeries: portfolioDerived.performanceSeries,
                riskAnnualized,
                riskMetrics: portfolioDerived.riskMetrics,
                selectedPerformance: portfolioDerived.selectedPerformance,
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
                handleAddManualTheme: marketOrchestration.handleAddManualTheme,
                handleAddSelectedToWatchlist:
                  marketOrchestration.handleAddSelectedToWatchlist,
                handleAddTargetTag: marketOrchestration.handleAddTargetTag,
                handleAddUserTag: marketOrchestration.handleAddUserTag,
                handleMarketExplorerResizeKeyDown,
                handleMarketExplorerResizePointerDown,
                handleRemoveUserTag: marketOrchestration.handleRemoveUserTag,
                handleRemoveWatchlistItem:
                  marketOrchestration.handleRemoveWatchlistItem,
                handleSelectInstrument: marketOrchestration.handleSelectInstrument,
                handleSelectTag: marketOrchestration.handleSelectTag,
                handleSyncInstrumentCatalog:
                  marketOrchestration.handleSyncInstrumentCatalog,
                marketActiveMoneyflowRatio: marketDerived.marketActiveMoneyflowRatio,
                marketActiveMoneyflowVol: marketDerived.marketActiveMoneyflowVol,
                marketActiveVolume: marketDerived.marketActiveVolume,
                marketChartHasEnoughData: marketDerived.marketChartHasEnoughData,
                marketChartRanges,
                marketCollectionSelectValue: marketDerived.marketCollectionSelectValue,
                marketEffectiveScope: marketDerived.marketEffectiveScope,
                marketFilteredListSymbols: marketDerived.marketFilteredListSymbols,
                marketFiltersActiveCount: marketDerived.marketFiltersActiveCount,
                marketHoldingUnitCost: marketDerived.marketHoldingUnitCost,
                marketHoldingsSymbols: marketDerived.marketHoldingsSymbols,
                marketHoldingsSymbolsFiltered:
                  marketDerived.marketHoldingsSymbolsFiltered,
                marketLatestBar: marketDerived.marketLatestBar,
                marketNameBySymbol: marketDerived.marketNameBySymbol,
                marketRangeSummary: marketDerived.marketRangeSummary,
                marketSearchResultsFiltered:
                  marketDerived.marketSearchResultsFiltered,
                marketSelectedIndustry: marketAdminDerived.marketSelectedIndustry,
                marketSelectedManualThemes:
                  marketAdminDerived.marketSelectedManualThemes,
                marketSelectedPlainUserTags:
                  marketAdminDerived.marketSelectedPlainUserTags,
                marketSelectedQuote: marketDerived.marketSelectedQuote,
                marketSelectedTagAggregate:
                  marketDerived.marketSelectedTagAggregate,
                marketSelectedTagSeriesReturnPct:
                  marketDerived.marketSelectedTagSeriesReturnPct,
                marketSelectedTagSeriesTone:
                  marketDerived.marketSelectedTagSeriesTone,
                marketSelectedThemes: marketAdminDerived.marketSelectedThemes,
                marketTagSeriesLatestCoverageLabel:
                  marketDerived.marketTagSeriesLatestCoverageLabel,
                marketTargetPrice: marketDerived.marketTargetPrice,
                refreshMarketTags: marketOrchestration.refreshMarketTags,
                resetMarketFilters: marketOrchestration.resetMarketFilters,
                snapshot,
                sortTagMembersByChangePct
              }}
            />
          )}

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
                dataQuality: portfolioDerived.dataQuality,
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
                handleApplyManualTargetSymbols:
                  marketOrchestration.handleApplyManualTargetSymbols,
                handleBatchExtendTempTargets:
                  marketOrchestration.handleBatchExtendTempTargets,
                handleBatchPromoteTempTargets:
                  marketOrchestration.handleBatchPromoteTempTargets,
                handleBatchRemoveTempTargets:
                  marketOrchestration.handleBatchRemoveTempTargets,
                handleBatchSetRegistryAutoIngest:
                  marketOrchestration.handleBatchSetRegistryAutoIngest,
                handleCancelMarketIngest:
                  marketOrchestration.handleCancelMarketIngest,
                handleChooseCsv: ledgerActions.handleChooseCsv,
                handleClearMarketToken: marketOrchestration.handleClearMarketToken,
                handleImportHoldings: ledgerActions.handleImportHoldings,
                handleImportPrices: ledgerActions.handleImportPrices,
                handleOpenMarketProvider:
                  marketOrchestration.handleOpenMarketProvider,
                handlePauseMarketIngest:
                  marketOrchestration.handlePauseMarketIngest,
                handlePreviewManualTargetSymbols:
                  marketOrchestration.handlePreviewManualTargetSymbols,
                handlePromoteTempTarget: marketOrchestration.handlePromoteTempTarget,
                handleRemoveManualPreviewSymbol:
                  marketOrchestration.handleRemoveManualPreviewSymbol,
                handleRemoveTempTarget: marketOrchestration.handleRemoveTempTarget,
                handleResetTargetsDraft: marketOrchestration.handleResetTargetsDraft,
                handleResumeMarketIngest:
                  marketOrchestration.handleResumeMarketIngest,
                handleRunMarketIngestNow:
                  marketOrchestration.handleRunMarketIngestNow,
                handleSaveMarketSchedulerConfig:
                  marketOrchestration.handleSaveMarketSchedulerConfig,
                handleSaveMarketToken: marketOrchestration.handleSaveMarketToken,
                handleSaveTargets: marketOrchestration.handleSaveTargets,
                handleSaveUniversePoolConfig:
                  marketOrchestration.handleSaveUniversePoolConfig,
                handleSeedMarketDemoData:
                  marketOrchestration.handleSeedMarketDemoData,
                handleSelectAllTempTargets:
                  marketOrchestration.handleSelectAllTempTargets,
                handleSetRegistryAutoIngest:
                  marketOrchestration.handleSetRegistryAutoIngest,
                handleTargetsEditorResizeKeyDown,
                handleTargetsEditorResizePointerDown,
                handleTestMarketToken: marketOrchestration.handleTestMarketToken,
                handleToggleDiffSection:
                  marketTargetPoolDetail.handleToggleDiffSection,
                handleToggleRegistrySymbol:
                  marketOrchestration.handleToggleRegistrySymbol,
                handleToggleSelectAllRegistry:
                  marketOrchestration.handleToggleSelectAllRegistry,
                handleToggleTargetsSection:
                  marketTargetPoolDetail.handleToggleTargetsSection,
                handleToggleTempTargetSelection:
                  marketOrchestration.handleToggleTempTargetSelection,
                handleToggleUniversePoolBucket:
                  marketOrchestration.handleToggleUniversePoolBucket,
                handleTriggerMarketIngest:
                  marketOrchestration.handleTriggerMarketIngest,
                latestMarketIngestRun: marketAdminDerived.latestMarketIngestRun,
                marketActiveTargetPoolStats:
                  marketAdminDerived.marketActiveTargetPoolStats,
                marketCanCancelIngest: marketAdminDerived.marketCanCancelIngest,
                marketCanPauseIngest: marketAdminDerived.marketCanPauseIngest,
                marketCanResumeIngest: marketAdminDerived.marketCanResumeIngest,
                marketCanTriggerIngestNow:
                  marketAdminDerived.marketCanTriggerIngestNow,
                marketFilteredAddedSymbols:
                  marketAdminDerived.marketFilteredAddedSymbols,
                marketFilteredReasonChangedSymbols:
                  marketAdminDerived.marketFilteredReasonChangedSymbols,
                marketFilteredRemovedSymbols:
                  marketAdminDerived.marketFilteredRemovedSymbols,
                marketRegistryEntryEnabled:
                  marketAdminDerived.marketRegistryEntryEnabled,
                marketSchedulerDirty: marketAdminDerived.marketSchedulerDirty,
                marketSchedulerTimezoneOptions:
                  marketAdminDerived.marketSchedulerTimezoneOptions,
                marketTargetPoolMetricCards:
                  marketTargetPoolDetail.marketTargetPoolMetricCards,
                marketTargetsDirty: marketAdminDerived.marketTargetsDirty,
                marketUniverseBucketStatusById:
                  marketAdminDerived.marketUniverseBucketStatusById,
                marketUniverseEnabledBuckets:
                  marketAdminDerived.marketUniverseEnabledBuckets,
                marketUniversePoolDirty: marketAdminDerived.marketUniversePoolDirty,
                otherTab,
                otherTabs,
                refreshMarketIngestRunDetail:
                  marketOrchestration.refreshMarketIngestRunDetail,
                refreshMarketIngestRuns:
                  marketOrchestration.refreshMarketIngestRuns,
                refreshMarketRegistry: marketOrchestration.refreshMarketRegistry,
                refreshMarketTags: marketOrchestration.refreshMarketTags,
                refreshMarketTargets: marketOrchestration.refreshMarketTargets,
                refreshMarketTargetsDiff:
                  marketOrchestration.refreshMarketTargetsDiff,
                setActiveView,
                setOtherTab,
                snapshot,
                targetsEditorGridRef,
                updateMarketSchedulerConfig:
                  marketOrchestration.updateMarketSchedulerConfig
              }}
            />
          )}

          {["opportunities", "backtest", "insights", "alerts", "index-tracking"].includes(
            activeView
          ) && (
            <PlaceholderPanel
              title={navItems.find((n) => n.key === activeView)?.label ?? ""}
              description={navItems.find((n) => n.key === activeView)?.description ?? ""}
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
            handleCancelDeleteLedgerEntry:
              ledgerActions.handleCancelDeleteLedgerEntry,
            handleConfirmDeleteLedgerEntry:
              ledgerActions.handleConfirmDeleteLedgerEntry,
            ledgerDeleteSummary: portfolioDerived.ledgerDeleteSummary,
            ledgerDeleteTarget: portfolioState.ledgerDeleteTarget,
            marketActiveTargetPoolStats: marketAdminDerived.marketActiveTargetPoolStats,
            marketCurrentTargetsSource: marketAdminDerived.marketCurrentTargetsSource,
            marketFilteredCurrentTargets:
              marketAdminDerived.marketFilteredCurrentTargets,
            marketTargetPoolActiveCategoryRow:
              marketTargetPoolDetail.marketTargetPoolActiveCategoryRow,
            marketTargetPoolDetailCategoryRows:
              marketTargetPoolDetail.marketTargetPoolDetailCategoryRows,
            marketTargetPoolDetailDescription:
              marketTargetPoolDetail.marketTargetPoolDetailDescription,
            marketTargetPoolDetailMembers:
              marketTargetPoolDetail.marketTargetPoolDetailMembers,
            marketTargetPoolDetailTitle:
              marketTargetPoolDetail.marketTargetPoolDetailTitle,
            marketTargetPoolDetailValue:
              marketTargetPoolDetail.marketTargetPoolDetailValue,
            notice,
            setError,
            setNotice,
            toastMessage: portfolioDerived.toastMessage
          }}
        />
      </section>
    </div>
  );
}
