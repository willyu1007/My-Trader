import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  AssetClass,
  InstrumentKind,
  InstrumentProfile,
  InstrumentProfileSummary,
  ListInstrumentRegistryResult,
  MarketDailyBar,
  MarketIngestControlStatus,
  MarketIngestSchedulerConfig,
  MarketIngestRun,
  MarketQuote,
  MarketTagSeriesResult,
  MarketTargetsConfig,
  MarketTokenStatus,
  MarketUniversePoolConfig,
  MarketUniversePoolOverview,
  PreviewTargetsDiffResult,
  PreviewTargetsResult,
  TempTargetSymbol,
  TagSummary,
  WatchlistItem
} from "@mytrader/shared";

import type { PopoverSelectOption } from "../shared";

export interface UseDashboardMarketOptions<
  TMarketScope extends string,
  TMarketFilterMarket extends string,
  TMarketChartRangeKey extends string,
  TTargetPoolStatsScope extends string,
  TTargetPoolStructureStats
> {
  clampNumber: (value: number, min: number, max: number) => number;
  defaultMarketScope: TMarketScope;
  defaultMarketFilterMarket: TMarketFilterMarket;
  defaultMarketChartRange: TMarketChartRangeKey;
  defaultTokenProvider: string;
  marketExplorerDefaultWidth: number;
  marketExplorerMinWidth: number;
  marketExplorerMaxWidth: number;
  marketExplorerStorageKey: string;
  targetsEditorSplitDefault: number;
  targetsEditorSplitMin: number;
  targetsEditorSplitMax: number;
  targetsEditorSplitStorageKey: string;
  defaultTargetsConfig: MarketTargetsConfig;
  defaultManualSymbolPreview: {
    addable: string[];
    existing: string[];
    invalid: string[];
    duplicates: number;
  };
  defaultTargetsSectionOpen: {
    scope: boolean;
    symbols: boolean;
  };
  defaultDiffSectionOpen: {
    added: boolean;
    removed: boolean;
    reasonChanged: boolean;
  };
  defaultTargetPoolStatsScope: TTargetPoolStatsScope;
  defaultTargetPoolStatsByScope: Record<
    TTargetPoolStatsScope,
    TTargetPoolStructureStats
  >;
  defaultRegistryAutoFilter: "all" | "enabled" | "disabled";
  activeView: string;
  snapshotPriceAsOf: string | null | undefined;
  toUserErrorMessage: (err: unknown) => string;
  reportError: (message: string) => void;
  resolveMarketChartDateRange: (
    range: TMarketChartRangeKey,
    endDate: string
  ) => { startDate: string; endDate: string };
  formatInputDate: (value: Date) => string;
}

export function useDashboardMarket<
  TMarketScope extends string,
  TMarketFilterMarket extends string,
  TMarketChartRangeKey extends string,
  TTargetPoolStatsScope extends string,
  TTargetPoolStructureStats
