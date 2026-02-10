import { createElement, type Dispatch, type SetStateAction } from "react";

import type {
  LedgerEntry,
  MarketDataQuality,
  Portfolio,
  PortfolioSnapshot,
  UniversePoolBucketId
} from "@mytrader/shared";

import type {
  LedgerFilter,
  LedgerFormState,
  MarketChartRangeKey,
  MarketFilterMarket,
  MarketScope,
  OtherTab,
  PositionFormState,
  RiskFormState,
  TargetPoolStatsScope,
  TargetPoolStructureStats,
  WorkspaceView
} from "../types";
import {
  OtherDataManagementTab,
  type OtherDataManagementTabProps
} from "./other/OtherDataManagementTab";
import {
  OtherDataStatusTab,
  type OtherDataStatusTabProps
} from "./other/OtherDataStatusTab";
import {
  OtherInstrumentManagementTab,
  type OtherInstrumentManagementTabProps
} from "./other/OtherInstrumentManagementTab";
import { OtherTestTab, type OtherTestTabProps } from "./other/OtherTestTab";

type DashboardMarketState = ReturnType<
  typeof import("../hooks/use-dashboard-market").useDashboardMarket<
    MarketScope,
    MarketFilterMarket,
    MarketChartRangeKey,
    TargetPoolStatsScope,
    TargetPoolStructureStats
  >
>;
type DashboardPortfolioState =
  import("../hooks/use-dashboard-portfolio").UseDashboardPortfolioResult<
    PositionFormState,
    RiskFormState,
    LedgerFormState,
    LedgerEntry,
    LedgerFilter
  >;
type DashboardMarketAdminDerived = ReturnType<
  typeof import("../hooks/use-dashboard-market-admin-derived").useDashboardMarketAdminDerived<TargetPoolStatsScope>
>;
type DashboardMarketTargetPoolDetail = ReturnType<
  typeof import("../hooks/use-dashboard-market-target-pool-detail").useDashboardMarketTargetPoolDetail
>;
type DashboardMarketOrchestration = ReturnType<
  typeof import("../hooks/use-dashboard-market-orchestration").useDashboardMarketOrchestration
>;
type DashboardLedgerActions = ReturnType<
  typeof import("../hooks/use-dashboard-ledger-actions").useDashboardLedgerActions
>;
type DashboardMarketResizeResult = ReturnType<
  typeof import("../hooks/use-dashboard-market-resize").useDashboardMarketResize
>;

interface OtherTabOption {
  key: OtherTab;
  label: string;
}

interface OtherViewExternalProps {
  Button: typeof import("../shared").Button;
  FormGroup: typeof import("../shared").FormGroup;
  HelpHint: typeof import("../shared").HelpHint;
  Input: typeof import("../shared").Input;
  Modal: typeof import("../shared").Modal;
  Panel: typeof import("../shared").Panel;
  PopoverSelect: typeof import("../shared").PopoverSelect;
  UNIVERSE_POOL_BUCKET_ORDER: ReadonlyArray<UniversePoolBucketId>;
  activePortfolio: Portfolio | null;
  dataQuality: MarketDataQuality | null;
  formatCnDate: typeof import("../shared").formatCnDate;
  formatDateTime: typeof import("../shared").formatDateTime;
  formatDurationMs: typeof import("../shared").formatDurationMs;
  formatIngestControlStateLabel: typeof import("../shared").formatIngestControlStateLabel;
  formatIngestRunModeLabel: typeof import("../shared").formatIngestRunModeLabel;
  formatIngestRunScopeLabel: typeof import("../shared").formatIngestRunScopeLabel;
  formatIngestRunStatusLabel: typeof import("../shared").formatIngestRunStatusLabel;
  formatIngestRunTone: typeof import("../shared").formatIngestRunTone;
  formatMarketTokenSource: typeof import("../shared").formatMarketTokenSource;
  formatPctNullable: typeof import("../shared").formatPctNullable;
  formatTagSourceLabel: typeof import("../shared").formatTagSourceLabel;
  formatTargetsReasons: typeof import("../shared").formatTargetsReasons;
  getIngestControlStateDotClass: typeof import("../shared").getIngestControlStateDotClass;
  getUniversePoolBucketLabel: typeof import("../shared").getUniversePoolBucketLabel;
  otherTab: OtherTab;
  otherTabs: ReadonlyArray<OtherTabOption>;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  setOtherTab: Dispatch<SetStateAction<OtherTab>>;
  snapshot: PortfolioSnapshot | null;
}

