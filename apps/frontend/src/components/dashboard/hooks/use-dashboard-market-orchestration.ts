import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  MarketIngestControlStatus,
  MarketTargetsConfig,
  WatchlistItem
} from "@mytrader/shared";

import type { AnalysisTab, MarketScope, OtherTab, WorkspaceView } from "../types";
import { marketCategoryPresets } from "../constants";
import {
  useDashboardMarketManagementActions,
  useDashboardMarketRuntimeEffects
} from "./use-dashboard-market";
import type {
  UseDashboardMarketManagementActionsOptions,
  UseDashboardMarketRuntimeEffectsOptions
} from "./use-dashboard-market";
import { useDashboardMarketDataLoaders } from "./use-dashboard-market-data-loaders";
import type { UseDashboardMarketDataLoadersOptions } from "./use-dashboard-market-data-loaders";
import { useDashboardMarketTargetPoolStats } from "./use-dashboard-market-target-pool-stats";
import type { UseDashboardMarketTargetPoolStatsOptions } from "./use-dashboard-market-target-pool-stats";
import { useDashboardMarketAdminRefresh } from "./use-dashboard-market-admin-refresh";
import type { UseDashboardMarketAdminRefreshOptions } from "./use-dashboard-market-admin-refresh";
import { useDashboardMarketAdminActions } from "./use-dashboard-market-admin-actions";
import type { UseDashboardMarketAdminActionsOptions } from "./use-dashboard-market-admin-actions";
import { useDashboardMarketInstrumentActions } from "./use-dashboard-market-instrument-actions";
import type { UseDashboardMarketInstrumentActionsOptions } from "./use-dashboard-market-instrument-actions";
import { useDashboardMarketTargetActions } from "./use-dashboard-market-target-actions";
import type { UseDashboardMarketTargetActionsOptions } from "./use-dashboard-market-target-actions";

type MarketStateForDataLoaders = Pick<
  UseDashboardMarketDataLoadersOptions,
  | "marketTargetsConfig"
  | "setMarketWatchlistLoading"
  | "setMarketWatchlistItems"
  | "setMarketTagsLoading"
  | "setMarketTags"
  | "setMarketManualThemeLoading"
  | "setMarketManualThemeOptions"
  | "setMarketManualThemeDraft"
  | "setMarketFilterMarket"
  | "setMarketFilterAssetClasses"
  | "setMarketFilterKinds"
  | "setMarketQuotesLoading"
  | "setMarketQuotesBySymbol"
  | "setMarketTargetsLoading"
  | "setMarketTargetsSavedConfig"
  | "setMarketTargetsConfig"
  | "setMarketTargetsDiffPreview"
  | "setMarketTargetsPreview"
  | "setMarketTempTargetsLoading"
  | "setMarketTempTargets"
  | "setMarketManualSymbolPreview"
>;

type MarketStateForTargetPoolStats = Pick<
  UseDashboardMarketTargetPoolStatsOptions,
  "setMarketTargetPoolStatsByScope"
> & {
  marketUniversePoolConfig: UseDashboardMarketAdminActionsOptions["marketUniversePoolConfig"];
};

type MarketStateForAdminRefresh = Pick<
  UseDashboardMarketAdminRefreshOptions,
  | "marketRegistryQuery"
  | "marketRegistryAutoFilter"
  | "setMarketTokenStatus"
  | "setMarketIngestRuns"
  | "setMarketIngestRunsLoading"
  | "setMarketIngestControlStatus"
  | "setMarketSchedulerConfig"
  | "setMarketSchedulerSavedConfig"
  | "setMarketSchedulerLoading"
  | "setMarketUniversePoolConfig"
  | "setMarketUniversePoolSavedConfig"
  | "setMarketUniversePoolOverview"
  | "setMarketUniversePoolLoading"
  | "setMarketRegistryResult"
  | "setMarketRegistryLoading"
  | "setMarketRegistrySelectedSymbols"
  | "setMarketSelectedIngestRunId"
  | "setMarketSelectedIngestRun"
  | "setMarketSelectedIngestRunLoading"
>;

type MarketStateForAdminActions = Pick<
  UseDashboardMarketAdminActionsOptions,
  | "marketTokenProvider"
  | "marketTokenDraft"
  | "setMarketTokenStatus"
  | "setMarketTokenDraft"
  | "setMarketTokenSaving"
  | "setMarketTokenTesting"
  | "setMarketUniversePoolConfig"
  | "setMarketUniversePoolSavedConfig"
  | "setMarketUniversePoolOverview"
  | "setMarketUniversePoolSaving"
  | "setMarketIngestTriggering"
  | "setMarketTriggerIngestBlockedOpen"
  | "setMarketTriggerIngestBlockedMessage"
