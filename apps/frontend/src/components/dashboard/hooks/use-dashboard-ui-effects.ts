import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { PerformanceRangeKey } from "@mytrader/shared";

import type { PortfolioTab } from "../types";

export interface UseDashboardUiEffectsOptions {
  activeView: string;
  activePortfolioId: string | null;
  performanceRange: PerformanceRangeKey;
  error: string | null;
  notice: string | null;
  setMarketInstrumentDetailsOpen: Dispatch<SetStateAction<boolean>>;
  setMarketTagMembersModalOpen: Dispatch<SetStateAction<boolean>>;
  setPortfolioTab: Dispatch<SetStateAction<PortfolioTab>>;
  setShowAllSymbolContribution: Dispatch<SetStateAction<boolean>>;
  setShowAllAssetContribution: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
}

export function useDashboardUiEffects(options: UseDashboardUiEffectsOptions) {
  useEffect(() => {
    if (options.activeView === "market") return;
    options.setMarketInstrumentDetailsOpen(false);
    options.setMarketTagMembersModalOpen(false);
  }, [
    options.activeView,
    options.setMarketInstrumentDetailsOpen,
    options.setMarketTagMembersModalOpen
  ]);

  useEffect(() => {
    if (options.activeView === "portfolio") {
      options.setPortfolioTab("overview");
    }
  }, [options.activeView, options.setPortfolioTab]);

  useEffect(() => {
    options.setShowAllSymbolContribution(false);
    options.setShowAllAssetContribution(false);
  }, [
    options.activePortfolioId,
    options.performanceRange,
    options.setShowAllAssetContribution,
    options.setShowAllSymbolContribution
  ]);

  useEffect(() => {
    if (!options.error && !options.notice) return;
    const timer = window.setTimeout(() => {
      options.setError(null);
      options.setNotice(null);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [
    options.error,
    options.notice,
    options.setError,
    options.setNotice
  ]);
}
