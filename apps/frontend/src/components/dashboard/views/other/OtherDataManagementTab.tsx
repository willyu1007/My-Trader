import { createElement } from "react";

import {
  OtherDataManagementIngestSection,
  type OtherDataManagementIngestSectionProps
} from "./data-management/OtherDataManagementIngestSection";
import {
  OtherDataManagementRegistrySection,
  type OtherDataManagementRegistrySectionProps
} from "./data-management/OtherDataManagementRegistrySection";
import {
  OtherDataManagementSchedulerSection,
  type OtherDataManagementSchedulerSectionProps
} from "./data-management/OtherDataManagementSchedulerSection";
import {
  OtherDataManagementSourceSection,
  type OtherDataManagementSourceSectionProps
} from "./data-management/OtherDataManagementSourceSection";
import {
  OtherDataManagementTargetPoolSection,
  type OtherDataManagementTargetPoolSectionProps
} from "./data-management/OtherDataManagementTargetPoolSection";

export type OtherDataManagementTabProps = OtherDataManagementSourceSectionProps &
  OtherDataManagementSchedulerSectionProps &
  OtherDataManagementTargetPoolSectionProps &
  OtherDataManagementRegistrySectionProps &
  OtherDataManagementIngestSectionProps;

export function OtherDataManagementTab(props: OtherDataManagementTabProps) {
  const sourceSectionProps = {
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
    marketUniversePoolSaving: props.marketUniversePoolSaving
  } satisfies OtherDataManagementSourceSectionProps;
  const schedulerSectionProps = {
    Button: props.Button,
    FormGroup: props.FormGroup,
    HelpHint: props.HelpHint,
    Input: props.Input,
    Modal: props.Modal,
    PopoverSelect: props.PopoverSelect,
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
    marketTokenStatus: props.marketTokenStatus,
    marketTriggerIngestBlockedMessage: props.marketTriggerIngestBlockedMessage,
    marketTriggerIngestBlockedOpen: props.marketTriggerIngestBlockedOpen,
    setMarketSchedulerAdvancedOpen: props.setMarketSchedulerAdvancedOpen,
    setMarketTriggerIngestBlockedOpen: props.setMarketTriggerIngestBlockedOpen,
    updateMarketSchedulerConfig: props.updateMarketSchedulerConfig
  } satisfies OtherDataManagementSchedulerSectionProps;
  const targetPoolSectionProps = {
    Button: props.Button,
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
    setMarketTargetPoolStatsScope: props.setMarketTargetPoolStatsScope
  } satisfies OtherDataManagementTargetPoolSectionProps;
  const registrySectionProps = {
    Button: props.Button,
    Input: props.Input,
    PopoverSelect: props.PopoverSelect,
    handleBatchSetRegistryAutoIngest: props.handleBatchSetRegistryAutoIngest,
    handleSetRegistryAutoIngest: props.handleSetRegistryAutoIngest,
    handleToggleRegistrySymbol: props.handleToggleRegistrySymbol,
    handleToggleSelectAllRegistry: props.handleToggleSelectAllRegistry,
    marketRegistryAutoFilter: props.marketRegistryAutoFilter,
    marketRegistryEntryEnabled: props.marketRegistryEntryEnabled,
    marketRegistryLoading: props.marketRegistryLoading,
    marketRegistryQuery: props.marketRegistryQuery,
    marketRegistryResult: props.marketRegistryResult,
    marketRegistrySelectedSymbols: props.marketRegistrySelectedSymbols,
    marketRegistryUpdating: props.marketRegistryUpdating,
    refreshMarketRegistry: props.refreshMarketRegistry,
    setMarketRegistryAutoFilter: props.setMarketRegistryAutoFilter,
    setMarketRegistryQuery: props.setMarketRegistryQuery
  } satisfies OtherDataManagementRegistrySectionProps;
  const ingestSectionProps = {
    Button: props.Button,
    handleTriggerMarketIngest: props.handleTriggerMarketIngest,
    marketIngestTriggering: props.marketIngestTriggering,
    setOtherTab: props.setOtherTab
  } satisfies OtherDataManagementIngestSectionProps;

  return (
    <>
      {createElement(OtherDataManagementSourceSection, sourceSectionProps)}
      {createElement(OtherDataManagementSchedulerSection, schedulerSectionProps)}
      {createElement(OtherDataManagementTargetPoolSection, targetPoolSectionProps)}
      {createElement(OtherDataManagementRegistrySection, registrySectionProps)}
      {createElement(OtherDataManagementIngestSection, ingestSectionProps)}
    </>
  );
}
