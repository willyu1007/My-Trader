import { useMemo } from "react";

import type {
  AssetClass,
  InstrumentKind,
  InstrumentProfile,
  InstrumentProfileSummary,
  LedgerEntry,
  MarketDailyBar,
  MarketQuote,
  MarketTagSeriesResult,
  PortfolioSnapshot,
  WatchlistItem
} from "@mytrader/shared";

import {
  computeFifoUnitCost,
  computeTagAggregate,
  getCnChangeTone,
  parseTargetPriceFromTags
} from "../shared";

export type MarketScope = "tags" | "holdings" | "search";

export interface UseDashboardMarketDerivedOptions {
  snapshot: PortfolioSnapshot | null;
  marketFilterMarket: "all" | "CN";
  marketFilterAssetClasses: AssetClass[];
  marketFilterKinds: InstrumentKind[];
  marketSelectedSymbol: string | null;
  marketQuotesBySymbol: Record<string, MarketQuote>;
  marketChartBars: MarketDailyBar[];
  marketChartHoverDate: string | null;
  marketWatchlistItems: WatchlistItem[];
  marketSearchResults: InstrumentProfileSummary[];
  marketSelectedProfile: InstrumentProfile | null;
  marketSearchQuery: string;
  marketScope: MarketScope;
  marketSelectedTag: string | null;
  marketTagMembers: string[];
  marketTagSeriesBars: MarketDailyBar[];
  marketTagSeriesResult: MarketTagSeriesResult | null;
  marketSelectedUserTags: string[];
  ledgerEntries: LedgerEntry[];
}