>(
  options: UseDashboardMarketOptions<
    TMarketScope,
    TMarketFilterMarket,
    TMarketChartRangeKey,
    TTargetPoolStatsScope,
    TTargetPoolStructureStats
  >
) {
  const [marketCatalogSyncing, setMarketCatalogSyncing] = useState(false);
  const [marketCatalogSyncSummary, setMarketCatalogSyncSummary] = useState<
    string | null
  >(null);

  const [marketSearchQuery, setMarketSearchQuery] = useState("");
  const [marketSearchResults, setMarketSearchResults] = useState<
    InstrumentProfileSummary[]
  >([]);
  const [marketSearchLoading, setMarketSearchLoading] = useState(false);

  const [marketScope, setMarketScope] = useState<TMarketScope>(
    options.defaultMarketScope
  );
  const [marketExplorerWidth, setMarketExplorerWidth] = useState<number>(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return options.marketExplorerDefaultWidth;
    }
    try {
      const raw = window.localStorage.getItem(options.marketExplorerStorageKey);
      const value = raw ? Number(raw) : NaN;
      if (!Number.isFinite(value)) return options.marketExplorerDefaultWidth;
      return options.clampNumber(
        value,
        options.marketExplorerMinWidth,
        options.marketExplorerMaxWidth
      );
    } catch {
      return options.marketExplorerDefaultWidth;
    }
  });
  const [targetsEditorLeftPct, setTargetsEditorLeftPct] = useState<number>(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return options.targetsEditorSplitDefault;
    }
    try {
      const raw = window.localStorage.getItem(options.targetsEditorSplitStorageKey);
      const value = raw ? Number(raw) : NaN;
      if (!Number.isFinite(value)) return options.targetsEditorSplitDefault;
      return options.clampNumber(
        value,
        options.targetsEditorSplitMin,
        options.targetsEditorSplitMax
      );
    } catch {
      return options.targetsEditorSplitDefault;
    }
  });

  const [marketTags, setMarketTags] = useState<TagSummary[]>([]);
  const [marketTagsLoading, setMarketTagsLoading] = useState(false);
  const [marketTagPickerOpen, setMarketTagPickerOpen] = useState(false);
  const [marketTagPickerQuery, setMarketTagPickerQuery] = useState("");

  const [marketSelectedTag, setMarketSelectedTag] = useState<string | null>(null);
  const [marketTagMembers, setMarketTagMembers] = useState<string[]>([]);
  const [marketTagMembersLoading, setMarketTagMembersLoading] = useState(false);

  const [marketFiltersOpen, setMarketFiltersOpen] = useState(false);
  const [marketFilterMarket, setMarketFilterMarket] =
    useState<TMarketFilterMarket>(options.defaultMarketFilterMarket);
  const [marketFilterAssetClasses, setMarketFilterAssetClasses] = useState<
    AssetClass[]
  >([]);
  const [marketFilterKinds, setMarketFilterKinds] = useState<InstrumentKind[]>(
    []
  );

  const [marketQuotesBySymbol, setMarketQuotesBySymbol] = useState<
    Record<string, MarketQuote>
  >({});
  const [marketQuotesLoading, setMarketQuotesLoading] = useState(false);

  const [marketChartRange, setMarketChartRange] = useState<TMarketChartRangeKey>(
    options.defaultMarketChartRange
  );
  const [marketChartBars, setMarketChartBars] = useState<MarketDailyBar[]>([]);
  const [marketChartLoading, setMarketChartLoading] = useState(false);
  const [marketVolumeMode, setMarketVolumeMode] = useState<
    "volume" | "moneyflow"
  >("volume");

  const [marketDemoSeeding, setMarketDemoSeeding] = useState(false);

  const [marketTagSeriesResult, setMarketTagSeriesResult] =
    useState<MarketTagSeriesResult | null>(null);
  const [marketTagSeriesBars, setMarketTagSeriesBars] = useState<
    MarketDailyBar[]
  >([]);
  const [marketTagSeriesLoading, setMarketTagSeriesLoading] = useState(false);
  const [marketTagSeriesError, setMarketTagSeriesError] = useState<string | null>(
    null
  );
  const [marketTagChartHoverDate, setMarketTagChartHoverDate] = useState<
    string | null
  >(null);
  const [marketTagChartHoverPrice, setMarketTagChartHoverPrice] = useState<
    number | null
  >(null);

  const [marketInstrumentDetailsOpen, setMarketInstrumentDetailsOpen] =
    useState(false);
  const [marketTagMembersModalOpen, setMarketTagMembersModalOpen] =
    useState(false);
  const [marketTokenStatus, setMarketTokenStatus] =
    useState<MarketTokenStatus | null>(null);
  const [marketTokenDraft, setMarketTokenDraft] = useState("");
  const [marketTokenProvider, setMarketTokenProvider] = useState(
    options.defaultTokenProvider
  );
  const [marketTokenSaving, setMarketTokenSaving] = useState(false);
  const [marketTokenTesting, setMarketTokenTesting] = useState(false);
  const [marketIngestRuns, setMarketIngestRuns] = useState<MarketIngestRun[]>([]);
  const [marketIngestRunsLoading, setMarketIngestRunsLoading] = useState(false);
  const [marketIngestTriggering, setMarketIngestTriggering] = useState(false);

  const [marketSelectedSymbol, setMarketSelectedSymbol] = useState<string | null>(
    null
  );
  const [marketSelectedProfile, setMarketSelectedProfile] =
    useState<InstrumentProfile | null>(null);
  const [marketSelectedUserTags, setMarketSelectedUserTags] = useState<string[]>(
    []
  );
  const [marketUserTagDraft, setMarketUserTagDraft] = useState("");
  const [marketShowProviderData, setMarketShowProviderData] = useState(false);
  const [marketManualThemeOptions, setMarketManualThemeOptions] = useState<
    PopoverSelectOption[]
  >([]);
  const [marketManualThemeLoading, setMarketManualThemeLoading] = useState(false);
  const [marketManualThemeDraft, setMarketManualThemeDraft] = useState("");

  const [marketWatchlistItems, setMarketWatchlistItems] = useState<
    WatchlistItem[]
  >([]);
  const [marketWatchlistLoading, setMarketWatchlistLoading] = useState(false);
  const [marketWatchlistGroupDraft, setMarketWatchlistGroupDraft] = useState("");

  const [marketTargetsConfig, setMarketTargetsConfig] =
    useState<MarketTargetsConfig>(() => ({
      ...options.defaultTargetsConfig
    }));
  const [marketTargetsSavedConfig, setMarketTargetsSavedConfig] =
    useState<MarketTargetsConfig | null>(null);
  const [marketTargetsPreview, setMarketTargetsPreview] =
    useState<PreviewTargetsResult | null>(null);
  const [marketTargetsDiffPreview, setMarketTargetsDiffPreview] =
    useState<PreviewTargetsDiffResult | null>(null);
  const [marketTargetsLoading, setMarketTargetsLoading] = useState(false);
  const [marketTargetsSaving, setMarketTargetsSaving] = useState(false);
  const [marketTargetsSymbolDraft, setMarketTargetsSymbolDraft] = useState("");
  const [marketManualSymbolPreview, setMarketManualSymbolPreview] = useState(
    options.defaultManualSymbolPreview
  );
  const [marketTargetsTagDraft, setMarketTargetsTagDraft] = useState("");
  const [marketTagManagementQuery, setMarketTagManagementQuery] = useState("");
  const [marketCurrentTargetsModalOpen, setMarketCurrentTargetsModalOpen] =
    useState(false);
  const [marketCurrentTargetsFilter, setMarketCurrentTargetsFilter] = useState("");
  const [marketTargetPoolDetailMetric, setMarketTargetPoolDetailMetric] =
    useState<string | null>(null);
  const [marketTargetPoolDetailCategoryKey, setMarketTargetPoolDetailCategoryKey] =
    useState<string | null>(null);
  const [marketTargetPoolDetailMemberFilter, setMarketTargetPoolDetailMemberFilter] =
    useState("");
  const [marketTargetsSectionOpen, setMarketTargetsSectionOpen] = useState(
    options.defaultTargetsSectionOpen
  );
  const [marketDiffSectionOpen, setMarketDiffSectionOpen] = useState(
    options.defaultDiffSectionOpen
  );
  const [marketTargetPoolStatsScope, setMarketTargetPoolStatsScope] =
    useState<TTargetPoolStatsScope>(options.defaultTargetPoolStatsScope);
  const [marketTargetPoolStatsByScope, setMarketTargetPoolStatsByScope] =
    useState<Record<TTargetPoolStatsScope, TTargetPoolStructureStats>>(
      options.defaultTargetPoolStatsByScope
    );
  const [marketTempTargets, setMarketTempTargets] = useState<TempTargetSymbol[]>(
    []
  );
  const [marketTempTargetsLoading, setMarketTempTargetsLoading] = useState(false);
  const [marketSelectedTempTargetSymbols, setMarketSelectedTempTargetSymbols] =
    useState<string[]>([]);
  const [marketIngestControlStatus, setMarketIngestControlStatus] =
    useState<MarketIngestControlStatus | null>(null);
  const [marketIngestControlUpdating, setMarketIngestControlUpdating] =
    useState(false);
  const [marketSchedulerConfig, setMarketSchedulerConfig] =
    useState<MarketIngestSchedulerConfig | null>(null);
  const [marketSchedulerSavedConfig, setMarketSchedulerSavedConfig] =
    useState<MarketIngestSchedulerConfig | null>(null);
  const [marketSchedulerLoading, setMarketSchedulerLoading] = useState(false);
  const [marketSchedulerSaving, setMarketSchedulerSaving] = useState(false);
  const [marketUniversePoolConfig, setMarketUniversePoolConfig] =
    useState<MarketUniversePoolConfig | null>(null);
  const [marketUniversePoolSavedConfig, setMarketUniversePoolSavedConfig] =
    useState<MarketUniversePoolConfig | null>(null);
  const [marketUniversePoolOverview, setMarketUniversePoolOverview] =
    useState<MarketUniversePoolOverview | null>(null);
  const [marketUniversePoolLoading, setMarketUniversePoolLoading] = useState(false);
  const [marketUniversePoolSaving, setMarketUniversePoolSaving] = useState(false);
  const [marketSchedulerAdvancedOpen, setMarketSchedulerAdvancedOpen] =
    useState(false);
  const [marketTriggerIngestBlockedOpen, setMarketTriggerIngestBlockedOpen] =
    useState(false);
  const [marketTriggerIngestBlockedMessage, setMarketTriggerIngestBlockedMessage] =
    useState("");
  const [marketRegistryResult, setMarketRegistryResult] =
    useState<ListInstrumentRegistryResult | null>(null);
  const [marketRegistryLoading, setMarketRegistryLoading] = useState(false);
  const [marketRegistryQuery, setMarketRegistryQuery] = useState("");
  const [marketRegistryAutoFilter, setMarketRegistryAutoFilter] = useState<
    "all" | "enabled" | "disabled"
  >(options.defaultRegistryAutoFilter);
  const [marketRegistrySelectedSymbols, setMarketRegistrySelectedSymbols] =
    useState<string[]>([]);
  const [marketRegistryUpdating, setMarketRegistryUpdating] = useState(false);
  const [marketSelectedIngestRunId, setMarketSelectedIngestRunId] = useState<
    string | null
  >(null);
  const [marketSelectedIngestRun, setMarketSelectedIngestRun] =
    useState<MarketIngestRun | null>(null);
  const [marketSelectedIngestRunLoading, setMarketSelectedIngestRunLoading] =
    useState(false);

  const [marketChartHoverDate, setMarketChartHoverDate] = useState<string | null>(
    null
  );
  const [marketChartHoverPrice, setMarketChartHoverPrice] = useState<
    number | null
  >(null);
  const marketSearchTimerRef = useRef<number | null>(null);
  const marketSearchRequestIdRef = useRef(0);
  const marketTagSeriesRequestIdRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        options.marketExplorerStorageKey,
        String(marketExplorerWidth)
      );
    } catch {
      // ignore
    }
  }, [marketExplorerWidth, options.marketExplorerStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        options.targetsEditorSplitStorageKey,
        String(targetsEditorLeftPct)
      );
    } catch {
      // ignore
    }
  }, [targetsEditorLeftPct, options.targetsEditorSplitStorageKey]);

  useEffect(() => {
    setMarketChartHoverDate(null);
    setMarketChartHoverPrice(null);
  }, [marketSelectedSymbol]);

  useEffect(() => {
    setMarketTagChartHoverDate(null);
    setMarketTagChartHoverPrice(null);
  }, [marketSelectedTag, marketChartRange]);

  useEffect(() => {
    const symbolSet = new Set(marketTempTargets.map((item) => item.symbol));
    setMarketSelectedTempTargetSymbols((prev) =>
      prev.filter((symbol) => symbolSet.has(symbol))
    );
  }, [marketTempTargets]);

  useEffect(() => {
    if (options.activeView !== "market") return;
    if (!window.mytrader) return;
    const query = marketSearchQuery.trim();
    if (!query) {
      setMarketSearchResults((prev) => (prev.length === 0 ? prev : []));
      setMarketSearchLoading((prev) => (prev ? false : prev));
      return;
    }

    setMarketSearchLoading(true);
    const requestId = marketSearchRequestIdRef.current + 1;
    marketSearchRequestIdRef.current = requestId;

    if (marketSearchTimerRef.current !== null) {
      window.clearTimeout(marketSearchTimerRef.current);
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await window.mytrader!.market.searchInstruments({
            query,
            limit: 50
          });
          if (marketSearchRequestIdRef.current !== requestId) return;
          setMarketSearchResults(results);
        } catch (err) {
          if (marketSearchRequestIdRef.current !== requestId) return;
          options.reportError(options.toUserErrorMessage(err));
          setMarketSearchResults([]);
        } finally {
          if (marketSearchRequestIdRef.current === requestId) {
            setMarketSearchLoading(false);
          }
        }
      })();
    }, 250);

    marketSearchTimerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [
    marketSearchQuery,
    options.activeView,
    options.reportError,
    options.toUserErrorMessage
  ]);

  useEffect(() => {
    if (options.activeView !== "market") return;
    if (!marketTagPickerOpen) return;
    if (!window.mytrader) return;
    const query = marketTagPickerQuery.trim();
    setMarketTagsLoading(true);
    void (async () => {
      try {
        const tags = await window.mytrader!.market.listTags({
          query: query ? query : null,
          limit: 200
        });
        setMarketTags(tags);
      } catch (err) {
        options.reportError(options.toUserErrorMessage(err));
        setMarketTags([]);
      } finally {
        setMarketTagsLoading(false);
      }
    })();
  }, [
    marketTagPickerOpen,
    marketTagPickerQuery,
    options.activeView,
    options.reportError,
    options.toUserErrorMessage
  ]);

  useEffect(() => {
    if (options.activeView !== "market") return;
    if (!window.mytrader) return;

    const marketEffectiveScope = marketSearchQuery.trim().length > 0 ? "search" : marketScope;
    if (marketEffectiveScope !== "tags") {
      setMarketTagSeriesError(null);
      setMarketTagSeriesResult(null);
      setMarketTagSeriesBars([]);
      setMarketTagSeriesLoading(false);
      return;
    }

    if (!marketSelectedTag || marketSelectedSymbol) {
      setMarketTagSeriesError(null);
      setMarketTagSeriesResult(null);
      setMarketTagSeriesBars([]);
      setMarketTagSeriesLoading(false);
      return;
    }

    const endDate = options.snapshotPriceAsOf ?? options.formatInputDate(new Date());
    const { startDate, endDate: resolvedEndDate } = options.resolveMarketChartDateRange(
      marketChartRange,
      endDate
    );

    const requestId = (marketTagSeriesRequestIdRef.current += 1);
    setMarketTagSeriesLoading(true);
    setMarketTagSeriesError(null);
    void (async () => {
      try {
        const result = await window.mytrader!.market.getTagSeries({
          tag: marketSelectedTag,
          startDate,
          endDate: resolvedEndDate,
          memberLimit: 300
        });
        if (marketTagSeriesRequestIdRef.current !== requestId) return;
        setMarketTagSeriesResult(result);
        setMarketTagSeriesBars(
          result.points.map((point) => ({
            date: point.date,
            open: null,
            high: null,
            low: null,
            close: point.value,
            volume: null
          }))
        );
      } catch (err) {
        if (marketTagSeriesRequestIdRef.current !== requestId) return;
        setMarketTagSeriesError(options.toUserErrorMessage(err));
        setMarketTagSeriesResult(null);
        setMarketTagSeriesBars([]);
      } finally {
        if (marketTagSeriesRequestIdRef.current !== requestId) return;
        setMarketTagSeriesLoading(false);
      }
    })();
  }, [
    marketChartRange,
    marketScope,
    marketSearchQuery,
    marketSelectedSymbol,
    marketSelectedTag,
    options.activeView,
    options.formatInputDate,
    options.resolveMarketChartDateRange,
    options.snapshotPriceAsOf,
    options.toUserErrorMessage
  ]);

  useEffect(() => {
    if (options.activeView !== "market") return;
    if (!window.mytrader) return;
    if (!marketSelectedSymbol) return;

    const quote = marketQuotesBySymbol[marketSelectedSymbol];
    const endDate = quote?.tradeDate ?? options.formatInputDate(new Date());
    const { startDate, endDate: resolvedEndDate } = options.resolveMarketChartDateRange(
      marketChartRange,
      endDate
    );

    setMarketChartLoading(true);
    void (async () => {
      try {
        const bars = await window.mytrader!.market.getDailyBars({
          symbol: marketSelectedSymbol,
          startDate,
          endDate: resolvedEndDate,
          includeMoneyflow: marketVolumeMode === "moneyflow"
        });
        setMarketChartBars(bars);
      } catch (err) {
        options.reportError(options.toUserErrorMessage(err));
        setMarketChartBars([]);
      } finally {
        setMarketChartLoading(false);
      }
    })();
  }, [
    marketChartRange,
    marketQuotesBySymbol,
    marketSelectedSymbol,
    marketVolumeMode,
    options.activeView,
    options.formatInputDate,
    options.reportError,
    options.resolveMarketChartDateRange,
    options.toUserErrorMessage
  ]);

  return {
    marketCatalogSyncing,
    setMarketCatalogSyncing,
    marketCatalogSyncSummary,
    setMarketCatalogSyncSummary,
    marketSearchQuery,
    setMarketSearchQuery,
    marketSearchResults,
    setMarketSearchResults,
    marketSearchLoading,
    setMarketSearchLoading,
    marketScope,
    setMarketScope,
    marketExplorerWidth,
    setMarketExplorerWidth,
    targetsEditorLeftPct,
    setTargetsEditorLeftPct,
    marketTags,
    setMarketTags,
    marketTagsLoading,
    setMarketTagsLoading,
    marketTagPickerOpen,
    setMarketTagPickerOpen,
    marketTagPickerQuery,
    setMarketTagPickerQuery,
    marketSelectedTag,
    setMarketSelectedTag,
    marketTagMembers,
    setMarketTagMembers,
    marketTagMembersLoading,
    setMarketTagMembersLoading,
    marketFiltersOpen,
    setMarketFiltersOpen,
    marketFilterMarket,
    setMarketFilterMarket,
    marketFilterAssetClasses,
    setMarketFilterAssetClasses,
    marketFilterKinds,
    setMarketFilterKinds,
    marketQuotesBySymbol,
    setMarketQuotesBySymbol,
    marketQuotesLoading,
    setMarketQuotesLoading,
    marketChartRange,
    setMarketChartRange,
    marketChartBars,
    setMarketChartBars,
    marketChartLoading,
    setMarketChartLoading,
    marketVolumeMode,
    setMarketVolumeMode,
    marketDemoSeeding,
    setMarketDemoSeeding,
    marketTagSeriesResult,
    setMarketTagSeriesResult,
    marketTagSeriesBars,
    setMarketTagSeriesBars,
    marketTagSeriesLoading,
    setMarketTagSeriesLoading,
    marketTagSeriesError,
    setMarketTagSeriesError,
    marketTagChartHoverDate,
    setMarketTagChartHoverDate,
    marketTagChartHoverPrice,
    setMarketTagChartHoverPrice,
    marketInstrumentDetailsOpen,
    setMarketInstrumentDetailsOpen,
    marketTagMembersModalOpen,
    setMarketTagMembersModalOpen,
    marketTokenStatus,
    setMarketTokenStatus,
    marketTokenDraft,
    setMarketTokenDraft,
    marketTokenProvider,
    setMarketTokenProvider,
    marketTokenSaving,
    setMarketTokenSaving,
    marketTokenTesting,
    setMarketTokenTesting,
    marketIngestRuns,
    setMarketIngestRuns,
    marketIngestRunsLoading,
    setMarketIngestRunsLoading,
    marketIngestTriggering,
    setMarketIngestTriggering,
    marketSelectedSymbol,
    setMarketSelectedSymbol,
    marketSelectedProfile,
    setMarketSelectedProfile,
    marketSelectedUserTags,
    setMarketSelectedUserTags,
    marketUserTagDraft,
    setMarketUserTagDraft,
    marketShowProviderData,
    setMarketShowProviderData,
    marketManualThemeOptions,
    setMarketManualThemeOptions,
    marketManualThemeLoading,
    setMarketManualThemeLoading,
    marketManualThemeDraft,
    setMarketManualThemeDraft,
    marketWatchlistItems,
    setMarketWatchlistItems,
    marketWatchlistLoading,
    setMarketWatchlistLoading,
    marketWatchlistGroupDraft,
    setMarketWatchlistGroupDraft,
    marketTargetsConfig,
    setMarketTargetsConfig,
    marketTargetsSavedConfig,
    setMarketTargetsSavedConfig,
    marketTargetsPreview,
    setMarketTargetsPreview,
    marketTargetsDiffPreview,
    setMarketTargetsDiffPreview,
    marketTargetsLoading,
    setMarketTargetsLoading,
    marketTargetsSaving,
    setMarketTargetsSaving,
    marketTargetsSymbolDraft,
    setMarketTargetsSymbolDraft,
    marketManualSymbolPreview,
    setMarketManualSymbolPreview,
    marketTargetsTagDraft,
    setMarketTargetsTagDraft,
    marketTagManagementQuery,
    setMarketTagManagementQuery,
    marketCurrentTargetsModalOpen,
    setMarketCurrentTargetsModalOpen,
    marketCurrentTargetsFilter,
    setMarketCurrentTargetsFilter,
    marketTargetPoolDetailMetric,
    setMarketTargetPoolDetailMetric,
    marketTargetPoolDetailCategoryKey,
    setMarketTargetPoolDetailCategoryKey,
    marketTargetPoolDetailMemberFilter,
    setMarketTargetPoolDetailMemberFilter,
    marketTargetsSectionOpen,
    setMarketTargetsSectionOpen,
    marketDiffSectionOpen,
    setMarketDiffSectionOpen,
    marketTargetPoolStatsScope,
    setMarketTargetPoolStatsScope,
    marketTargetPoolStatsByScope,
    setMarketTargetPoolStatsByScope,
    marketTempTargets,
    setMarketTempTargets,
    marketTempTargetsLoading,
    setMarketTempTargetsLoading,
    marketSelectedTempTargetSymbols,
    setMarketSelectedTempTargetSymbols,
    marketIngestControlStatus,
    setMarketIngestControlStatus,
    marketIngestControlUpdating,
    setMarketIngestControlUpdating,
    marketSchedulerConfig,
    setMarketSchedulerConfig,
    marketSchedulerSavedConfig,
    setMarketSchedulerSavedConfig,
    marketSchedulerLoading,
    setMarketSchedulerLoading,
    marketSchedulerSaving,
    setMarketSchedulerSaving,
    marketUniversePoolConfig,
    setMarketUniversePoolConfig,
    marketUniversePoolSavedConfig,
    setMarketUniversePoolSavedConfig,
    marketUniversePoolOverview,
    setMarketUniversePoolOverview,
    marketUniversePoolLoading,
    setMarketUniversePoolLoading,
    marketUniversePoolSaving,
    setMarketUniversePoolSaving,
    marketSchedulerAdvancedOpen,
    setMarketSchedulerAdvancedOpen,
    marketTriggerIngestBlockedOpen,
    setMarketTriggerIngestBlockedOpen,
    marketTriggerIngestBlockedMessage,
    setMarketTriggerIngestBlockedMessage,
    marketRegistryResult,
    setMarketRegistryResult,
    marketRegistryLoading,
    setMarketRegistryLoading,
    marketRegistryQuery,
    setMarketRegistryQuery,
    marketRegistryAutoFilter,
    setMarketRegistryAutoFilter,
    marketRegistrySelectedSymbols,
    setMarketRegistrySelectedSymbols,
    marketRegistryUpdating,
    setMarketRegistryUpdating,
    marketSelectedIngestRunId,
    setMarketSelectedIngestRunId,
    marketSelectedIngestRun,
    setMarketSelectedIngestRun,
    marketSelectedIngestRunLoading,
    setMarketSelectedIngestRunLoading,
    marketChartHoverDate,
    setMarketChartHoverDate,
    marketChartHoverPrice,
    setMarketChartHoverPrice
  };
}

