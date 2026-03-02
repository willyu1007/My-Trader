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
import {
  OtherValuationMethodsTab,
  type OtherValuationMethodsTabProps
} from "./other/OtherValuationMethodsTab";

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
  const { Panel, otherTab } = props;
  const dataManagementTabProps = {
    formatCnDate: props.formatCnDate,
    formatDateTime: props.formatDateTime,
    formatIngestRunStatusLabel: props.formatIngestRunStatusLabel,
    formatIngestRunTone: props.formatIngestRunTone,
    latestMarketIngestRun: props.latestMarketIngestRun,
    marketTempTargets: props.marketTempTargets,
    snapshot: props.snapshot,
    Button: props.Button,
    HelpHint: props.HelpHint,
    Input: props.Input,
    PopoverSelect: props.PopoverSelect,
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
    refreshMarketTargetPoolStats: props.refreshMarketTargetPoolStats,
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
    setMarketRegistryQuery: props.setMarketRegistryQuery
  } satisfies OtherDataManagementTabProps;
  const instrumentManagementTabProps = {
    Button: props.Button,
    Input: props.Input,
    Modal: props.Modal,
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
    Input: props.Input,
    Modal: props.Modal,
    PopoverSelect: props.PopoverSelect,
    formatCnDate: props.formatCnDate,
    formatDateTime: props.formatDateTime,
    formatDurationMs: props.formatDurationMs,
    formatIngestRunModeLabel: props.formatIngestRunModeLabel,
    formatIngestRunScopeLabel: props.formatIngestRunScopeLabel,
    formatIngestRunStatusLabel: props.formatIngestRunStatusLabel,
    formatIngestRunTone: props.formatIngestRunTone,
    marketIngestRuns: props.marketIngestRuns,
    marketIngestRunsLoading: props.marketIngestRunsLoading,
    marketSelectedIngestRun: props.marketSelectedIngestRun,
    marketSelectedIngestRunId: props.marketSelectedIngestRunId,
    marketSelectedIngestRunLoading: props.marketSelectedIngestRunLoading,
    refreshMarketIngestRunDetail: props.refreshMarketIngestRunDetail,
    refreshMarketIngestRuns: props.refreshMarketIngestRuns
  } satisfies OtherDataStatusTabProps;
  const testTabProps = {
    Button: props.Button,
    activePortfolio: props.activePortfolio,
    setActiveView: props.setActiveView
  } satisfies OtherTestTabProps;
  const valuationMethodsTabProps = {
    Button: props.Button,
    formatDateTime: props.formatDateTime
  } satisfies OtherValuationMethodsTabProps;

  return (
    <Panel>
      <div
        className={`w-full max-w-none ${
          otherTab === "test"
            ? "h-full min-h-0 pt-2"
            : `space-y-6 ${otherTab === "data-management" ? "pt-2" : "pt-6"}`
        }`}
      >
        {otherTab === "data-management" &&
          createElement(OtherDataManagementTab, dataManagementTabProps)}

        {otherTab === "instrument-management" && (
          createElement(OtherInstrumentManagementTab, instrumentManagementTabProps)
        )}

        {otherTab === "data-status" &&
          createElement(OtherDataStatusTab, dataStatusTabProps)}

        {otherTab === "valuation-methods" &&
          createElement(OtherValuationMethodsTab, valuationMethodsTabProps)}

        {otherTab === "test" && createElement(OtherTestTab, testTabProps)}
      </div>
    </Panel>
  );
}
