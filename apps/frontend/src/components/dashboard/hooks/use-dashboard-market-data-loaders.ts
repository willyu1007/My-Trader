import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  AssetClass,
  InstrumentKind,
  MarketQuote,
  MarketTargetsConfig,
  PreviewTargetsDiffResult,
  PreviewTargetsResult,
  TagSummary,
  TempTargetSymbol,
  WatchlistItem
} from "@mytrader/shared";

import { buildManualThemeOptions } from "../shared";
import type { MarketFilterMarket } from "../types";

interface ManualSymbolPreview {
  addable: string[];
  existing: string[];
  invalid: string[];
  duplicates: number;
}

export interface UseDashboardMarketDataLoadersOptions {
  marketTargetsConfig: MarketTargetsConfig;
  toUserErrorMessage: (err: unknown) => string;
  setError: Dispatch<SetStateAction<string | null>>;
  setMarketWatchlistLoading: Dispatch<SetStateAction<boolean>>;
  setMarketWatchlistItems: Dispatch<SetStateAction<WatchlistItem[]>>;
  setMarketTagsLoading: Dispatch<SetStateAction<boolean>>;
  setMarketTags: Dispatch<SetStateAction<TagSummary[]>>;
  setMarketManualThemeLoading: Dispatch<SetStateAction<boolean>>;
  setMarketManualThemeOptions: Dispatch<SetStateAction<{ value: string; label: string }[]>>;
  setMarketManualThemeDraft: Dispatch<SetStateAction<string>>;
  setMarketFilterMarket: Dispatch<SetStateAction<MarketFilterMarket>>;
  setMarketFilterAssetClasses: Dispatch<SetStateAction<AssetClass[]>>;
  setMarketFilterKinds: Dispatch<SetStateAction<InstrumentKind[]>>;
  resolveFilterResetPreset: () => {
    filterMarket: MarketFilterMarket;
    filterAssetClasses: AssetClass[];
    filterKinds: InstrumentKind[];
  };
  setMarketQuotesLoading: Dispatch<SetStateAction<boolean>>;
  setMarketQuotesBySymbol: Dispatch<SetStateAction<Record<string, MarketQuote>>>;
  setMarketTargetsLoading: Dispatch<SetStateAction<boolean>>;
  setMarketTargetsSavedConfig: Dispatch<SetStateAction<MarketTargetsConfig | null>>;
  setMarketTargetsConfig: Dispatch<SetStateAction<MarketTargetsConfig>>;
  setMarketTargetsDiffPreview: Dispatch<SetStateAction<PreviewTargetsDiffResult | null>>;
  setMarketTargetsPreview: Dispatch<SetStateAction<PreviewTargetsResult | null>>;
  setMarketTempTargetsLoading: Dispatch<SetStateAction<boolean>>;
  setMarketTempTargets: Dispatch<SetStateAction<TempTargetSymbol[]>>;
  setMarketManualSymbolPreview: Dispatch<SetStateAction<ManualSymbolPreview>>;
}