export interface UseDashboardMarketManagementActionsOptions {
  marketSchedulerConfig: MarketIngestSchedulerConfig | null;
  marketIngestControlState: MarketIngestControlStatus["state"] | "idle";
  marketIngestTriggering: boolean;
  marketRegistryResult: ListInstrumentRegistryResult | null;
  marketRegistrySelectedSymbols: string[];
  toUserErrorMessage: (err: unknown) => string;
  handleTriggerMarketIngest: (scope: "targets" | "universe" | "both") => Promise<void>;
  refreshMarketIngestRuns: () => Promise<void>;
  refreshMarketRegistry: () => Promise<void>;
  refreshMarketTargetsDiff: () => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setMarketIngestControlStatus: Dispatch<
    SetStateAction<MarketIngestControlStatus | null>
  >;
  setMarketIngestControlUpdating: Dispatch<SetStateAction<boolean>>;
  setMarketSchedulerConfig: Dispatch<
    SetStateAction<MarketIngestSchedulerConfig | null>
  >;
  setMarketSchedulerSavedConfig: Dispatch<
    SetStateAction<MarketIngestSchedulerConfig | null>
  >;
  setMarketSchedulerSaving: Dispatch<SetStateAction<boolean>>;
  setMarketTriggerIngestBlockedOpen: Dispatch<SetStateAction<boolean>>;
  setMarketTriggerIngestBlockedMessage: Dispatch<SetStateAction<string>>;
  setMarketRegistrySelectedSymbols: Dispatch<SetStateAction<string[]>>;
  setMarketRegistryUpdating: Dispatch<SetStateAction<boolean>>;
}