> & {
  marketUniversePoolConfig: UseDashboardMarketAdminActionsOptions["marketUniversePoolConfig"];
};

type MarketStateForInstrumentActions = Pick<
  UseDashboardMarketInstrumentActionsOptions,
  | "marketSelectedSymbol"
  | "marketUserTagDraft"
  | "marketManualThemeDraft"
  | "marketManualThemeOptions"
  | "marketSelectedUserTags"
  | "marketSelectedProfile"
  | "marketWatchlistGroupDraft"
  | "setMarketCatalogSyncing"
  | "setMarketCatalogSyncSummary"
  | "setMarketInstrumentDetailsOpen"
  | "setMarketTagMembersModalOpen"
  | "setMarketSelectedSymbol"
  | "setMarketSelectedProfile"
  | "setMarketSelectedUserTags"
  | "setMarketShowProviderData"
  | "setMarketChartHoverDate"
  | "setMarketChartHoverPrice"
  | "setMarketChartLoading"
  | "setMarketTempTargets"
  | "setMarketTargetsPreview"
  | "setMarketSelectedTag"
  | "setMarketTagMembers"
  | "setMarketChartBars"
  | "setMarketTagMembersLoading"
  | "setMarketDemoSeeding"
  | "setMarketUserTagDraft"
>;

type MarketStateForTargetActions = Pick<
  UseDashboardMarketTargetActionsOptions,
  | "marketTargetsConfig"
  | "marketTargetsSavedConfig"
  | "marketTargetsSymbolDraft"
  | "marketManualSymbolPreview"
  | "marketSelectedTempTargetSymbols"
  | "marketTempTargets"
  | "setMarketTargetsConfig"
  | "setMarketTargetsSavedConfig"
  | "setMarketTargetsSymbolDraft"
  | "setMarketManualSymbolPreview"
  | "setMarketTargetsDiffPreview"
  | "setMarketTargetsPreview"
  | "setMarketTargetsSaving"
  | "setMarketTempTargets"
  | "setMarketTempTargetsLoading"
  | "setMarketSelectedTempTargetSymbols"
>;

type MarketStateForManagementActions = Pick<
  UseDashboardMarketManagementActionsOptions,
  | "marketSchedulerConfig"
  | "marketIngestTriggering"
  | "marketRegistryResult"
  | "marketRegistrySelectedSymbols"
  | "setMarketIngestControlStatus"
  | "setMarketIngestControlUpdating"
  | "setMarketSchedulerConfig"
  | "setMarketSchedulerSavedConfig"
  | "setMarketSchedulerSaving"
  | "setMarketTriggerIngestBlockedOpen"
  | "setMarketTriggerIngestBlockedMessage"
  | "setMarketRegistrySelectedSymbols"
  | "setMarketRegistryUpdating"
>;

type MarketStateForRuntimeEffects = Pick<
  UseDashboardMarketRuntimeEffectsOptions<MarketScope>,
  | "marketCategoryTab"
  | "marketSelectedSymbol"
  | "marketSelectedTag"
  | "marketSearchQuery"
  | "marketTagManagementQuery"
  | "marketInstrumentDetailsOpen"
  | "marketIngestRuns"
  | "marketSelectedIngestRunId"
  | "marketRegistryAutoFilter"
  | "marketRegistryQuery"
  | "marketTargetsConfig"
  | "setMarketSelectedIngestRunId"
  | "setMarketSelectedIngestRun"
  | "setMarketScope"
> & {
  marketTagMembers: string[];
  marketWatchlistItems: WatchlistItem[];
  marketTargetsTagDraft: string;
  setMarketTargetsTagDraft: Dispatch<SetStateAction<string>>;
};

type MarketOrchestrationState = MarketStateForDataLoaders &
  MarketStateForTargetPoolStats &
  MarketStateForAdminRefresh &
  MarketStateForAdminActions &
  MarketStateForInstrumentActions &
  MarketStateForTargetActions &
  MarketStateForManagementActions &
  MarketStateForRuntimeEffects;

