import { useMemo } from "react";

import type {
  LedgerEntry,
  LedgerEventType,
  PortfolioPerformanceRangeResult,
  PortfolioSnapshot
} from "@mytrader/shared";

import {
  formatLedgerEventType,
  sanitizeToastMessage
} from "../shared";

type LedgerFilter = "all" | LedgerEventType;

export interface UseDashboardPortfolioDerivedOptions {
  snapshot: PortfolioSnapshot | null;
  performanceResult: PortfolioPerformanceRangeResult | null;
  ledgerEntries: LedgerEntry[];
  ledgerFilter: LedgerFilter;
  ledgerStartDate: string;
  ledgerEndDate: string;
  ledgerDeleteTarget: LedgerEntry | null;
  error: string | null;
  notice: string | null;
}

export function useDashboardPortfolioDerived(
  options: UseDashboardPortfolioDerivedOptions
) {
  const cashTotal = useMemo(() => {
    if (!options.snapshot) return 0;
    return options.snapshot.positions.reduce((sum, valuation) => {
      if (valuation.position.assetClass !== "cash") return sum;
      return sum + (valuation.marketValue ?? valuation.position.quantity);
    }, 0);
  }, [options.snapshot]);

  const performance = options.performanceResult?.performance ?? null;
  const performanceSeries = options.performanceResult?.series ?? null;
  const performanceAnalysis = options.performanceResult?.analysis ?? null;
  const contributionBreakdown = performanceAnalysis?.contributions ?? null;
  const riskMetrics = performanceAnalysis?.riskMetrics ?? null;
  const dataQuality = options.snapshot?.dataQuality ?? null;

  const hhiValue = useMemo(() => {
    if (!options.snapshot) return null;
    return options.snapshot.exposures.bySymbol.reduce((sum, entry) => {
      return sum + entry.weight * entry.weight;
    }, 0);
  }, [options.snapshot]);

  const filteredLedgerEntries = useMemo(() => {
    let entries = options.ledgerEntries;
    if (options.ledgerFilter !== "all") {
      entries = entries.filter((entry) => {
        if (options.ledgerFilter === "corporate_action") {
          return (
            entry.eventType === "corporate_action" ||
            entry.eventType === "dividend"
          );
        }
        return entry.eventType === options.ledgerFilter;
      });
    }
    if (options.ledgerStartDate) {
      entries = entries.filter((entry) => entry.tradeDate >= options.ledgerStartDate);
    }
    if (options.ledgerEndDate) {
      entries = entries.filter((entry) => entry.tradeDate <= options.ledgerEndDate);
    }
    return entries;
  }, [
    options.ledgerEntries,
    options.ledgerEndDate,
    options.ledgerFilter,
    options.ledgerStartDate
  ]);

  const cashFlowTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredLedgerEntries.forEach((entry) => {
      if (entry.cashAmount === null || !entry.cashCurrency) return;
      totals.set(
        entry.cashCurrency,
        (totals.get(entry.cashCurrency) ?? 0) + entry.cashAmount
      );
    });
    return Array.from(totals.entries()).map(([currency, amount]) => ({
      currency,
      amount
    }));
  }, [filteredLedgerEntries]);

  const ledgerDeleteSummary = useMemo(() => {
    if (!options.ledgerDeleteTarget) return "";
    const symbolLabel =
      options.ledgerDeleteTarget.symbol ??
      options.ledgerDeleteTarget.instrumentId ??
      "无标的";
    return `${formatLedgerEventType(options.ledgerDeleteTarget.eventType)} · ${options.ledgerDeleteTarget.tradeDate} · ${symbolLabel}`;
  }, [options.ledgerDeleteTarget]);

  const toastMessage = useMemo(() => {
    if (options.error) return sanitizeToastMessage(options.error);
    return options.notice ?? "";
  }, [options.error, options.notice]);

  const selectedPerformance = useMemo(() => {
    if (!performance) return null;
    if (performance.selectedMethod === "twr") {
      return performance.twr;
    }
    if (performance.selectedMethod === "mwr") {
      return performance.mwr;
    }
    return null;
  }, [performance]);

  return {
    cashTotal,
    performance,
    performanceSeries,
    contributionBreakdown,
    riskMetrics,
    dataQuality,
    hhiValue,
    filteredLedgerEntries,
    cashFlowTotals,
    ledgerDeleteSummary,
    toastMessage,
    selectedPerformance
  };
}