export type OtherViewProps = DashboardMarketState &
  DashboardPortfolioState &
  DashboardMarketAdminDerived &
  DashboardMarketTargetPoolDetail &
  DashboardMarketOrchestration &
  DashboardLedgerActions &
  Pick<
    DashboardMarketResizeResult,
    | "targetsEditorGridRef"
    | "handleTargetsEditorResizePointerDown"
    | "handleTargetsEditorResizeKeyDown"
  > &
  OtherViewExternalProps;

export function OtherView(props: OtherViewProps) {
  const { Panel, otherTab, otherTabs, setOtherTab } = props;
  const dataManagementTabProps = {
    formatDateTime: props.formatDateTime,
    formatIngestRunStatusLabel: props.formatIngestRunStatusLabel,
    formatIngestRunTone: props.formatIngestRunTone,
    formatMarketTokenSource: props.formatMarketTokenSource,
    latestMarketIngestRun: props.latestMarketIngestRun,
    marketTempTargets: props.marketTempTargets,
    marketTokenStatus: props.marketTokenStatus,
    snapshot: props.snapshot,
    Button: props.Button,
    HelpHint: props.HelpHint,
    Input: props.Input,
    PopoverSelect: props.PopoverSelect,
    handleClearMarketToken: props.handleClearMarketToken,
    handleOpenMarketProvider: props.handleOpenMarketProvider,
    handleSaveMarketToken: props.handleSaveMarketToken,
    handleTestMarketToken: props.handleTestMarketToken,
    marketTokenDraft: props.marketTokenDraft,
    marketTokenProvider: props.marketTokenProvider,
    marketTokenSaving: props.marketTokenSaving,
    marketTokenTesting: props.marketTokenTesting,
    setMarketTokenDraft: props.setMarketTokenDraft,
    setMarketTokenProvider: props.setMarketTokenProvider,
    UNIVERSE_POOL_BUCKET_ORDER: props.UNIVERSE_POOL_BUCKET_ORDER,
    formatCnDate: props.formatCnDate,
    getUniversePoolBucketLabel: props.getUniversePoolBucketLabel,
    handleSaveUniversePoolConfig: props.handleSaveUniversePoolConfig,
    handleToggleUniversePoolBucket: props.handleToggleUniversePoolBucket,
    marketUniverseBucketStatusById: props.marketUniverseBucketStatusById,
    marketUniverseEnabledBuckets: props.marketUniverseEnabledBuckets,
    marketUniversePoolConfig: props.marketUniversePoolConfig,
    marketUniversePoolDirty: props.marketUniversePoolDirty,
    marketUniversePoolLoading: props.marketUniversePoolLoading,
    marketUniversePoolSaving: props.marketUniversePoolSaving,
    FormGroup: props.FormGroup,
    Modal: props.Modal,
    formatIngestControlStateLabel: props.formatIngestControlStateLabel,
    getIngestControlStateDotClass: props.getIngestControlStateDotClass,
    handleCancelMarketIngest: props.handleCancelMarketIngest,
    handlePauseMarketIngest: props.handlePauseMarketIngest,
    handleResumeMarketIngest: props.handleResumeMarketIngest,
    handleRunMarketIngestNow: props.handleRunMarketIngestNow,
    handleSaveMarketSchedulerConfig: props.handleSaveMarketSchedulerConfig,
    marketCanCancelIngest: props.marketCanCancelIngest,
    marketCanPauseIngest: props.marketCanPauseIngest,
    marketCanResumeIngest: props.marketCanResumeIngest,
    marketCanTriggerIngestNow: props.marketCanTriggerIngestNow,
    marketIngestControlStatus: props.marketIngestControlStatus,
    marketSchedulerAdvancedOpen: props.marketSchedulerAdvancedOpen,
    marketSchedulerConfig: props.marketSchedulerConfig,
    marketSchedulerDirty: props.marketSchedulerDirty,
    marketSchedulerLoading: props.marketSchedulerLoading,
    marketSchedulerSaving: props.marketSchedulerSaving,
    marketSchedulerTimezoneOptions: props.marketSchedulerTimezoneOptions,
    marketTriggerIngestBlockedMessage: props.marketTriggerIngestBlockedMessage,
    marketTriggerIngestBlockedOpen: props.marketTriggerIngestBlockedOpen,
    setMarketSchedulerAdvancedOpen: props.setMarketSchedulerAdvancedOpen,
    setMarketTriggerIngestBlockedOpen: props.setMarketTriggerIngestBlockedOpen,
    updateMarketSchedulerConfig: props.updateMarketSchedulerConfig,
    handleResetTargetsDraft: props.handleResetTargetsDraft,
    handleSaveTargets: props.handleSaveTargets,
    handleTargetsEditorResizeKeyDown: props.handleTargetsEditorResizeKeyDown,
    handleTargetsEditorResizePointerDown: props.handleTargetsEditorResizePointerDown,
    marketTargetsDiffPreview: props.marketTargetsDiffPreview,
    marketTargetsDirty: props.marketTargetsDirty,
    marketTargetsLoading: props.marketTargetsLoading,
    marketTargetsPreview: props.marketTargetsPreview,
    marketTargetsSaving: props.marketTargetsSaving,
    refreshMarketTargets: props.refreshMarketTargets,
    refreshMarketTargetsDiff: props.refreshMarketTargetsDiff,
    targetsEditorGridRef: props.targetsEditorGridRef,
    targetsEditorLeftPct: props.targetsEditorLeftPct,
    handleApplyManualTargetSymbols: props.handleApplyManualTargetSymbols,
    handlePreviewManualTargetSymbols: props.handlePreviewManualTargetSymbols,
    handleRemoveManualPreviewSymbol: props.handleRemoveManualPreviewSymbol,
    handleToggleTargetsSection: props.handleToggleTargetsSection,
    marketManualSymbolPreview: props.marketManualSymbolPreview,
    marketRegistryEntryEnabled: props.marketRegistryEntryEnabled,
    marketTargetsConfig: props.marketTargetsConfig,
    marketTargetsSectionOpen: props.marketTargetsSectionOpen,
    marketTargetsSymbolDraft: props.marketTargetsSymbolDraft,
    setMarketManualSymbolPreview: props.setMarketManualSymbolPreview,
    setMarketTargetsConfig: props.setMarketTargetsConfig,
    setMarketTargetsSymbolDraft: props.setMarketTargetsSymbolDraft,
    formatTargetsReasons: props.formatTargetsReasons,
    handleToggleDiffSection: props.handleToggleDiffSection,
    marketActiveTargetPoolStats: props.marketActiveTargetPoolStats,
    marketDiffSectionOpen: props.marketDiffSectionOpen,
    marketFilteredAddedSymbols: props.marketFilteredAddedSymbols,
    marketFilteredReasonChangedSymbols: props.marketFilteredReasonChangedSymbols,
    marketFilteredRemovedSymbols: props.marketFilteredRemovedSymbols,
    marketTargetPoolMetricCards: props.marketTargetPoolMetricCards,
    marketTargetPoolStatsScope: props.marketTargetPoolStatsScope,
    setMarketCurrentTargetsModalOpen: props.setMarketCurrentTargetsModalOpen,
    setMarketTargetPoolDetailMetric: props.setMarketTargetPoolDetailMetric,
    setMarketTargetPoolStatsScope: props.setMarketTargetPoolStatsScope,
    handleBatchSetRegistryAutoIngest: props.handleBatchSetRegistryAutoIngest,
    handleSetRegistryAutoIngest: props.handleSetRegistryAutoIngest,
    handleToggleRegistrySymbol: props.handleToggleRegistrySymbol,
    handleToggleSelectAllRegistry: props.handleToggleSelectAllRegistry,
    marketRegistryAutoFilter: props.marketRegistryAutoFilter,
    marketRegistryLoading: props.marketRegistryLoading,
    marketRegistryQuery: props.marketRegistryQuery,
    marketRegistryResult: props.marketRegistryResult,
    marketRegistrySelectedSymbols: props.marketRegistrySelectedSymbols,
    marketRegistryUpdating: props.marketRegistryUpdating,
    refreshMarketRegistry: props.refreshMarketRegistry,
    setMarketRegistryAutoFilter: props.setMarketRegistryAutoFilter,
    setMarketRegistryQuery: props.setMarketRegistryQuery,
    handleTriggerMarketIngest: props.handleTriggerMarketIngest,
    marketIngestTriggering: props.marketIngestTriggering,
    setOtherTab: props.setOtherTab
  } satisfies OtherDataManagementTabProps;
  const instrumentManagementTabProps = {
    Button: props.Button,
    Input: props.Input,
    formatDateTime: props.formatDateTime,
    formatTagSourceLabel: props.formatTagSourceLabel,
    handleBatchExtendTempTargets: props.handleBatchExtendTempTargets,
    handleBatchPromoteTempTargets: props.handleBatchPromoteTempTargets,
    handleBatchRemoveTempTargets: props.handleBatchRemoveTempTargets,
    handlePromoteTempTarget: props.handlePromoteTempTarget,
    handleRemoveTempTarget: props.handleRemoveTempTarget,
    handleSelectAllTempTargets: props.handleSelectAllTempTargets,
    handleToggleTempTargetSelection: props.handleToggleTempTargetSelection,
    marketSelectedTempTargetSymbols: props.marketSelectedTempTargetSymbols,
    marketTagManagementQuery: props.marketTagManagementQuery,
    marketTags: props.marketTags,
    marketTagsLoading: props.marketTagsLoading,
    marketTargetsSaving: props.marketTargetsSaving,
    marketTempTargets: props.marketTempTargets,
    marketTempTargetsLoading: props.marketTempTargetsLoading,
    refreshMarketTags: props.refreshMarketTags,
    setMarketTagManagementQuery: props.setMarketTagManagementQuery
  } satisfies OtherInstrumentManagementTabProps;
  const dataStatusTabProps = {
    Button: props.Button,
    dataQuality: props.dataQuality,
    formatDateTime: props.formatDateTime,
    formatDurationMs: props.formatDurationMs,
    formatIngestRunModeLabel: props.formatIngestRunModeLabel,
    formatIngestRunScopeLabel: props.formatIngestRunScopeLabel,
    formatIngestRunStatusLabel: props.formatIngestRunStatusLabel,
    formatIngestRunTone: props.formatIngestRunTone,
    formatMarketTokenSource: props.formatMarketTokenSource,
    formatPctNullable: props.formatPctNullable,
    handleTriggerMarketIngest: props.handleTriggerMarketIngest,
    marketIngestRuns: props.marketIngestRuns,
    marketIngestRunsLoading: props.marketIngestRunsLoading,
    marketIngestTriggering: props.marketIngestTriggering,
    marketSelectedIngestRun: props.marketSelectedIngestRun,
    marketSelectedIngestRunId: props.marketSelectedIngestRunId,
    marketSelectedIngestRunLoading: props.marketSelectedIngestRunLoading,
    marketTokenStatus: props.marketTokenStatus,
    refreshMarketIngestRunDetail: props.refreshMarketIngestRunDetail,
    refreshMarketIngestRuns: props.refreshMarketIngestRuns,
    snapshot: props.snapshot
  } satisfies OtherDataStatusTabProps;
  const testTabProps = {
    Button: props.Button,
    FormGroup: props.FormGroup,
    Input: props.Input,
    activePortfolio: props.activePortfolio,
    handleChooseCsv: props.handleChooseCsv,
    handleImportHoldings: props.handleImportHoldings,
    handleImportPrices: props.handleImportPrices,
    handleSeedMarketDemoData: props.handleSeedMarketDemoData,
    holdingsCsvPath: props.holdingsCsvPath,
    marketDemoSeeding: props.marketDemoSeeding,
    pricesCsvPath: props.pricesCsvPath,
    setActiveView: props.setActiveView
  } satisfies OtherTestTabProps;

  return (
    <Panel>
      <div className="border-b border-border-light dark:border-border-dark bg-white/90 dark:bg-background-dark/75">
        <div className="flex items-center gap-1 overflow-x-auto px-3">
          {otherTabs.map((tab: OtherTabOption) => {
            const isActive = otherTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`flex-none min-w-[140px] flex items-center justify-center px-4 py-2 text-sm font-semibold text-center whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? "text-slate-900 dark:text-white border-primary bg-slate-100 dark:bg-surface-dark"
                    : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-background-dark/80"
                }`}
                onClick={() => setOtherTab(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-6 space-y-6 w-full max-w-none">
        {otherTab === "data-management" &&
          createElement(OtherDataManagementTab, dataManagementTabProps)}

        {otherTab === "instrument-management" && (
          createElement(OtherInstrumentManagementTab, instrumentManagementTabProps)
        )}

        {otherTab === "data-status" &&
          createElement(OtherDataStatusTab, dataStatusTabProps)}

        {otherTab === "test" && createElement(OtherTestTab, testTabProps)}
      </div>
    </Panel>
  );
}
