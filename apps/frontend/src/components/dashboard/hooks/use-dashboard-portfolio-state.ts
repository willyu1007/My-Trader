import { useEffect, useMemo, useRef } from "react";

import type { Portfolio } from "@mytrader/shared";

import {
  useDashboardPortfolio
} from "./use-dashboard-portfolio";
import type { UseDashboardPortfolioOptions } from "./use-dashboard-portfolio";
import type { UseDashboardPortfolioResult } from "./use-dashboard-portfolio";

type ActivePortfolioChangedHandler = (portfolio: {
  id: string | null;
  name: string | null;
}) => void;

type PortfolioStateOptionsBase<
  TPositionForm,
  TRiskForm,
  TLedgerForm,
  TLedgerFilter extends string
> = Omit<
  UseDashboardPortfolioOptions<
    TPositionForm,
    TRiskForm,
    TLedgerForm,
    TLedgerFilter
  >,
  "activePortfolioName" | "activePortfolioBaseCurrency" | "activePortfolioResetKey"
>;

export interface UseDashboardPortfolioStateOptions<
  TPositionForm,
  TRiskForm,
  TLedgerForm,
  TLedgerFilter extends string
> extends PortfolioStateOptionsBase<
    TPositionForm,
    TRiskForm,
    TLedgerForm,
    TLedgerFilter
  > {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  onActivePortfolioChange?: ActivePortfolioChangedHandler;
}

export interface UseDashboardPortfolioStateResult<
  TPositionForm,
  TRiskForm,
  TLedgerForm,
  TLedgerEntry,
  TLedgerFilter extends string
> {
  activePortfolio: Portfolio | null;
  portfolioState: UseDashboardPortfolioResult<
    TPositionForm,
    TRiskForm,
    TLedgerForm,
    TLedgerEntry,
    TLedgerFilter
  >;
}

export function useDashboardPortfolioState<
  TPositionForm,
  TRiskForm,
  TLedgerForm,
  TLedgerEntry,
  TLedgerFilter extends string
>(
  options: UseDashboardPortfolioStateOptions<
    TPositionForm,
    TRiskForm,
    TLedgerForm,
    TLedgerFilter
  >
): UseDashboardPortfolioStateResult<
  TPositionForm,
  TRiskForm,
  TLedgerForm,
  TLedgerEntry,
  TLedgerFilter
> {
  const onActivePortfolioChangeRef = useRef(options.onActivePortfolioChange);
  const lastReportedPortfolioRef = useRef<{
    id: string | null;
    name: string | null;
  } | null>(null);

  useEffect(() => {
    onActivePortfolioChangeRef.current = options.onActivePortfolioChange;
  }, [options.onActivePortfolioChange]);

  const activePortfolio = useMemo(
    () =>
      options.portfolios.find(
        (portfolio) => portfolio.id === options.activePortfolioId
      ) ?? null,
    [options.portfolios, options.activePortfolioId]
  );

  const portfolioState = useDashboardPortfolio<
    TPositionForm,
    TRiskForm,
    TLedgerForm,
    TLedgerEntry,
    TLedgerFilter
  >({
    activePortfolioName: activePortfolio?.name ?? null,
    activePortfolioBaseCurrency: activePortfolio?.baseCurrency ?? null,
    activePortfolioResetKey: activePortfolio?.id ?? null,
    emptyPositionForm: options.emptyPositionForm,
    emptyRiskForm: options.emptyRiskForm,
    createEmptyLedgerForm: options.createEmptyLedgerForm,
    defaultBaseCurrency: options.defaultBaseCurrency,
    defaultLedgerFilter: options.defaultLedgerFilter,
    defaultLedgerStartDate: options.defaultLedgerStartDate,
    defaultLedgerEndDate: options.defaultLedgerEndDate
  });

  useEffect(() => {
    const callback = onActivePortfolioChangeRef.current;
    if (!callback) return;

    const nextPortfolio = {
      id: activePortfolio?.id ?? null,
      name: activePortfolio?.name ?? null
    };
    const lastReported = lastReportedPortfolioRef.current;
    if (
      lastReported?.id === nextPortfolio.id &&
      lastReported?.name === nextPortfolio.name
    ) {
      return;
    }

    lastReportedPortfolioRef.current = nextPortfolio;
    callback(nextPortfolio);
  }, [activePortfolio?.id, activePortfolio?.name]);

  return {
    activePortfolio,
    portfolioState
  };
}