export interface UseDashboardMarketOrchestrationOptions {
  activeView: WorkspaceView;
  otherTab: OtherTab;
  analysisTab: AnalysisTab;
  activePortfolioId: string | null;
  marketState: MarketOrchestrationState;
  marketEffectiveScope: MarketScope;
  marketHoldingsSymbolsFiltered: string[];
  marketSearchResultSymbols: string[];
  marketFocusTargetSymbols: string[];
  marketTargetsDirty: boolean;
  marketIngestControlState: MarketIngestControlStatus["state"] | "idle";
  marketRegistryEntryEnabled: boolean;
  toUserErrorMessage: (err: unknown) => string;
  loadSnapshot: (portfolioId: string) => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  setOtherTab: Dispatch<SetStateAction<OtherTab>>;
  universePoolBucketOrder: UseDashboardMarketAdminActionsOptions["universePoolBucketOrder"];
}

export function useDashboardMarketOrchestration(
  options: UseDashboardMarketOrchestrationOptions
) {
  const {
    refreshMarketWatchlist,
    refreshMarketTags,
    refreshManualThemeOptions,
    resetMarketFilters,
    loadMarketQuotes,
    refreshMarketTargets,
    refreshMarketTargetsDiff
  } = useDashboardMarketDataLoaders({
    marketTargetsConfig: options.marketState.marketTargetsConfig,
    toUserErrorMessage: options.toUserErrorMessage,
    setError: options.setError,
    setMarketWatchlistLoading: options.marketState.setMarketWatchlistLoading,
    setMarketWatchlistItems: options.marketState.setMarketWatchlistItems,
    setMarketTagsLoading: options.marketState.setMarketTagsLoading,
    setMarketTags: options.marketState.setMarketTags,
    setMarketManualThemeLoading: options.marketState.setMarketManualThemeLoading,
    setMarketManualThemeOptions: options.marketState.setMarketManualThemeOptions,
    setMarketManualThemeDraft: options.marketState.setMarketManualThemeDraft,
    setMarketFilterMarket: options.marketState.setMarketFilterMarket,
    setMarketFilterAssetClasses: options.marketState.setMarketFilterAssetClasses,
    setMarketFilterKinds: options.marketState.setMarketFilterKinds,
    resolveFilterResetPreset: () => {
      const preset = marketCategoryPresets[options.marketState.marketCategoryTab];
      return {
        filterMarket: preset.filterMarket,
        filterAssetClasses: [...preset.filterAssetClasses],
        filterKinds: [...preset.filterKinds]
      };
    },
    setMarketQuotesLoading: options.marketState.setMarketQuotesLoading,
    setMarketQuotesBySymbol: options.marketState.setMarketQuotesBySymbol,
    setMarketTargetsLoading: options.marketState.setMarketTargetsLoading,
    setMarketTargetsSavedConfig: options.marketState.setMarketTargetsSavedConfig,
    setMarketTargetsConfig: options.marketState.setMarketTargetsConfig,
    setMarketTargetsDiffPreview: options.marketState.setMarketTargetsDiffPreview,
    setMarketTargetsPreview: options.marketState.setMarketTargetsPreview,
    setMarketTempTargetsLoading: options.marketState.setMarketTempTargetsLoading,
    setMarketTempTargets: options.marketState.setMarketTempTargets,
    setMarketManualSymbolPreview: options.marketState.setMarketManualSymbolPreview
  });

  const refreshMarketTargetPoolStats = useDashboardMarketTargetPoolStats({
    marketFocusTargetSymbols: options.marketFocusTargetSymbols,
    marketUniversePoolEnabledBuckets:
      options.marketState.marketUniversePoolConfig?.enabledBuckets,
    universePoolBucketOrder: options.universePoolBucketOrder,
    toUserErrorMessage: options.toUserErrorMessage,
    setMarketTargetPoolStatsByScope: options.marketState.setMarketTargetPoolStatsByScope
  });

  const {
    refreshMarketTokenStatus,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketSchedulerConfig,
    refreshMarketUniversePool,
    refreshMarketUniversePoolOverview,
    refreshMarketRegistry,
    refreshMarketIngestRunDetail
  } = useDashboardMarketAdminRefresh({
    marketRegistryQuery: options.marketState.marketRegistryQuery,
    marketRegistryAutoFilter: options.marketState.marketRegistryAutoFilter,
    toUserErrorMessage: options.toUserErrorMessage,
    setError: options.setError,
    setMarketTokenStatus: options.marketState.setMarketTokenStatus,
    setMarketIngestRuns: options.marketState.setMarketIngestRuns,
    setMarketIngestRunsLoading: options.marketState.setMarketIngestRunsLoading,
    setMarketIngestControlStatus: options.marketState.setMarketIngestControlStatus,
    setMarketSchedulerConfig: options.marketState.setMarketSchedulerConfig,
    setMarketSchedulerSavedConfig: options.marketState.setMarketSchedulerSavedConfig,
    setMarketSchedulerLoading: options.marketState.setMarketSchedulerLoading,
    setMarketUniversePoolConfig: options.marketState.setMarketUniversePoolConfig,
    setMarketUniversePoolSavedConfig:
      options.marketState.setMarketUniversePoolSavedConfig,
    setMarketUniversePoolOverview: options.marketState.setMarketUniversePoolOverview,
    setMarketUniversePoolLoading: options.marketState.setMarketUniversePoolLoading,
    setMarketRegistryResult: options.marketState.setMarketRegistryResult,
    setMarketRegistryLoading: options.marketState.setMarketRegistryLoading,
    setMarketRegistrySelectedSymbols:
      options.marketState.setMarketRegistrySelectedSymbols,
    setMarketSelectedIngestRunId: options.marketState.setMarketSelectedIngestRunId,
    setMarketSelectedIngestRun: options.marketState.setMarketSelectedIngestRun,
    setMarketSelectedIngestRunLoading:
      options.marketState.setMarketSelectedIngestRunLoading
  });

  const {
    handleOpenMarketProvider,
    handleSaveMarketToken,
    handleClearMarketToken,
    handleTestMarketToken,
    handleToggleUniversePoolBucket,
    handleSaveUniversePoolConfig,
    handleTriggerMarketIngest
  } = useDashboardMarketAdminActions({
    marketTokenProvider: options.marketState.marketTokenProvider,
    marketTokenDraft: options.marketState.marketTokenDraft,
    marketUniversePoolConfig: options.marketState.marketUniversePoolConfig,
    refreshMarketTokenStatus,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketTargetPoolStats,
    toUserErrorMessage: options.toUserErrorMessage,
    universePoolBucketOrder: options.universePoolBucketOrder,
    setError: options.setError,
    setNotice: options.setNotice,
    setMarketTokenStatus: options.marketState.setMarketTokenStatus,
    setMarketTokenDraft: options.marketState.setMarketTokenDraft,
    setMarketTokenSaving: options.marketState.setMarketTokenSaving,
    setMarketTokenTesting: options.marketState.setMarketTokenTesting,
    setMarketUniversePoolConfig: options.marketState.setMarketUniversePoolConfig,
    setMarketUniversePoolSavedConfig:
      options.marketState.setMarketUniversePoolSavedConfig,
    setMarketUniversePoolOverview: options.marketState.setMarketUniversePoolOverview,
    setMarketUniversePoolSaving: options.marketState.setMarketUniversePoolSaving,
    setMarketIngestTriggering: options.marketState.setMarketIngestTriggering,
    setMarketTriggerIngestBlockedOpen:
      options.marketState.setMarketTriggerIngestBlockedOpen,
    setMarketTriggerIngestBlockedMessage:
      options.marketState.setMarketTriggerIngestBlockedMessage
  });

  const setMarketScopeToTags = useCallback(() => {
    options.marketState.setMarketScope("tags");
  }, [options.marketState]);

  const {
    handleSyncInstrumentCatalog,
    handleSelectInstrument,
    handleSelectTag,
    handleSeedMarketDemoData,
    handleAddUserTag,
    handleRemoveUserTag,
    handleAddManualTheme,
    handleAddSelectedToWatchlist,
    handleRemoveWatchlistItem
  } = useDashboardMarketInstrumentActions({
    activePortfolioId: options.activePortfolioId,
    marketSelectedSymbol: options.marketState.marketSelectedSymbol,
    marketUserTagDraft: options.marketState.marketUserTagDraft,
    marketManualThemeDraft: options.marketState.marketManualThemeDraft,
    marketManualThemeOptions: options.marketState.marketManualThemeOptions,
    marketSelectedUserTags: options.marketState.marketSelectedUserTags,
    marketSelectedProfile: options.marketState.marketSelectedProfile,
    marketWatchlistGroupDraft: options.marketState.marketWatchlistGroupDraft,
    toUserErrorMessage: options.toUserErrorMessage,
    loadSnapshot: options.loadSnapshot,
    loadMarketQuotes,
    refreshMarketTargets,
    refreshMarketWatchlist,
    refreshMarketTags,
    setMarketScopeToTags,
    setError: options.setError,
    setNotice: options.setNotice,
    setMarketCatalogSyncing: options.marketState.setMarketCatalogSyncing,
    setMarketCatalogSyncSummary: options.marketState.setMarketCatalogSyncSummary,
    setMarketInstrumentDetailsOpen:
      options.marketState.setMarketInstrumentDetailsOpen,
    setMarketTagMembersModalOpen: options.marketState.setMarketTagMembersModalOpen,
    setMarketSelectedSymbol: options.marketState.setMarketSelectedSymbol,
    setMarketSelectedProfile: options.marketState.setMarketSelectedProfile,
    setMarketSelectedUserTags: options.marketState.setMarketSelectedUserTags,
    setMarketShowProviderData: options.marketState.setMarketShowProviderData,
    setMarketChartHoverDate: options.marketState.setMarketChartHoverDate,
    setMarketChartHoverPrice: options.marketState.setMarketChartHoverPrice,
    setMarketChartLoading: options.marketState.setMarketChartLoading,
    setMarketTempTargets: options.marketState.setMarketTempTargets,
    setMarketTargetsPreview: options.marketState.setMarketTargetsPreview,
    setMarketSelectedTag: options.marketState.setMarketSelectedTag,
    setMarketTagMembers: options.marketState.setMarketTagMembers,
    setMarketChartBars: options.marketState.setMarketChartBars,
    setMarketTagMembersLoading: options.marketState.setMarketTagMembersLoading,
    setMarketDemoSeeding: options.marketState.setMarketDemoSeeding,
    setMarketUserTagDraft: options.marketState.setMarketUserTagDraft
  });

  const handleAddTargetTag = useCallback(
    (raw?: string) => {
      const tag = (raw ?? options.marketState.marketTargetsTagDraft).trim();
      if (!tag) return;
      if (!tag.includes(":")) {
        options.setError("标签必须包含命名空间，例如 industry:白酒。");
        return;
      }
      options.marketState.setMarketTargetsConfig((prev: MarketTargetsConfig) => {
        if (prev.tagFilters.includes(tag)) return prev;
        return { ...prev, tagFilters: [...prev.tagFilters, tag] };
      });
      options.setError(null);
      if (raw === undefined) options.marketState.setMarketTargetsTagDraft("");
    },
    [options.marketState, options.setError]
  );

  const {
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
    handleBatchExtendTempTargets
  } = useDashboardMarketTargetActions({
    marketTargetsConfig: options.marketState.marketTargetsConfig,
    marketTargetsSavedConfig: options.marketState.marketTargetsSavedConfig,
    marketTargetsSymbolDraft: options.marketState.marketTargetsSymbolDraft,
    marketManualSymbolPreview: options.marketState.marketManualSymbolPreview,
    marketSelectedTempTargetSymbols:
      options.marketState.marketSelectedTempTargetSymbols,
    marketTempTargets: options.marketState.marketTempTargets,
    toUserErrorMessage: options.toUserErrorMessage,
    refreshMarketTargets,
    refreshMarketTargetsDiff,
    setError: options.setError,
    setNotice: options.setNotice,
    setMarketTargetsConfig: options.marketState.setMarketTargetsConfig,
    setMarketTargetsSavedConfig: options.marketState.setMarketTargetsSavedConfig,
    setMarketTargetsSymbolDraft: options.marketState.setMarketTargetsSymbolDraft,
    setMarketManualSymbolPreview: options.marketState.setMarketManualSymbolPreview,
    setMarketTargetsDiffPreview: options.marketState.setMarketTargetsDiffPreview,
    setMarketTargetsPreview: options.marketState.setMarketTargetsPreview,
    setMarketTargetsSaving: options.marketState.setMarketTargetsSaving,
    setMarketTempTargets: options.marketState.setMarketTempTargets,
    setMarketTempTargetsLoading: options.marketState.setMarketTempTargetsLoading,
    setMarketSelectedTempTargetSymbols:
      options.marketState.setMarketSelectedTempTargetSymbols
  });

  const {
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
  } = useDashboardMarketManagementActions({
    marketSchedulerConfig: options.marketState.marketSchedulerConfig,
    marketIngestControlState: options.marketIngestControlState,
    marketIngestTriggering: options.marketState.marketIngestTriggering,
    marketRegistryResult: options.marketState.marketRegistryResult,
    marketRegistrySelectedSymbols: options.marketState.marketRegistrySelectedSymbols,
    toUserErrorMessage: options.toUserErrorMessage,
    handleTriggerMarketIngest,
    refreshMarketIngestRuns,
    refreshMarketRegistry,
    refreshMarketTargetsDiff,
    setError: options.setError,
    setNotice: options.setNotice,
    setMarketIngestControlStatus: options.marketState.setMarketIngestControlStatus,
    setMarketIngestControlUpdating:
      options.marketState.setMarketIngestControlUpdating,
    setMarketSchedulerConfig: options.marketState.setMarketSchedulerConfig,
    setMarketSchedulerSavedConfig: options.marketState.setMarketSchedulerSavedConfig,
    setMarketSchedulerSaving: options.marketState.setMarketSchedulerSaving,
    setMarketTriggerIngestBlockedOpen:
      options.marketState.setMarketTriggerIngestBlockedOpen,
    setMarketTriggerIngestBlockedMessage:
      options.marketState.setMarketTriggerIngestBlockedMessage,
    setMarketRegistrySelectedSymbols:
      options.marketState.setMarketRegistrySelectedSymbols,
    setMarketRegistryUpdating: options.marketState.setMarketRegistryUpdating
  });

  const restoreDataManagementView = useCallback(() => {
    options.setActiveView("other");
    options.setOtherTab("data-management");
  }, [options.setActiveView, options.setOtherTab]);

  useDashboardMarketRuntimeEffects({
    activeView: options.activeView,
    otherTab: options.otherTab,
    analysisInstrumentViewActive:
      options.activeView === "data-analysis" && options.analysisTab === "instrument",
    marketCategoryTab: options.marketState.marketCategoryTab,
    marketEffectiveScope: options.marketEffectiveScope,
    holdingsScopeValue: "holdings",
    searchScopeValue: "search",
    tagsScopeValue: "tags",
    holdingsSymbols: options.marketHoldingsSymbolsFiltered,
    searchSymbols: options.marketSearchResultSymbols,
    loadMarketQuotes,
    marketSelectedSymbol: options.marketState.marketSelectedSymbol,
    marketSelectedTag: options.marketState.marketSelectedTag,
    marketSearchQuery: options.marketState.marketSearchQuery,
    marketTagManagementQuery: options.marketState.marketTagManagementQuery,
    marketTagMembersCount: options.marketState.marketTagMembers.length,
    marketWatchlistCount: options.marketState.marketWatchlistItems.length,
    marketInstrumentDetailsOpen: options.marketState.marketInstrumentDetailsOpen,
    marketIngestRuns: options.marketState.marketIngestRuns,
    marketSelectedIngestRunId: options.marketState.marketSelectedIngestRunId,
    marketRegistryEntryEnabled: options.marketRegistryEntryEnabled,
    marketRegistryAutoFilter: options.marketState.marketRegistryAutoFilter,
    marketRegistryQuery: options.marketState.marketRegistryQuery,
    marketTargetsConfig: options.marketState.marketTargetsConfig,
    marketFocusTargetSymbols: options.marketFocusTargetSymbols,
    marketTargetsDirty: options.marketTargetsDirty,
    restoreDataManagementView,
    setMarketSelectedIngestRunId: options.marketState.setMarketSelectedIngestRunId,
    setMarketSelectedIngestRun: options.marketState.setMarketSelectedIngestRun,
    setMarketScope: options.marketState.setMarketScope,
    selectDefaultTag: handleSelectTag,
    refreshMarketTokenStatus,
    refreshMarketTargets,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketSchedulerConfig,
    refreshMarketUniversePool,
    refreshMarketRegistry,
    refreshMarketTargetsDiff,
    refreshMarketTargetPoolStats,
    refreshMarketUniversePoolOverview,
    refreshMarketWatchlist,
    refreshMarketTags,
    refreshManualThemeOptions,
    refreshMarketIngestRunDetail
  });

  return {
    refreshMarketWatchlist,
    refreshMarketTags,
    refreshManualThemeOptions,
    resetMarketFilters,
    loadMarketQuotes,
    refreshMarketTargets,
    refreshMarketTargetsDiff,
    refreshMarketTargetPoolStats,
    refreshMarketTokenStatus,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketSchedulerConfig,
    refreshMarketUniversePool,
    refreshMarketUniversePoolOverview,
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
  };
}