export function useDashboardMarketDerived(options: UseDashboardMarketDerivedOptions) {
  const marketHoldingsSymbols = useMemo(() => {
    if (!options.snapshot) return [];
    return options.snapshot.positions
      .filter((pos) => pos.position.assetClass !== "cash")
      .map((pos) => pos.position.symbol)
      .filter(Boolean);
  }, [options.snapshot]);

  const marketHoldingsMetaBySymbol = useMemo(() => {
    const map = new Map<string, { assetClass: AssetClass | null; market: string | null }>();
    options.snapshot?.positions.forEach((pos) => {
      if (pos.position.assetClass === "cash") return;
      const symbol = pos.position.symbol;
      if (!symbol) return;
      map.set(symbol, {
        assetClass: pos.position.assetClass ?? null,
        market: pos.position.market ?? null
      });
    });
    return map;
  }, [options.snapshot]);

  const marketHoldingsSymbolsFiltered = useMemo(() => {
    return marketHoldingsSymbols.filter((symbol) => {
      const meta = marketHoldingsMetaBySymbol.get(symbol) ?? null;
      if (options.marketFilterMarket !== "all") {
        if (!meta?.market || meta.market !== options.marketFilterMarket) return false;
      }
      if (options.marketFilterAssetClasses.length > 0) {
        if (!meta?.assetClass) return false;
        if (!options.marketFilterAssetClasses.includes(meta.assetClass)) return false;
      }
      return true;
    });
  }, [
    marketHoldingsMetaBySymbol,
    marketHoldingsSymbols,
    options.marketFilterAssetClasses,
    options.marketFilterMarket
  ]);

  const marketSelectedQuote = useMemo(() => {
    if (!options.marketSelectedSymbol) return null;
    return options.marketQuotesBySymbol[options.marketSelectedSymbol] ?? null;
  }, [options.marketQuotesBySymbol, options.marketSelectedSymbol]);

  const marketBarsByDate = useMemo(() => {
    const map = new Map<string, MarketDailyBar>();
    options.marketChartBars.forEach((bar) => {
      map.set(bar.date, bar);
    });
    return map;
  }, [options.marketChartBars]);

  const marketActiveVolume = useMemo(() => {
    if (!options.marketChartHoverDate) return null;
    const bar = marketBarsByDate.get(options.marketChartHoverDate) ?? null;
    return bar?.volume ?? null;
  }, [marketBarsByDate, options.marketChartHoverDate]);

  const marketActiveMoneyflowVol = useMemo(() => {
    if (!options.marketChartHoverDate) return null;
    const bar = marketBarsByDate.get(options.marketChartHoverDate) ?? null;
    const value = bar?.netMfVol ?? null;
    return value !== null && Number.isFinite(value) ? value : null;
  }, [marketBarsByDate, options.marketChartHoverDate]);

  const marketActiveMoneyflowRatio = useMemo(() => {
    if (!options.marketChartHoverDate) return null;
    const bar = marketBarsByDate.get(options.marketChartHoverDate) ?? null;
    const volume = bar?.volume ?? null;
    const mf = bar?.netMfVol ?? null;
    if (
      volume === null ||
      !Number.isFinite(volume) ||
      volume <= 0 ||
      mf === null ||
      !Number.isFinite(mf)
    ) {
      return null;
    }
    return Math.abs(mf) / volume;
  }, [marketBarsByDate, options.marketChartHoverDate]);

  const marketNameBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    options.snapshot?.positions.forEach((pos) => {
      const symbol = pos.position.symbol;
      if (symbol) map.set(symbol, pos.position.name ?? symbol);
    });
    options.marketWatchlistItems.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    options.marketSearchResults.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    if (options.marketSelectedProfile) {
      map.set(
        options.marketSelectedProfile.symbol,
        options.marketSelectedProfile.name ?? options.marketSelectedProfile.symbol
      );
    }
    return map;
  }, [
    options.marketSearchResults,
    options.marketSelectedProfile,
    options.marketWatchlistItems,
    options.snapshot
  ]);

  const marketListFilter = options.marketSearchQuery.trim().toLowerCase();
  const marketEffectiveScope: MarketScope =
    marketListFilter.length > 0 ? "search" : options.marketScope;

  const marketCollectionSelectValue = useMemo(() => {
    if (options.marketScope === "holdings") return "builtin:holdings";
    if (options.marketScope === "tags") {
      if (options.marketSelectedTag === "watchlist:all") return "builtin:watchlist";
      if (options.marketSelectedTag) return `tag:${options.marketSelectedTag}`;
    }
    return "builtin:holdings";
  }, [options.marketScope, options.marketSelectedTag]);

  const marketSearchResultsFiltered = useMemo(() => {
    return options.marketSearchResults.filter((item) => {
      if (options.marketFilterMarket !== "all") {
        if (!item.market || item.market !== options.marketFilterMarket) return false;
      }
      if (options.marketFilterKinds.length > 0) {
        if (!options.marketFilterKinds.includes(item.kind)) return false;
      }
      if (options.marketFilterAssetClasses.length > 0) {
        if (!item.assetClass) return false;
        if (!options.marketFilterAssetClasses.includes(item.assetClass)) return false;
      }
      return true;
    });
  }, [
    options.marketFilterAssetClasses,
    options.marketFilterKinds,
    options.marketFilterMarket,
    options.marketSearchResults
  ]);

  const marketSearchResultSymbols = useMemo(
    () => marketSearchResultsFiltered.map((item) => item.symbol),
    [marketSearchResultsFiltered]
  );

  const marketCurrentListSymbols = useMemo(() => {
    if (marketEffectiveScope === "holdings") return marketHoldingsSymbolsFiltered;
    if (marketEffectiveScope === "search") {
      return options.marketSearchResults.map((item) => item.symbol);
    }
    if (marketEffectiveScope === "tags") {
      return options.marketSelectedTag ? options.marketTagMembers : [];
    }
    return [];
  }, [
    marketEffectiveScope,
    marketHoldingsSymbolsFiltered,
    options.marketSearchResults,
    options.marketSelectedTag,
    options.marketTagMembers
  ]);

  const marketFilteredListSymbols = useMemo(() => {
    if (!marketListFilter || marketEffectiveScope === "search") {
      return marketCurrentListSymbols;
    }
    return marketCurrentListSymbols.filter((symbol) => {
      const name = marketNameBySymbol.get(symbol) ?? "";
      return (
        symbol.toLowerCase().includes(marketListFilter) ||
        name.toLowerCase().includes(marketListFilter)
      );
    });
  }, [
    marketCurrentListSymbols,
    marketEffectiveScope,
    marketListFilter,
    marketNameBySymbol
  ]);

  const marketSelectedTagAggregate = useMemo(() => {
    if (!options.marketSelectedTag) return null;
    return computeTagAggregate(options.marketTagMembers, options.marketQuotesBySymbol);
  }, [
    options.marketQuotesBySymbol,
    options.marketSelectedTag,
    options.marketTagMembers
  ]);

  const marketSelectedTagSeriesReturnPct = useMemo(() => {
    const closes = options.marketTagSeriesBars
      .map((bar) => bar.close)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (closes.length < 2) return null;
    const first = closes[0];
    const last = closes[closes.length - 1];
    if (first === 0) return null;
    return (last - first) / first;
  }, [options.marketTagSeriesBars]);

  const marketSelectedTagSeriesTone = useMemo(
    () => getCnChangeTone(marketSelectedTagSeriesReturnPct),
    [marketSelectedTagSeriesReturnPct]
  );

  const marketTagSeriesLatestCoverageLabel = useMemo(() => {
    const points = options.marketTagSeriesResult?.points ?? [];
    if (points.length === 0) return "--";
    const last = points[points.length - 1];
    return `覆盖 ${last.includedCount}/${last.totalCount}`;
  }, [options.marketTagSeriesResult]);

  const marketFiltersActiveCount = useMemo(() => {
    let count = 0;
    if (options.marketFilterMarket !== "all") count += 1;
    if (options.marketFilterAssetClasses.length > 0) count += 1;
    if (options.marketFilterKinds.length > 0) count += 1;
    return count;
  }, [
    options.marketFilterAssetClasses,
    options.marketFilterKinds,
    options.marketFilterMarket
  ]);

  const marketLatestBar = useMemo(() => {
    for (let idx = options.marketChartBars.length - 1; idx >= 0; idx -= 1) {
      const bar = options.marketChartBars[idx];
      if (bar.close !== null) return bar;
    }
    return null;
  }, [options.marketChartBars]);

  const marketChartHasEnoughData = useMemo(() => {
    let count = 0;
    for (const bar of options.marketChartBars) {
      const close = bar.close;
      if (close !== null && Number.isFinite(close)) count += 1;
      if (count >= 2) return true;
    }
    return false;
  }, [options.marketChartBars]);

  const marketRangeSummary = useMemo(() => {
    const closes = options.marketChartBars
      .map((bar) => bar.close)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const highs = options.marketChartBars
      .map((bar) => bar.high)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const lows = options.marketChartBars
      .map((bar) => bar.low)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const volumes = options.marketChartBars
      .map((bar) => bar.volume)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const firstClose = closes.length > 0 ? closes[0] : null;
    const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;
    const rangeReturn =
      firstClose !== null && lastClose !== null && firstClose !== 0
        ? (lastClose - firstClose) / firstClose
        : null;

    const rangeHigh = highs.length > 0 ? Math.max(...highs) : null;
    const rangeLow = lows.length > 0 ? Math.min(...lows) : null;
    const avgVolume =
      volumes.length > 0
        ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length
        : null;

    return { rangeHigh, rangeLow, avgVolume, rangeReturn };
  }, [options.marketChartBars]);

  const marketSelectedPositionValuation = useMemo(() => {
    if (!options.snapshot || !options.marketSelectedSymbol) return null;
    return (
      options.snapshot.positions.find(
        (pos) => pos.position.symbol === options.marketSelectedSymbol
      ) ?? null
    );
  }, [options.marketSelectedSymbol, options.snapshot]);

  const marketHoldingUnitCost = useMemo(() => {
    if (!options.marketSelectedSymbol) return null;
    const position = marketSelectedPositionValuation?.position ?? null;
    if (!position || position.quantity <= 0) return null;

    const direct = position.cost;
    if (direct !== null && Number.isFinite(direct) && direct > 0) return direct;

    const fifo = computeFifoUnitCost(options.ledgerEntries, options.marketSelectedSymbol);
    if (fifo !== null && Number.isFinite(fifo) && fifo > 0) return fifo;
    return null;
  }, [options.ledgerEntries, options.marketSelectedSymbol, marketSelectedPositionValuation]);

  const marketTargetPrice = useMemo(
    () => parseTargetPriceFromTags(options.marketSelectedUserTags),
    [options.marketSelectedUserTags]
  );

  return {
    marketHoldingsSymbols,
    marketHoldingsMetaBySymbol,
    marketHoldingsSymbolsFiltered,
    marketSelectedQuote,
    marketBarsByDate,
    marketActiveVolume,
    marketActiveMoneyflowVol,
    marketActiveMoneyflowRatio,
    marketNameBySymbol,
    marketListFilter,
    marketEffectiveScope,
    marketCollectionSelectValue,
    marketSearchResultsFiltered,
    marketSearchResultSymbols,
    marketCurrentListSymbols,
    marketFilteredListSymbols,
    marketSelectedTagAggregate,
    marketSelectedTagSeriesReturnPct,
    marketSelectedTagSeriesTone,
    marketTagSeriesLatestCoverageLabel,
    marketFiltersActiveCount,
    marketLatestBar,
    marketChartHasEnoughData,
    marketRangeSummary,
    marketSelectedPositionValuation,
    marketHoldingUnitCost,
    marketTargetPrice
  };
}
