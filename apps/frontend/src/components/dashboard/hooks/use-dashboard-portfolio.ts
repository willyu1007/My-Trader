import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export interface UseDashboardPortfolioOptions<
  TPositionForm,
  TRiskForm,
  TLedgerForm,
  TLedgerFilter extends string
> {
  activePortfolioName: string | null;
  activePortfolioBaseCurrency: string | null;
  activePortfolioResetKey: string | null;
  emptyPositionForm: TPositionForm;
  emptyRiskForm: TRiskForm;
  createEmptyLedgerForm: (baseCurrency: string) => TLedgerForm;
  defaultBaseCurrency: string;
  defaultLedgerFilter: TLedgerFilter;
  defaultLedgerStartDate: string;
  defaultLedgerEndDate: string;
}

export interface UseDashboardPortfolioResult<
  TPositionForm,
  TRiskForm,
  TLedgerForm,
  TLedgerEntry,
  TLedgerFilter extends string
> {
  portfolioName: string;
  setPortfolioName: Dispatch<SetStateAction<string>>;
  portfolioBaseCurrency: string;
  setPortfolioBaseCurrency: Dispatch<SetStateAction<string>>;
  portfolioRename: string;
  setPortfolioRename: Dispatch<SetStateAction<string>>;
  positionForm: TPositionForm;
  setPositionForm: Dispatch<SetStateAction<TPositionForm>>;
  riskForm: TRiskForm;
  setRiskForm: Dispatch<SetStateAction<TRiskForm>>;
  ledgerEntries: TLedgerEntry[];
  setLedgerEntries: Dispatch<SetStateAction<TLedgerEntry[]>>;
  ledgerLoading: boolean;
  setLedgerLoading: Dispatch<SetStateAction<boolean>>;
  ledgerError: string | null;
  setLedgerError: Dispatch<SetStateAction<string | null>>;
  ledgerFilter: TLedgerFilter;
  setLedgerFilter: Dispatch<SetStateAction<TLedgerFilter>>;
  ledgerStartDate: string;
  setLedgerStartDate: Dispatch<SetStateAction<string>>;
  ledgerEndDate: string;
  setLedgerEndDate: Dispatch<SetStateAction<string>>;
  ledgerForm: TLedgerForm;
  setLedgerForm: Dispatch<SetStateAction<TLedgerForm>>;
  isLedgerFormOpen: boolean;
  setIsLedgerFormOpen: Dispatch<SetStateAction<boolean>>;
  ledgerDeleteTarget: TLedgerEntry | null;
  setLedgerDeleteTarget: Dispatch<SetStateAction<TLedgerEntry | null>>;
  holdingsCsvPath: string | null;
  setHoldingsCsvPath: Dispatch<SetStateAction<string | null>>;
  pricesCsvPath: string | null;
  setPricesCsvPath: Dispatch<SetStateAction<string | null>>;
}

export function useDashboardPortfolio<
  TPositionForm,
  TRiskForm,
  TLedgerForm,
  TLedgerEntry,
  TLedgerFilter extends string
>(
  options: UseDashboardPortfolioOptions<
    TPositionForm,
    TRiskForm,
    TLedgerForm,
    TLedgerFilter
  >
): UseDashboardPortfolioResult<
  TPositionForm,
  TRiskForm,
  TLedgerForm,
  TLedgerEntry,
  TLedgerFilter
> {
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioBaseCurrency, setPortfolioBaseCurrency] = useState(
    options.defaultBaseCurrency
  );
  const [portfolioRename, setPortfolioRename] = useState("");
  const [positionForm, setPositionForm] = useState<TPositionForm>(
    options.emptyPositionForm
  );
  const [riskForm, setRiskForm] = useState<TRiskForm>(options.emptyRiskForm);
  const [ledgerEntries, setLedgerEntries] = useState<TLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<TLedgerFilter>(
    options.defaultLedgerFilter
  );
  const [ledgerStartDate, setLedgerStartDate] = useState(
    options.defaultLedgerStartDate
  );
  const [ledgerEndDate, setLedgerEndDate] = useState(options.defaultLedgerEndDate);
  const [ledgerForm, setLedgerForm] = useState<TLedgerForm>(() =>
    options.createEmptyLedgerForm(options.defaultBaseCurrency)
  );
  const [isLedgerFormOpen, setIsLedgerFormOpen] = useState(false);
  const [ledgerDeleteTarget, setLedgerDeleteTarget] = useState<TLedgerEntry | null>(
    null
  );
  const [holdingsCsvPath, setHoldingsCsvPath] = useState<string | null>(null);
  const [pricesCsvPath, setPricesCsvPath] = useState<string | null>(null);

  useEffect(() => {
    if (!options.activePortfolioName) return;
    setPortfolioRename(options.activePortfolioName);
  }, [options.activePortfolioName]);

  useEffect(() => {
    if (!options.activePortfolioResetKey) {
      setLedgerForm(options.createEmptyLedgerForm(options.defaultBaseCurrency));
      setIsLedgerFormOpen(false);
      setLedgerDeleteTarget(null);
      setLedgerStartDate(options.defaultLedgerStartDate);
      setLedgerEndDate(options.defaultLedgerEndDate);
      return;
    }

    const baseCurrency =
      options.activePortfolioBaseCurrency ?? options.defaultBaseCurrency;
    setLedgerForm(options.createEmptyLedgerForm(baseCurrency));
    setLedgerFilter(options.defaultLedgerFilter);
    setIsLedgerFormOpen(false);
    setLedgerDeleteTarget(null);
    setLedgerStartDate(options.defaultLedgerStartDate);
    setLedgerEndDate(options.defaultLedgerEndDate);
  }, [
    options.activePortfolioBaseCurrency,
    options.activePortfolioResetKey,
    options.createEmptyLedgerForm,
    options.defaultBaseCurrency,
    options.defaultLedgerEndDate,
    options.defaultLedgerFilter,
    options.defaultLedgerStartDate
  ]);

  return {
    portfolioName,
    setPortfolioName,
    portfolioBaseCurrency,
    setPortfolioBaseCurrency,
    portfolioRename,
    setPortfolioRename,
    positionForm,
    setPositionForm,
    riskForm,
    setRiskForm,
    ledgerEntries,
    setLedgerEntries,
    ledgerLoading,
    setLedgerLoading,
    ledgerError,
    setLedgerError,
    ledgerFilter,
    setLedgerFilter,
    ledgerStartDate,
    setLedgerStartDate,
    ledgerEndDate,
    setLedgerEndDate,
    ledgerForm,
    setLedgerForm,
    isLedgerFormOpen,
    setIsLedgerFormOpen,
    ledgerDeleteTarget,
    setLedgerDeleteTarget,
    holdingsCsvPath,
    setHoldingsCsvPath,
    pricesCsvPath,
    setPricesCsvPath
  };
}
