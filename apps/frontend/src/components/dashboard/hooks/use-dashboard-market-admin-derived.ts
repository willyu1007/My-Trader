import { useMemo } from "react";

import type {
  InstrumentProfile,
  MarketIngestControlStatus,
  MarketIngestRun,
  MarketIngestSchedulerConfig,
  MarketTargetsConfig,
  MarketTokenStatus,
  MarketUniversePoolConfig,
  MarketUniversePoolOverview,
  MarketUniversePoolBucketStatus,
  PreviewTargetsDiffResult,
  PreviewTargetsResult,
  TargetReasonsDiff
} from "@mytrader/shared";

import type { TargetPoolStructureStats, UniversePoolBucketId } from "../types";
import {
  isSameSchedulerConfig,
  isSameTargetsConfig,
  isSameUniversePoolConfig
} from "../shared";

type ResolvedTargetSymbol = PreviewTargetsResult["symbols"][number];
type IngestControlState = NonNullable<MarketIngestControlStatus>["state"] | "idle";
type InstrumentTagFacets = NonNullable<InstrumentProfile["tagFacets"]>;

export interface UseDashboardMarketAdminDerivedOptions<
  TTargetPoolStatsScope extends string
> {
  marketIngestRuns: MarketIngestRun[];
  marketSelectedProfile: InstrumentProfile | null;
  marketSelectedUserTags: string[];
  marketTargetsSavedConfig: MarketTargetsConfig | null;
  marketTargetsConfig: MarketTargetsConfig;
  marketSchedulerConfig: MarketIngestSchedulerConfig | null;
  marketSchedulerSavedConfig: MarketIngestSchedulerConfig | null;
  marketUniversePoolConfig: MarketUniversePoolConfig | null;
  marketUniversePoolSavedConfig: MarketUniversePoolConfig | null;
  marketIngestControlStatus: MarketIngestControlStatus | null;
  marketIngestControlUpdating: boolean;
  marketTokenStatus: MarketTokenStatus | null;
  schedulerTimezoneDefaults: string[];
  marketTargetsDiffPreview: PreviewTargetsDiffResult | null;
  marketTargetsPreview: PreviewTargetsResult | null;
  marketCurrentTargetsFilter: string;
  marketTargetPoolStatsByScope: Record<
    TTargetPoolStatsScope,
    TargetPoolStructureStats
  >;
  marketTargetPoolStatsScope: TTargetPoolStatsScope;
  marketUniversePoolOverview: MarketUniversePoolOverview | null;
  universePoolBucketOrder: UniversePoolBucketId[];
}

export interface DashboardMarketAdminDerived {
  latestMarketIngestRun: MarketIngestRun | null;
  marketSelectedIndustry: InstrumentTagFacets["industry"];
  marketSelectedThemes: InstrumentTagFacets["themes"];
  marketSelectedManualThemes: string[];
  marketSelectedPlainUserTags: string[];
  marketTargetsDirty: boolean;
  marketSchedulerDirty: boolean;
  marketUniversePoolDirty: boolean;
  marketIngestControlState: IngestControlState;
  marketCanTriggerIngestNow: boolean;
  marketCanPauseIngest: boolean;
  marketCanResumeIngest: boolean;
  marketCanCancelIngest: boolean;
  marketSchedulerTimezoneOptions: Array<{ value: string; label: string }>;
  marketRegistryEntryEnabled: boolean;
  marketCurrentTargetsSource: ResolvedTargetSymbol[];
  marketFilteredCurrentTargets: ResolvedTargetSymbol[];
  marketFilteredAddedSymbols: ResolvedTargetSymbol[];
  marketFilteredRemovedSymbols: ResolvedTargetSymbol[];
  marketFilteredReasonChangedSymbols: TargetReasonsDiff[];
  marketFocusTargetSymbols: string[];
  marketActiveTargetPoolStats: TargetPoolStructureStats;
  marketUniverseEnabledBuckets: Set<UniversePoolBucketId>;
  marketUniverseBucketStatusById: Map<
    UniversePoolBucketId,
    MarketUniversePoolBucketStatus
  >;
}

export function useDashboardMarketAdminDerived<
  TTargetPoolStatsScope extends string