export function useDashboardMarketDataLoaders(
  options: UseDashboardMarketDataLoadersOptions
) {
  const refreshMarketWatchlist = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketWatchlistLoading(true);
    try {
      const items = await window.mytrader.market.listWatchlist();
      options.setMarketWatchlistItems(items);
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketWatchlistLoading(false);
    }
  }, [
    options.setError,
    options.setMarketWatchlistItems,
    options.setMarketWatchlistLoading,
    options.toUserErrorMessage
  ]);

  const refreshMarketTags = useCallback(
    async (query: string) => {
      if (!window.mytrader) return;
      options.setMarketTagsLoading(true);
      try {
        const tags = await window.mytrader.market.listTags({
          query: query.trim() ? query.trim() : null,
          limit: 200
        });
        options.setMarketTags(tags);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
        options.setMarketTags([]);
      } finally {
        options.setMarketTagsLoading(false);
      }
    },
    [
      options.setError,
      options.setMarketTags,
      options.setMarketTagsLoading,
      options.toUserErrorMessage
    ]
  );

  const refreshManualThemeOptions = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketManualThemeLoading(true);
    try {
      const tags = await window.mytrader.market.listTags({
        query: "theme:ths:",
        limit: 500
      });
      const themeOptions = buildManualThemeOptions(tags);
      options.setMarketManualThemeOptions(themeOptions);
      options.setMarketManualThemeDraft((prev) =>
        themeOptions.some((opt) => opt.value === prev) ? prev : ""
      );
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
      options.setMarketManualThemeOptions([]);
      options.setMarketManualThemeDraft("");
    } finally {
      options.setMarketManualThemeLoading(false);
    }
  }, [
    options.setError,
    options.setMarketManualThemeDraft,
    options.setMarketManualThemeLoading,
    options.setMarketManualThemeOptions,
    options.toUserErrorMessage
  ]);

  const resetMarketFilters = useCallback(() => {
    const preset = options.resolveFilterResetPreset();
    options.setMarketFilterMarket(preset.filterMarket);
    options.setMarketFilterAssetClasses([...preset.filterAssetClasses]);
    options.setMarketFilterKinds([...preset.filterKinds]);
  }, [
    options.resolveFilterResetPreset,
    options.setMarketFilterAssetClasses,
    options.setMarketFilterKinds,
    options.setMarketFilterMarket
  ]);

  const loadMarketQuotes = useCallback(async (symbols: string[]) => {
    if (!window.mytrader) return;
    const unique = Array.from(new Set(symbols.map((s) => s.trim()).filter(Boolean)));
    if (unique.length === 0) return;

    options.setMarketQuotesLoading(true);
    try {
      const quotes = await window.mytrader.market.getQuotes({ symbols: unique });
      options.setMarketQuotesBySymbol((prev) => {
        const next = { ...prev };
        quotes.forEach((quote) => {
          next[quote.symbol] = quote;
        });
        return next;
      });
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketQuotesLoading(false);
    }
  }, [
    options.setError,
    options.setMarketQuotesBySymbol,
    options.setMarketQuotesLoading,
    options.toUserErrorMessage
  ]);

  const refreshMarketTargets = useCallback(async () => {
    if (!window.mytrader) return;
    options.setMarketTargetsLoading(true);
    try {
      const config = await window.mytrader.market.getTargets();
      const normalizedConfig: MarketTargetsConfig = {
        ...config,
        includeRegistryAutoIngest: false,
        tagFilters: []
      };
      options.setMarketTargetsSavedConfig(normalizedConfig);
      options.setMarketTargetsConfig(normalizedConfig);
      const diff = await window.mytrader.market.previewTargetsDraft({
        config: normalizedConfig
      });
      options.setMarketTargetsDiffPreview(diff);
      options.setMarketTargetsPreview(diff.draft);
      options.setMarketTempTargetsLoading(true);
      const temp = await window.mytrader.market.listTempTargets();
      options.setMarketTempTargets(temp);
      options.setMarketManualSymbolPreview({
        addable: [],
        existing: [],
        invalid: [],
        duplicates: 0
      });
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    } finally {
      options.setMarketTempTargetsLoading(false);
      options.setMarketTargetsLoading(false);
    }
  }, [
    options.setError,
    options.setMarketManualSymbolPreview,
    options.setMarketTargetsConfig,
    options.setMarketTargetsDiffPreview,
    options.setMarketTargetsLoading,
    options.setMarketTargetsPreview,
    options.setMarketTargetsSavedConfig,
    options.setMarketTempTargets,
    options.setMarketTempTargetsLoading,
    options.toUserErrorMessage
  ]);

  const refreshMarketTargetsDiff = useCallback(async () => {
    if (!window.mytrader) return;
    try {
      const diff = await window.mytrader.market.previewTargetsDraft({
        config: options.marketTargetsConfig
      });
      options.setMarketTargetsDiffPreview(diff);
      options.setMarketTargetsPreview(diff.draft);
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
    }
  }, [
    options.marketTargetsConfig,
    options.setError,
    options.setMarketTargetsDiffPreview,
    options.setMarketTargetsPreview,
    options.toUserErrorMessage
  ]);

  return {
    refreshMarketWatchlist,
    refreshMarketTags,
    refreshManualThemeOptions,
    resetMarketFilters,
    loadMarketQuotes,
    refreshMarketTargets,
    refreshMarketTargetsDiff
  };
}
