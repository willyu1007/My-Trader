import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  InstrumentProfile,
  InstrumentProfileSummary,
  MarketDailyBar,
  MarketQuote
} from "@mytrader/shared";

export interface UseDashboardAnalysisRuntimeOptions<TRange extends string> {
  activeView: string;
  analysisTab: string;
  analysisInstrumentQuery: string;
  analysisInstrumentSymbol: string | null;
  analysisInstrumentRange: TRange;
  analysisInstrumentQuickSymbols: string[];
  snapshotPriceAsOf: string | null | undefined;
  toUserErrorMessage: (err: unknown) => string;
  resolveMarketChartDateRange: (
    range: TRange,
    endDate: string
  ) => { startDate: string; endDate: string };
  formatInputDate: (value: Date) => string;
  setAnalysisInstrumentSearchResults: Dispatch<
    SetStateAction<InstrumentProfileSummary[]>
  >;
  setAnalysisInstrumentSearchLoading: Dispatch<SetStateAction<boolean>>;
  setAnalysisInstrumentSymbol: Dispatch<SetStateAction<string | null>>;
  setAnalysisInstrumentLoading: Dispatch<SetStateAction<boolean>>;
  setAnalysisInstrumentError: Dispatch<SetStateAction<string | null>>;
  setAnalysisInstrumentProfile: Dispatch<
    SetStateAction<InstrumentProfile | null>
  >;
  setAnalysisInstrumentUserTags: Dispatch<SetStateAction<string[]>>;
  setAnalysisInstrumentQuote: Dispatch<SetStateAction<MarketQuote | null>>;
  setAnalysisInstrumentBars: Dispatch<SetStateAction<MarketDailyBar[]>>;
}

export function useDashboardAnalysisRuntime<TRange extends string>(
  options: UseDashboardAnalysisRuntimeOptions<TRange>
) {
  const analysisInstrumentSearchTimerRef = useRef<number | null>(null);
  const analysisInstrumentSearchRequestIdRef = useRef(0);
  const analysisInstrumentLoadRequestIdRef = useRef(0);

  const loadAnalysisInstrument = useCallback(
    async (symbol: string) => {
      if (!window.mytrader) {
        options.setAnalysisInstrumentError("未检测到桌面端后端接口。");
        return;
      }
      const key = symbol.trim();
      if (!key) return;

      const requestId = analysisInstrumentLoadRequestIdRef.current + 1;
      analysisInstrumentLoadRequestIdRef.current = requestId;

      options.setAnalysisInstrumentLoading(true);
      options.setAnalysisInstrumentError(null);

      try {
        const [profile, tags, quotes] = await Promise.all([
          window.mytrader.market.getInstrumentProfile(key),
          window.mytrader.market.listInstrumentTags(key),
          window.mytrader.market.getQuotes({ symbols: [key] })
        ]);
        if (analysisInstrumentLoadRequestIdRef.current !== requestId) return;

        const quote = quotes[0] ?? null;
        options.setAnalysisInstrumentProfile(profile);
        options.setAnalysisInstrumentUserTags(tags);
        options.setAnalysisInstrumentQuote(quote);

        const endDate =
          quote?.tradeDate ??
          options.snapshotPriceAsOf ??
          options.formatInputDate(new Date());
        const { startDate, endDate: resolvedEndDate } =
          options.resolveMarketChartDateRange(options.analysisInstrumentRange, endDate);
        const bars = await window.mytrader.market.getDailyBars({
          symbol: key,
          startDate,
          endDate: resolvedEndDate,
          includeMoneyflow: false
        });
        if (analysisInstrumentLoadRequestIdRef.current !== requestId) return;
        options.setAnalysisInstrumentBars(bars);
      } catch (err) {
        if (analysisInstrumentLoadRequestIdRef.current !== requestId) return;
        options.setAnalysisInstrumentError(options.toUserErrorMessage(err));
        options.setAnalysisInstrumentProfile(null);
        options.setAnalysisInstrumentUserTags([]);
        options.setAnalysisInstrumentQuote(null);
        options.setAnalysisInstrumentBars([]);
      } finally {
        if (analysisInstrumentLoadRequestIdRef.current !== requestId) return;
        options.setAnalysisInstrumentLoading(false);
      }
    },
    [
      options.analysisInstrumentRange,
      options.formatInputDate,
      options.resolveMarketChartDateRange,
      options.setAnalysisInstrumentBars,
      options.setAnalysisInstrumentError,
      options.setAnalysisInstrumentLoading,
      options.setAnalysisInstrumentProfile,
      options.setAnalysisInstrumentQuote,
      options.setAnalysisInstrumentUserTags,
      options.snapshotPriceAsOf,
      options.toUserErrorMessage
    ]
  );

  useEffect(() => {
    if (options.activeView !== "data-analysis" || options.analysisTab !== "instrument") {
      return;
    }
    if (!window.mytrader) return;
    const query = options.analysisInstrumentQuery.trim();
    if (!query) {
      options.setAnalysisInstrumentSearchResults([]);
      options.setAnalysisInstrumentSearchLoading(false);
      return;
    }

    options.setAnalysisInstrumentSearchLoading(true);
    const requestId = analysisInstrumentSearchRequestIdRef.current + 1;
    analysisInstrumentSearchRequestIdRef.current = requestId;

    if (analysisInstrumentSearchTimerRef.current !== null) {
      window.clearTimeout(analysisInstrumentSearchTimerRef.current);
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await window.mytrader!.market.searchInstruments({
            query,
            limit: 50
          });
          if (analysisInstrumentSearchRequestIdRef.current !== requestId) return;
          options.setAnalysisInstrumentSearchResults(results);
        } catch (err) {
          if (analysisInstrumentSearchRequestIdRef.current !== requestId) return;
          options.setAnalysisInstrumentError(options.toUserErrorMessage(err));
          options.setAnalysisInstrumentSearchResults([]);
        } finally {
          if (analysisInstrumentSearchRequestIdRef.current !== requestId) return;
          options.setAnalysisInstrumentSearchLoading(false);
        }
      })();
    }, 250);

    analysisInstrumentSearchTimerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [
    options.activeView,
    options.analysisInstrumentQuery,
    options.analysisTab,
    options.setAnalysisInstrumentError,
    options.setAnalysisInstrumentSearchLoading,
    options.setAnalysisInstrumentSearchResults,
    options.toUserErrorMessage
  ]);

  useEffect(() => {
    if (options.activeView !== "data-analysis" || options.analysisTab !== "instrument") {
      return;
    }
    if (!options.analysisInstrumentSymbol) return;
    void loadAnalysisInstrument(options.analysisInstrumentSymbol);
  }, [
    loadAnalysisInstrument,
    options.activeView,
    options.analysisInstrumentSymbol,
    options.analysisTab
  ]);

  useEffect(() => {
    if (options.activeView !== "data-analysis" || options.analysisTab !== "instrument") {
      return;
    }
    if (options.analysisInstrumentSymbol) return;
    if (options.analysisInstrumentQuickSymbols.length === 0) return;
    options.setAnalysisInstrumentSymbol(options.analysisInstrumentQuickSymbols[0]);
  }, [
    options.activeView,
    options.analysisInstrumentQuickSymbols,
    options.analysisInstrumentSymbol,
    options.analysisTab,
    options.setAnalysisInstrumentSymbol
  ]);

  return {
    loadAnalysisInstrument
  };
}
