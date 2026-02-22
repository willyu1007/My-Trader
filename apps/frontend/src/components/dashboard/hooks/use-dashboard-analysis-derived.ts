import { useMemo } from "react";

import type {
  InstrumentProfile,
  InstrumentProfileSummary,
  LedgerEntry,
  MarketDailyBar,
  MarketQuote,
  PortfolioSnapshot,
  WatchlistItem
} from "@mytrader/shared";

import {
  computeFifoUnitCost,
  getCnChangeTone,
  parseTargetPriceFromTags
} from "../shared";

export interface UseDashboardAnalysisDerivedOptions {
  snapshot: PortfolioSnapshot | null;
  marketWatchlistItems: WatchlistItem[];
  analysisInstrumentSearchResults: InstrumentProfileSummary[];
  analysisInstrumentProfile: InstrumentProfile | null;
  analysisInstrumentBars: MarketDailyBar[];
  analysisInstrumentSymbol: string | null;
  ledgerEntries: LedgerEntry[];
  analysisInstrumentUserTags: string[];
  analysisInstrumentQuote: MarketQuote | null;
}

export function useDashboardAnalysisDerived(
  options: UseDashboardAnalysisDerivedOptions
) {
  const analysisInstrumentNameBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    options.snapshot?.positions.forEach((pos) => {
      const symbol = pos.position.symbol;
      if (symbol) map.set(symbol, pos.position.name ?? symbol);
    });
    options.marketWatchlistItems.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    options.analysisInstrumentSearchResults.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    if (options.analysisInstrumentProfile) {
      map.set(
        options.analysisInstrumentProfile.symbol,
        options.analysisInstrumentProfile.name ?? options.analysisInstrumentProfile.symbol
      );
    }
    return map;
  }, [
    options.analysisInstrumentProfile,
    options.analysisInstrumentSearchResults,
    options.marketWatchlistItems,
    options.snapshot
  ]);

  const analysisInstrumentQuickSymbols = useMemo(() => {
    const set = new Set<string>();
    options.snapshot?.positions.forEach((pos) => {
      if (pos.position.assetClass === "cash") return;
      if (!pos.position.symbol) return;
      set.add(pos.position.symbol);
    });
    options.marketWatchlistItems.forEach((item) => {
      if (item.symbol) set.add(item.symbol);
    });
    return Array.from(set).slice(0, 16);
  }, [options.marketWatchlistItems, options.snapshot]);

  const analysisInstrumentLatestBar = useMemo(() => {
    for (let idx = options.analysisInstrumentBars.length - 1; idx >= 0; idx -= 1) {
      const bar = options.analysisInstrumentBars[idx];
      if (bar.close !== null) return bar;
    }
    return null;
  }, [options.analysisInstrumentBars]);

  const analysisInstrumentHasEnoughData = useMemo(() => {
    let count = 0;
    for (const bar of options.analysisInstrumentBars) {
      if (bar.close !== null && Number.isFinite(bar.close)) {
        count += 1;
      }
      if (count >= 2) return true;
    }
    return false;
  }, [options.analysisInstrumentBars]);

  const analysisInstrumentRangeSummary = useMemo(() => {
    const closes = options.analysisInstrumentBars
      .map((bar) => bar.close)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const highs = options.analysisInstrumentBars
      .map((bar) => bar.high)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const lows = options.analysisInstrumentBars
      .map((bar) => bar.low)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const volumes = options.analysisInstrumentBars
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
    const startDate = options.analysisInstrumentBars[0]?.date ?? null;
    const endDate = options.analysisInstrumentBars[options.analysisInstrumentBars.length - 1]?.date ?? null;
    return { rangeHigh, rangeLow, avgVolume, rangeReturn, startDate, endDate };
  }, [options.analysisInstrumentBars]);

  const analysisInstrumentPositionValuation = useMemo(() => {
    if (!options.snapshot || !options.analysisInstrumentSymbol) return null;
    return (
      options.snapshot.positions.find(
        (pos) => pos.position.symbol === options.analysisInstrumentSymbol
      ) ?? null
    );
  }, [options.analysisInstrumentSymbol, options.snapshot]);

  const analysisInstrumentHoldingUnitCost = useMemo(() => {
    if (!options.analysisInstrumentSymbol) return null;
    const position = analysisInstrumentPositionValuation?.position ?? null;
    if (!position || position.quantity <= 0) return null;

    const direct = position.cost;
    if (direct !== null && Number.isFinite(direct) && direct > 0) return direct;

    const fifo = computeFifoUnitCost(options.ledgerEntries, options.analysisInstrumentSymbol);
    if (fifo !== null && Number.isFinite(fifo) && fifo > 0) return fifo;
    return null;
  }, [
    analysisInstrumentPositionValuation,
    options.analysisInstrumentSymbol,
    options.ledgerEntries
  ]);

  const analysisInstrumentTargetPrice = useMemo(
    () => parseTargetPriceFromTags(options.analysisInstrumentUserTags),
    [options.analysisInstrumentUserTags]
  );

  const analysisInstrumentTone = useMemo(
    () =>
      getCnChangeTone(
        options.analysisInstrumentQuote?.changePct ?? analysisInstrumentRangeSummary.rangeReturn
      ),
    [options.analysisInstrumentQuote?.changePct, analysisInstrumentRangeSummary.rangeReturn]
  );

  return {
    analysisInstrumentNameBySymbol,
    analysisInstrumentQuickSymbols,
    analysisInstrumentLatestBar,
    analysisInstrumentHasEnoughData,
    analysisInstrumentRangeSummary,
    analysisInstrumentPositionValuation,
    analysisInstrumentHoldingUnitCost,
    analysisInstrumentTargetPrice,
    analysisInstrumentTone
  };
}