export function useDashboardMarketManagementActions(
  options: UseDashboardMarketManagementActionsOptions
) {
  const handlePauseMarketIngest = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketIngestControlUpdating(true);
    options.setError(null);
    try {
      const status = await window.mytrader.market.pauseIngest();
      options.setMarketIngestControlStatus(status);
      options.setNotice("已暂停自动拉取。");
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketIngestControlUpdating(false);
    }
  }, [
    options.setError,
    options.setMarketIngestControlStatus,
    options.setMarketIngestControlUpdating,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleResumeMarketIngest = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketIngestControlUpdating(true);
    options.setError(null);
    try {
      const status = await window.mytrader.market.resumeIngest();
      options.setMarketIngestControlStatus(status);
      options.setNotice("已继续执行当前拉取任务。");
      await options.refreshMarketIngestRuns();
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketIngestControlUpdating(false);
    }
  }, [
    options.refreshMarketIngestRuns,
    options.setError,
    options.setMarketIngestControlStatus,
    options.setMarketIngestControlUpdating,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleCancelMarketIngest = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketIngestControlUpdating(true);
    options.setError(null);
    try {
      const status = await window.mytrader.market.cancelIngest();
      options.setMarketIngestControlStatus(status);
      options.setNotice("已请求取消当前拉取任务。");
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketIngestControlUpdating(false);
    }
  }, [
    options.setError,
    options.setMarketIngestControlStatus,
    options.setMarketIngestControlUpdating,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const updateMarketSchedulerConfig = useCallback(
    (patch: Partial<MarketIngestSchedulerConfig>) => {
      options.setMarketSchedulerConfig((prev) =>
        prev ? { ...prev, ...patch } : prev
      );
    },
    [options.setMarketSchedulerConfig]
  );

  const handleSaveMarketSchedulerConfig = useCallback(async () => {
    if (!window.mytrader || !options.marketSchedulerConfig) return;
    options.setError(null);
    options.setMarketSchedulerSaving(true);
    try {
      const saved = await window.mytrader.market.setIngestSchedulerConfig(
        options.marketSchedulerConfig
      );
      options.setMarketSchedulerConfig(saved);
      options.setMarketSchedulerSavedConfig(saved);
      options.setNotice("调度配置已保存。");
      return true;
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
      return false;
    } finally {
      options.setMarketSchedulerSaving(false);
    }
  }, [
    options.marketSchedulerConfig,
    options.setError,
    options.setMarketSchedulerConfig,
    options.setMarketSchedulerSavedConfig,
    options.setMarketSchedulerSaving,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleRunMarketIngestNow = useCallback(() => {
    if (!options.marketSchedulerConfig) return;
    if (options.marketIngestTriggering) {
      options.setMarketTriggerIngestBlockedMessage("正在提交拉取请求，请稍后再试。");
      options.setMarketTriggerIngestBlockedOpen(true);
      return;
    }
    if (options.marketIngestControlState === "running") {
      options.setMarketTriggerIngestBlockedMessage(
        "当前已有拉取任务正在执行，请等待完成后再执行拉取。"
      );
      options.setMarketTriggerIngestBlockedOpen(true);
      return;
    }
    if (options.marketIngestControlState === "paused") {
      options.setMarketTriggerIngestBlockedMessage(
        "当前任务已暂停，请先继续或取消后再执行拉取。"
      );
      options.setMarketTriggerIngestBlockedOpen(true);
      return;
    }
    if (options.marketIngestControlState === "canceling") {
      options.setMarketTriggerIngestBlockedMessage("当前任务正在取消中，请稍后再试。");
      options.setMarketTriggerIngestBlockedOpen(true);
      return;
    }
    void options.handleTriggerMarketIngest(options.marketSchedulerConfig.scope);
  }, [
    options.handleTriggerMarketIngest,
    options.marketIngestControlState,
    options.marketIngestTriggering,
    options.marketSchedulerConfig,
    options.setMarketTriggerIngestBlockedMessage,
    options.setMarketTriggerIngestBlockedOpen
  ]);

  const handleToggleRegistrySymbol = useCallback(
    (symbol: string) => {
      const key = symbol.trim();
      if (!key) return;
      options.setMarketRegistrySelectedSymbols((prev) =>
        prev.includes(key)
          ? prev.filter((item) => item !== key)
          : [...prev, key]
      );
    },
    [options.setMarketRegistrySelectedSymbols]
  );

  const handleToggleSelectAllRegistry = useCallback(() => {
    const symbols = options.marketRegistryResult?.items.map((item) => item.symbol) ?? [];
    if (symbols.length === 0) return;
    options.setMarketRegistrySelectedSymbols((prev) =>
      prev.length === symbols.length ? [] : symbols
    );
  }, [options.marketRegistryResult?.items, options.setMarketRegistrySelectedSymbols]);

  const handleSetRegistryAutoIngest = useCallback(
    async (symbol: string, enabled: boolean) => {
      if (!window.mytrader) return;
      options.setMarketRegistryUpdating(true);
      try {
        await window.mytrader.market.setInstrumentAutoIngest({ symbol, enabled });
        await Promise.all([
          options.refreshMarketRegistry(),
          options.refreshMarketTargetsDiff()
        ]);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
      } finally {
        options.setMarketRegistryUpdating(false);
      }
    },
    [
      options.refreshMarketRegistry,
      options.refreshMarketTargetsDiff,
      options.setError,
      options.setMarketRegistryUpdating,
      options.toUserErrorMessage
    ]
  );

  const handleBatchSetRegistryAutoIngest = useCallback(
    async (enabled: boolean) => {
      if (!window.mytrader) return;
      if (options.marketRegistrySelectedSymbols.length === 0) return;
      options.setMarketRegistryUpdating(true);
      options.setError(null);
      try {
        await window.mytrader.market.batchSetInstrumentAutoIngest({
          symbols: options.marketRegistrySelectedSymbols,
          enabled
        });
        options.setNotice(
          `已批量${enabled ? "启用" : "禁用"}自动拉取：${options.marketRegistrySelectedSymbols.length} 个标的。`
        );
        await Promise.all([
          options.refreshMarketRegistry(),
          options.refreshMarketTargetsDiff()
        ]);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
      } finally {
        options.setMarketRegistryUpdating(false);
      }
    },
    [
      options.marketRegistrySelectedSymbols,
      options.refreshMarketRegistry,
      options.refreshMarketTargetsDiff,
      options.setError,
      options.setMarketRegistryUpdating,
      options.setNotice,
      options.toUserErrorMessage
    ]
  );

  return {
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

export interface UseDashboardMarketRuntimeEffectsOptions<TMarketScope extends string> {
  activeView: string;
  otherTab: string;
  analysisInstrumentViewActive: boolean;
  marketEffectiveScope: TMarketScope;
  holdingsScopeValue: TMarketScope;
  searchScopeValue: TMarketScope;
  tagsScopeValue: TMarketScope;
  holdingsSymbols: string[];
  searchSymbols: string[];
  loadMarketQuotes: (symbols: string[]) => Promise<void>;
  marketSelectedSymbol: string | null;
  marketSelectedTag: string | null;
  marketSearchQuery: string;
  marketTagManagementQuery: string;
  marketWatchlistCount: number;
  marketInstrumentDetailsOpen: boolean;
  marketIngestRuns: MarketIngestRun[];
  marketSelectedIngestRunId: string | null;
  marketRegistryEntryEnabled: boolean;
  marketRegistryAutoFilter: "all" | "enabled" | "disabled";
  marketRegistryQuery: string;
  marketTargetsConfig: MarketTargetsConfig;
  marketFocusTargetSymbols: string[];
  marketTargetsDirty: boolean;
  restoreDataManagementView: () => void;
  setMarketSelectedIngestRunId: Dispatch<SetStateAction<string | null>>;
  setMarketSelectedIngestRun: Dispatch<SetStateAction<MarketIngestRun | null>>;
  setMarketScope: Dispatch<SetStateAction<TMarketScope>>;
  selectDefaultTag: (tag: string) => void | Promise<void>;
  refreshMarketTokenStatus: () => Promise<void>;
  refreshMarketTargets: () => Promise<void>;
  refreshMarketIngestRuns: () => Promise<void>;
  refreshMarketIngestControl: () => Promise<void>;
  refreshMarketSchedulerConfig: () => Promise<void>;
  refreshMarketUniversePool: () => Promise<void>;
  refreshMarketRegistry: () => Promise<void>;
  refreshMarketTargetsDiff: () => Promise<void>;
  refreshMarketTargetPoolStats: () => Promise<void>;
  refreshMarketUniversePoolOverview: () => Promise<void>;
  refreshMarketWatchlist: () => Promise<void>;
  refreshMarketTags: (query: string) => Promise<void>;
  refreshManualThemeOptions: () => Promise<void>;
  refreshMarketIngestRunDetail: (runId: string) => Promise<void>;
}

export function useDashboardMarketRuntimeEffects<TMarketScope extends string>(
  options: UseDashboardMarketRuntimeEffectsOptions<TMarketScope>
) {
  const marketDataManagementPrevViewRef = useRef(options.activeView);
  const marketDataManagementPrevOtherTabRef = useRef(options.otherTab);
  const marketDataManagementNavigationGuardRef = useRef(false);

  useEffect(() => {
    if (options.activeView !== "other") return;
    if (!window.mytrader) return;

    if (options.otherTab === "data-management") {
      options.refreshMarketTargets().catch(() => undefined);
      options.refreshMarketUniversePool().catch(() => undefined);
      return undefined;
    }

    if (options.otherTab === "instrument-management") {
      options.refreshMarketTargets().catch(() => undefined);
      options
        .refreshMarketTags(options.marketTagManagementQuery)
        .catch(() => undefined);
      return;
    }

    if (options.otherTab === "data-status") {
      options.refreshMarketTokenStatus().catch(() => undefined);
      options.refreshMarketIngestRuns().catch(() => undefined);
      options.refreshMarketIngestControl().catch(() => undefined);
    }
    return undefined;
  }, [
    options.activeView,
    options.marketRegistryEntryEnabled,
    options.marketTagManagementQuery,
    options.otherTab,
    options.refreshMarketIngestControl,
    options.refreshMarketIngestRuns,
    options.refreshMarketRegistry,
    options.refreshMarketSchedulerConfig,
    options.refreshMarketTags,
    options.refreshMarketTargets,
    options.refreshMarketTokenStatus,
    options.refreshMarketUniversePool
  ]);

  useEffect(() => {
    if (options.activeView !== "other" || options.otherTab !== "data-management") {
      return;
    }
    if (!options.marketTargetsDirty) return;
    if (!window.mytrader) return;
    const timer = window.setTimeout(() => {
      options.refreshMarketTargetsDiff().catch(() => undefined);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [
    options.activeView,
    options.marketTargetsConfig,
    options.marketTargetsDirty,
    options.otherTab,
    options.refreshMarketTargetsDiff
  ]);

  useEffect(() => {
    if (options.activeView !== "other" || options.otherTab !== "data-management") {
      return;
    }
    if (options.marketTargetsDirty) return;
    if (!window.mytrader) return;
    const timer = window.setTimeout(() => {
      options.refreshMarketTargetPoolStats().catch(() => undefined);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [
    options.activeView,
    options.marketFocusTargetSymbols,
    options.marketTargetsDirty,
    options.otherTab,
    options.refreshMarketTargetPoolStats
  ]);

  useEffect(() => {
    if (
      options.activeView !== "other" ||
      options.otherTab !== "instrument-management"
    ) {
      return;
    }
    if (!window.mytrader) return;
    const timer = window.setTimeout(() => {
      options
        .refreshMarketTags(options.marketTagManagementQuery)
        .catch(() => undefined);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [
    options.activeView,
    options.marketTagManagementQuery,
    options.otherTab,
    options.refreshMarketTags
  ]);

  useEffect(() => {
    if (options.activeView !== "other" || options.otherTab !== "data-management") {
      return;
    }
    if (!options.marketRegistryEntryEnabled) return;
    if (!window.mytrader) return;
    const timer = window.setTimeout(() => {
      options.refreshMarketRegistry().catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    options.activeView,
    options.marketRegistryAutoFilter,
    options.marketRegistryEntryEnabled,
    options.marketRegistryQuery,
    options.otherTab,
    options.refreshMarketRegistry
  ]);

  useEffect(() => {
    if (options.activeView !== "other") return;
    if (
      options.otherTab !== "data-management" &&
      options.otherTab !== "data-status"
    ) {
      return;
    }
    if (!window.mytrader) return;
    const tick = () => {
      if (document.hidden) return;
      options.refreshMarketIngestControl().catch(() => undefined);
      options.refreshMarketIngestRuns().catch(() => undefined);
      if (options.otherTab === "data-management") {
        options.refreshMarketUniversePoolOverview().catch(() => undefined);
      }
    };
    const interval = window.setInterval(tick, 15000);
    const handleVisibilityChange = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    options.activeView,
    options.otherTab,
    options.refreshMarketIngestControl,
    options.refreshMarketIngestRuns,
    options.refreshMarketUniversePoolOverview
  ]);

  useEffect(() => {
    const previousView = marketDataManagementPrevViewRef.current;
    const previousOtherTab = marketDataManagementPrevOtherTabRef.current;
    const leftDataManagement =
      previousView === "other" &&
      previousOtherTab === "data-management" &&
      (options.activeView !== "other" || options.otherTab !== "data-management");

    marketDataManagementPrevViewRef.current = options.activeView;
    marketDataManagementPrevOtherTabRef.current = options.otherTab;

    if (!leftDataManagement || !options.marketTargetsDirty) {
      marketDataManagementNavigationGuardRef.current = false;
      return;
    }

    if (marketDataManagementNavigationGuardRef.current) {
      marketDataManagementNavigationGuardRef.current = false;
      return;
    }

    const confirmed = window.confirm("目标池有未保存修改，确定离开吗？");
    if (confirmed) return;

    marketDataManagementNavigationGuardRef.current = true;
    options.restoreDataManagementView();
  }, [options.activeView, options.marketTargetsDirty, options.otherTab, options.restoreDataManagementView]);

  useEffect(() => {
    if (options.activeView !== "market") return;
    if (!window.mytrader) return;
    options.refreshMarketWatchlist().catch(() => undefined);
    options.refreshMarketTags("").catch(() => undefined);
  }, [options.activeView, options.refreshMarketTags, options.refreshMarketWatchlist]);

  useEffect(() => {
    if (!options.analysisInstrumentViewActive) return;
    if (!window.mytrader) return;
    if (options.marketWatchlistCount > 0) return;
    options.refreshMarketWatchlist().catch(() => undefined);
  }, [
    options.analysisInstrumentViewActive,
    options.marketWatchlistCount,
    options.refreshMarketWatchlist
  ]);

  useEffect(() => {
    if (!options.marketInstrumentDetailsOpen) return;
    options.refreshManualThemeOptions().catch(() => undefined);
  }, [options.marketInstrumentDetailsOpen, options.refreshManualThemeOptions]);

  useEffect(() => {
    if (!options.marketSelectedIngestRunId) return;
    if (
      options.marketIngestRuns.some(
        (run) => run.id === options.marketSelectedIngestRunId
      )
    ) {
      return;
    }
    options.setMarketSelectedIngestRunId(null);
    options.setMarketSelectedIngestRun(null);
  }, [
    options.marketIngestRuns,
    options.marketSelectedIngestRunId,
    options.setMarketSelectedIngestRun,
    options.setMarketSelectedIngestRunId
  ]);

  useEffect(() => {
    if (!options.marketSelectedIngestRunId) return;
    if (options.activeView !== "other" || options.otherTab !== "data-status") return;
    options
      .refreshMarketIngestRunDetail(options.marketSelectedIngestRunId)
      .catch(() => undefined);
  }, [
    options.activeView,
    options.marketSelectedIngestRunId,
    options.otherTab,
    options.refreshMarketIngestRunDetail
  ]);

  useEffect(() => {
    if (options.activeView !== "market") return;
    if (options.marketEffectiveScope !== options.holdingsScopeValue) return;
    void options.loadMarketQuotes(options.holdingsSymbols);
  }, [
    options.activeView,
    options.holdingsScopeValue,
    options.holdingsSymbols,
    options.loadMarketQuotes,
    options.marketEffectiveScope
  ]);

  useEffect(() => {
    if (options.activeView !== "market") return;
    if (options.marketEffectiveScope !== options.searchScopeValue) return;
    void options.loadMarketQuotes(options.searchSymbols);
  }, [
    options.activeView,
    options.loadMarketQuotes,
    options.marketEffectiveScope,
    options.searchScopeValue,
    options.searchSymbols
  ]);

  useEffect(() => {
    if (options.activeView !== "market") return;
    if (options.marketSelectedSymbol || options.marketSelectedTag) return;
    if (options.marketSearchQuery.trim()) return;

    if (options.holdingsSymbols.length > 0) {
      options.setMarketScope(options.holdingsScopeValue);
      return;
    }

    if (options.marketWatchlistCount > 0) {
      options.setMarketScope(options.tagsScopeValue);
      void options.selectDefaultTag("watchlist:all");
    }
  }, [
    options.activeView,
    options.holdingsScopeValue,
    options.holdingsSymbols,
    options.marketSearchQuery,
    options.marketSelectedSymbol,
    options.marketSelectedTag,
    options.marketWatchlistCount,
    options.selectDefaultTag,
    options.setMarketScope,
    options.tagsScopeValue
  ]);
}
