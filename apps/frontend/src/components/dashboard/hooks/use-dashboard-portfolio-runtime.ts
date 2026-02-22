import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  LedgerEntry,
  PerformanceRangeKey,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioSnapshot
} from "@mytrader/shared";

export interface UseDashboardPortfolioRuntimeOptions {
  activePortfolioId: string | null;
  activeView: string;
  analysisTab: string;
  portfolioTab: string;
  performanceRange: PerformanceRangeKey;
  toUserErrorMessage: (err: unknown) => string;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setPortfolios: Dispatch<SetStateAction<Portfolio[]>>;
  setActivePortfolioId: Dispatch<SetStateAction<string | null>>;
  setPortfolioRename: Dispatch<SetStateAction<string>>;
  setSnapshot: Dispatch<SetStateAction<PortfolioSnapshot | null>>;
  setLedgerEntries: Dispatch<SetStateAction<LedgerEntry[]>>;
  setLedgerLoading: Dispatch<SetStateAction<boolean>>;
  setLedgerError: Dispatch<SetStateAction<string | null>>;
  setPerformanceLoading: Dispatch<SetStateAction<boolean>>;
  setPerformanceError: Dispatch<SetStateAction<string | null>>;
  setPerformanceResult: Dispatch<
    SetStateAction<PortfolioPerformanceRangeResult | null>
  >;
}

export function useDashboardPortfolioRuntime(
  options: UseDashboardPortfolioRuntimeOptions
) {
  const loadPortfolios = useCallback(
    async (preferredId?: string | null) => {
      if (!window.mytrader) {
        options.setError("未检测到桌面端后端接口。");
        return;
      }
      const list = await window.mytrader.portfolio.list();
      options.setPortfolios(list);
      const nextId = preferredId ?? list[0]?.id ?? null;
      options.setActivePortfolioId(nextId);
      if (nextId) {
        const selected = list.find((item) => item.id === nextId);
        options.setPortfolioRename(selected?.name ?? "");
      }
    },
    [
      options.setActivePortfolioId,
      options.setError,
      options.setPortfolioRename,
      options.setPortfolios
    ]
  );

  const loadSnapshot = useCallback(
    async (portfolioId: string) => {
      if (!window.mytrader) {
        options.setError("未检测到桌面端后端接口。");
        return;
      }
      options.setIsLoading(true);
      options.setError(null);
      try {
        const data = await window.mytrader.portfolio.getSnapshot(portfolioId);
        options.setSnapshot(data);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
        options.setSnapshot(null);
      } finally {
        options.setIsLoading(false);
      }
    },
    [
      options.setError,
      options.setIsLoading,
      options.setSnapshot,
      options.toUserErrorMessage
    ]
  );

  const loadLedgerEntries = useCallback(
    async (portfolioId: string) => {
      if (!window.mytrader) {
        options.setLedgerError("未检测到桌面端后端接口。");
        return;
      }
      options.setLedgerLoading(true);
      options.setLedgerError(null);
      try {
        const entries = await window.mytrader.ledger.list(portfolioId);
        options.setLedgerEntries(entries);
      } catch (err) {
        options.setLedgerError(options.toUserErrorMessage(err));
      } finally {
        options.setLedgerLoading(false);
      }
    },
    [
      options.setLedgerEntries,
      options.setLedgerError,
      options.setLedgerLoading,
      options.toUserErrorMessage
    ]
  );

  const loadPerformance = useCallback(
    async (portfolioId: string, range: PerformanceRangeKey) => {
      if (!window.mytrader) {
        options.setPerformanceError("未检测到桌面端后端接口。");
        return;
      }
      options.setPerformanceLoading(true);
      options.setPerformanceError(null);
      try {
        const data = await window.mytrader.portfolio.getPerformance({
          portfolioId,
          range
        });
        options.setPerformanceResult(data);
      } catch (err) {
        options.setPerformanceError(options.toUserErrorMessage(err));
        options.setPerformanceResult(null);
      } finally {
        options.setPerformanceLoading(false);
      }
    },
    [
      options.setPerformanceError,
      options.setPerformanceLoading,
      options.setPerformanceResult,
      options.toUserErrorMessage
    ]
  );

  useEffect(() => {
    loadPortfolios().catch((err) => options.setError(options.toUserErrorMessage(err)));
  }, [loadPortfolios, options.setError, options.toUserErrorMessage]);

  useEffect(() => {
    if (!options.activePortfolioId) {
      options.setSnapshot(null);
      return;
    }
    loadSnapshot(options.activePortfolioId).catch((err) =>
      options.setError(options.toUserErrorMessage(err))
    );
  }, [
    loadSnapshot,
    options.activePortfolioId,
    options.setError,
    options.setSnapshot,
    options.toUserErrorMessage
  ]);

  useEffect(() => {
    if (!options.activePortfolioId) {
      options.setPerformanceResult(null);
      return;
    }

    const shouldLoadPerformance =
      (options.activeView === "data-analysis" && options.analysisTab === "portfolio") ||
      (options.activeView === "portfolio" &&
        (options.portfolioTab === "performance" ||
          options.portfolioTab === "risk"));
    if (!shouldLoadPerformance) return;

    loadPerformance(options.activePortfolioId, options.performanceRange).catch((err) =>
      options.setPerformanceError(options.toUserErrorMessage(err))
    );
  }, [
    loadPerformance,
    options.activePortfolioId,
    options.activeView,
    options.analysisTab,
    options.performanceRange,
    options.portfolioTab,
    options.setPerformanceError,
    options.setPerformanceResult,
    options.toUserErrorMessage
  ]);

  useEffect(() => {
    if (!options.activePortfolioId) {
      options.setLedgerEntries([]);
      return;
    }
    if (options.portfolioTab !== "trades") return;
    loadLedgerEntries(options.activePortfolioId).catch((err) =>
      options.setLedgerError(options.toUserErrorMessage(err))
    );
  }, [
    loadLedgerEntries,
    options.activePortfolioId,
    options.portfolioTab,
    options.setLedgerEntries,
    options.setLedgerError,
    options.toUserErrorMessage
  ]);

  return {
    loadPortfolios,
    loadSnapshot,
    loadLedgerEntries,
    loadPerformance
  };
}