>(
  options: UseDashboardMarketAdminDerivedOptions<TTargetPoolStatsScope>
): DashboardMarketAdminDerived {
  const latestMarketIngestRun = useMemo(() => {
    if (options.marketIngestRuns.length === 0) return null;
    return options.marketIngestRuns.reduce((latest, candidate) =>
      candidate.startedAt > latest.startedAt ? candidate : latest
    );
  }, [options.marketIngestRuns]);

  const marketSelectedIndustry =
    options.marketSelectedProfile?.tagFacets?.industry ?? [];
  const marketSelectedThemes =
    options.marketSelectedProfile?.tagFacets?.themes ?? [];

  const marketSelectedManualThemes = useMemo(
    () =>
      options.marketSelectedUserTags.filter((tag) =>
        tag.startsWith("theme:manual:")
      ),
    [options.marketSelectedUserTags]
  );
  const marketSelectedPlainUserTags = useMemo(
    () =>
      options.marketSelectedUserTags.filter(
        (tag) => !tag.startsWith("theme:manual:")
      ),
    [options.marketSelectedUserTags]
  );

  const marketTargetsDirty = useMemo(() => {
    if (!options.marketTargetsSavedConfig) return false;
    return !isSameTargetsConfig(
      options.marketTargetsSavedConfig,
      options.marketTargetsConfig
    );
  }, [options.marketTargetsConfig, options.marketTargetsSavedConfig]);

  const marketSchedulerDirty = useMemo(() => {
    if (!options.marketSchedulerConfig || !options.marketSchedulerSavedConfig) {
      return false;
    }
    return !isSameSchedulerConfig(
      options.marketSchedulerSavedConfig,
      options.marketSchedulerConfig
    );
  }, [options.marketSchedulerConfig, options.marketSchedulerSavedConfig]);

  const marketUniversePoolDirty = useMemo(() => {
    if (!options.marketUniversePoolConfig || !options.marketUniversePoolSavedConfig) {
      return false;
    }
    return !isSameUniversePoolConfig(
      options.marketUniversePoolSavedConfig,
      options.marketUniversePoolConfig
    );
  }, [options.marketUniversePoolConfig, options.marketUniversePoolSavedConfig]);

  const marketIngestControlState: IngestControlState =
    options.marketIngestControlStatus?.state ?? "idle";
  const marketCanTriggerIngestNow = !options.marketIngestControlUpdating;
  const marketCanPauseIngest =
    !options.marketIngestControlUpdating && marketIngestControlState === "running";
  const marketCanResumeIngest =
    !options.marketIngestControlUpdating && marketIngestControlState === "paused";
  const marketCanCancelIngest =
    !options.marketIngestControlUpdating &&
    (marketIngestControlState === "running" ||
      marketIngestControlState === "paused");

  const marketSchedulerTimezoneOptions = useMemo(() => {
    const values = [...options.schedulerTimezoneDefaults];
    const current = options.marketSchedulerConfig?.timezone?.trim();
    if (current && !values.includes(current)) {
      values.unshift(current);
    }
    return values.map((value) => ({ value, label: value }));
  }, [options.marketSchedulerConfig?.timezone, options.schedulerTimezoneDefaults]);

  const marketRegistryEntryEnabled = false;

  const marketCurrentTargetsSource = useMemo(
    () =>
      options.marketTargetsDiffPreview?.draft.symbols ??
      options.marketTargetsPreview?.symbols ??
      [],
    [
      options.marketTargetsDiffPreview?.draft.symbols,
      options.marketTargetsPreview?.symbols
    ]
  );

  const marketCurrentTargetsKeyword = options.marketCurrentTargetsFilter
    .trim()
    .toLowerCase();

  const marketFilteredCurrentTargets = useMemo(() => {
    if (!marketCurrentTargetsKeyword) return marketCurrentTargetsSource;
    return marketCurrentTargetsSource.filter((row) =>
      row.symbol.toLowerCase().includes(marketCurrentTargetsKeyword)
    );
  }, [marketCurrentTargetsKeyword, marketCurrentTargetsSource]);

  const marketFilteredAddedSymbols = useMemo(
    () => options.marketTargetsDiffPreview?.addedSymbols ?? [],
    [options.marketTargetsDiffPreview?.addedSymbols]
  );

  const marketFilteredRemovedSymbols = useMemo(
    () => options.marketTargetsDiffPreview?.removedSymbols ?? [],
    [options.marketTargetsDiffPreview?.removedSymbols]
  );

  const marketFilteredReasonChangedSymbols = useMemo(
    () => options.marketTargetsDiffPreview?.reasonChangedSymbols ?? [],
    [options.marketTargetsDiffPreview?.reasonChangedSymbols]
  );

  const marketFocusTargetSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          (
            options.marketTargetsDiffPreview?.draft.symbols ??
            options.marketTargetsPreview?.symbols ??
            []
          )
            .map((item) => item.symbol.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [
      options.marketTargetsDiffPreview?.draft.symbols,
      options.marketTargetsPreview?.symbols
    ]
  );

  const marketActiveTargetPoolStats = useMemo(
    () =>
      options.marketTargetPoolStatsByScope[options.marketTargetPoolStatsScope],
    [options.marketTargetPoolStatsByScope, options.marketTargetPoolStatsScope]
  );

  const marketUniverseEnabledBuckets = useMemo(() => {
    const source =
      options.marketUniversePoolConfig?.enabledBuckets ??
      options.universePoolBucketOrder;
    return new Set<UniversePoolBucketId>(source);
  }, [
    options.marketUniversePoolConfig?.enabledBuckets,
    options.universePoolBucketOrder
  ]);

  const marketUniverseBucketStatusById = useMemo(() => {
    const map = new Map<UniversePoolBucketId, MarketUniversePoolBucketStatus>();
    options.marketUniversePoolOverview?.buckets.forEach((item) =>
      map.set(item.bucket, item)
    );
    return map;
  }, [options.marketUniversePoolOverview?.buckets]);

  return {
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
  };
}
