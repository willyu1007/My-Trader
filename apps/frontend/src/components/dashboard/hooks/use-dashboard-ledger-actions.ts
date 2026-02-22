import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  CorporateActionKind,
  CreateLedgerEntryInput,
  LedgerEntry,
  LedgerEventType,
  LedgerSide,
  LedgerSource,
  Portfolio
} from "@mytrader/shared";

import {
  createEmptyLedgerForm,
  deriveRateValue,
  formatCorporateAfterShares,
  formatDateTimeInput,
  formatLedgerEventType,
  isCorporateActionMeta,
  loadStoredRates,
  parseCorporateAfterShares,
  parseOptionalDateTimeInput,
  parseOptionalIntegerInput,
  parseOptionalNumberInput
} from "../shared";

type CorporateActionKindUi = CorporateActionKind | "dividend";

interface LedgerFormState {
  id?: string;
  eventType: LedgerEventType;
  tradeDate: string;
  eventTime: string;
  sequence: string;
  accountKey: string;
  instrumentId: string;
  symbol: string;
  side: LedgerSide | "";
  quantity: string;
  price: string;
  priceCurrency: string;
  cashAmount: string;
  cashCurrency: string;
  fee: string;
  tax: string;
  feeRate: string;
  taxRate: string;
  cashAmountAuto: boolean;
  note: string;
  source: LedgerSource;
  externalId: string;
  corporateKind: CorporateActionKindUi;
  corporateAfterShares: string;
}

export interface UseDashboardLedgerActionsOptions {
  activePortfolio: Portfolio | null;
  ledgerForm: LedgerFormState;
  ledgerDeleteTarget: LedgerEntry | null;
  holdingsCsvPath: string | null;
  pricesCsvPath: string | null;
  toUserErrorMessage: (err: unknown) => string;
  loadLedgerEntries: (portfolioId: string) => Promise<void>;
  loadSnapshot: (portfolioId: string) => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setLedgerForm: Dispatch<SetStateAction<LedgerFormState>>;
  setIsLedgerFormOpen: Dispatch<SetStateAction<boolean>>;
  setLedgerDeleteTarget: Dispatch<SetStateAction<LedgerEntry | null>>;
  setHoldingsCsvPath: Dispatch<SetStateAction<string | null>>;
  setPricesCsvPath: Dispatch<SetStateAction<string | null>>;
}

export function useDashboardLedgerActions(options: UseDashboardLedgerActionsOptions) {
  const updateLedgerForm = useCallback((patch: Partial<LedgerFormState>) => {
    options.setLedgerForm((prev) => ({ ...prev, ...patch }));
  }, [options.setLedgerForm]);

  const handleOpenLedgerForm = useCallback(() => {
    if (!options.activePortfolio) return;
    options.setLedgerForm(createEmptyLedgerForm(options.activePortfolio.baseCurrency));
    options.setIsLedgerFormOpen(true);
  }, [options.activePortfolio, options.setIsLedgerFormOpen, options.setLedgerForm]);

  const handleEditLedgerEntry = useCallback((entry: LedgerEntry) => {
    const storedRates = loadStoredRates(entry.eventType);
    const derivedFeeRate = deriveRateValue(entry.fee, entry.quantity, entry.price);
    const derivedTaxRate = deriveRateValue(entry.tax, entry.quantity, entry.price);
    const isDividendEntry = entry.eventType === "dividend";
    const corporateMeta = isCorporateActionMeta(entry.meta) ? entry.meta : null;
    const corporateAfterShares =
      !isDividendEntry && corporateMeta && corporateMeta.kind !== "info"
        ? formatCorporateAfterShares(corporateMeta.numerator, corporateMeta.denominator)
        : "";
    options.setLedgerForm({
      id: entry.id,
      eventType: isDividendEntry ? "corporate_action" : entry.eventType,
      tradeDate: entry.tradeDate,
      eventTime: formatDateTimeInput(entry.eventTs),
      sequence: entry.sequence?.toString() ?? "",
      accountKey: entry.accountKey ?? "",
      instrumentId: entry.instrumentId ?? "",
      symbol: entry.symbol ?? "",
      side: entry.side ?? "",
      quantity: entry.quantity?.toString() ?? "",
      price: entry.price?.toString() ?? "",
      priceCurrency: entry.priceCurrency ?? "",
      cashAmount: entry.cashAmount?.toString() ?? "",
      cashCurrency: entry.cashCurrency ?? "",
      fee: entry.fee?.toString() ?? "",
      tax: entry.tax?.toString() ?? "",
      feeRate: derivedFeeRate || storedRates.feeRate,
      taxRate: derivedTaxRate || storedRates.taxRate,
      cashAmountAuto: entry.cashAmount === null,
      note: entry.note ?? "",
      source: entry.source,
      externalId: entry.externalId ?? "",
      corporateKind: isDividendEntry ? "dividend" : corporateMeta?.kind ?? "split",
      corporateAfterShares
    });
    options.setIsLedgerFormOpen(true);
  }, [options.setIsLedgerFormOpen, options.setLedgerForm]);

  const handleCancelLedgerEdit = useCallback(() => {
    options.setLedgerForm(createEmptyLedgerForm(options.activePortfolio?.baseCurrency ?? "CNY"));
    options.setIsLedgerFormOpen(false);
  }, [options.activePortfolio, options.setIsLedgerFormOpen, options.setLedgerForm]);

  const handleSubmitLedgerEntry = useCallback(async () => {
    if (!window.mytrader || !options.activePortfolio) return;
    options.setError(null);
    options.setNotice(null);

    const tradeDate = options.ledgerForm.tradeDate.trim();
    if (!tradeDate) {
      options.setError("请输入交易日期。");
      return;
    }

    const eventType = options.ledgerForm.eventType;
    const isCorporateDividend =
      eventType === "corporate_action" && options.ledgerForm.corporateKind === "dividend";
    const effectiveEventType: LedgerEventType = isCorporateDividend
      ? "dividend"
      : eventType;
    const symbol = options.ledgerForm.symbol.trim();
    const instrumentId = options.ledgerForm.instrumentId.trim();
    const side = options.ledgerForm.side || null;
    const cashCurrency = options.ledgerForm.cashCurrency.trim();
    const priceCurrency = options.ledgerForm.priceCurrency.trim();
    const autoFeeTaxEnabled = effectiveEventType === "trade";
    const normalizedCurrency =
      effectiveEventType === "trade"
        ? priceCurrency || cashCurrency || options.activePortfolio.baseCurrency
        : cashCurrency || options.activePortfolio.baseCurrency;
    const normalizedPriceCurrency =
      effectiveEventType === "trade" ? normalizedCurrency : priceCurrency;
    const normalizedCashCurrency =
      effectiveEventType === "trade" ? normalizedCurrency : cashCurrency;

    let eventTs: number | null;
    let sequence: number | null;
    let quantity: number | null;
    let price: number | null;
    let cashAmount: number | null;
    let fee: number | null;
    let tax: number | null;
    let feeRate: number | null = null;
    let taxRate: number | null = null;

    try {
      eventTs = parseOptionalDateTimeInput(options.ledgerForm.eventTime, "事件时间");
      sequence = parseOptionalIntegerInput(options.ledgerForm.sequence, "排序序号");
      quantity = parseOptionalNumberInput(options.ledgerForm.quantity, "数量");
      price = parseOptionalNumberInput(options.ledgerForm.price, "价格");
      cashAmount = parseOptionalNumberInput(options.ledgerForm.cashAmount, "现金腿");
      fee = parseOptionalNumberInput(options.ledgerForm.fee, "费用");
      tax = parseOptionalNumberInput(options.ledgerForm.tax, "税费");
      if (autoFeeTaxEnabled) {
        feeRate = parseOptionalNumberInput(options.ledgerForm.feeRate, "费用费率");
        taxRate = parseOptionalNumberInput(options.ledgerForm.taxRate, "税费率");
      }
    } catch (err) {
      options.setError(options.toUserErrorMessage(err));
      return;
    }

    if (eventTs !== null && eventTs <= 0) {
      options.setError("事件时间格式不正确。");
      return;
    }
    if (sequence !== null && sequence < 0) {
      options.setError("排序序号不能为负数。");
      return;
    }
    if (quantity !== null && quantity < 0) {
      options.setError("数量不能为负数。");
      return;
    }
    if (price !== null && price < 0) {
      options.setError("价格不能为负数。");
      return;
    }
    if (fee !== null && fee < 0) {
      options.setError("费用必须为非负数。");
      return;
    }
    if (tax !== null && tax < 0) {
      options.setError("税费必须为非负数。");
      return;
    }
    if (autoFeeTaxEnabled) {
      if (feeRate === null || taxRate === null) {
        options.setError("请填写费用费率与税费率。");
        return;
      }
      if (feeRate < 0 || taxRate < 0) {
        options.setError("费率与税率不能为负数。");
        return;
      }
      if (quantity === null || price === null || quantity <= 0 || price < 0) {
        options.setError("自动计算费用/税费需要填写有效的数量与价格。");
        return;
      }
      const baseAmount = quantity * price;
      if (!Number.isFinite(baseAmount)) {
        options.setError("自动计算费用/税费需要有效的数量与价格。");
        return;
      }
      fee = Number((baseAmount * (feeRate / 100)).toFixed(2));
      tax = Number((baseAmount * (taxRate / 100)).toFixed(2));
    }

    if (
      ["trade", "dividend", "adjustment", "corporate_action"].includes(effectiveEventType) &&
      !symbol &&
      !instrumentId
    ) {
      options.setError("请输入代码或 instrumentId。");
      return;
    }

    if (
      (options.ledgerForm.source === "csv" || options.ledgerForm.source === "broker_import") &&
      sequence === null
    ) {
      options.setError("文件/券商导入需要填写排序序号。");
      return;
    }

    if (effectiveEventType === "trade") {
      if (!side) {
        options.setError("交易需要填写方向。");
        return;
      }
      if (!quantity || quantity <= 0) {
        options.setError("交易数量必须大于 0。");
        return;
      }
      if (price === null) {
        options.setError("交易需要填写价格。");
        return;
      }
      if (cashAmount === null || cashAmount === 0) {
        options.setError("交易需要填写现金腿金额。");
        return;
      }
      if (side === "buy" && cashAmount > 0) {
        options.setError("买入交易现金腿必须为负数。");
        return;
      }
      if (side === "sell" && cashAmount < 0) {
        options.setError("卖出交易现金腿必须为正数。");
        return;
      }
    }

    if (effectiveEventType === "cash") {
      if (cashAmount === null || cashAmount === 0) {
        options.setError("现金流需要填写金额。");
        return;
      }
      if (!normalizedCashCurrency) {
        options.setError("现金流需要填写币种。");
        return;
      }
    }

    if (effectiveEventType === "fee" || effectiveEventType === "tax") {
      if (cashAmount === null || cashAmount >= 0) {
        options.setError(`${formatLedgerEventType(effectiveEventType)} 需要填写负数金额。`);
        return;
      }
      if (!normalizedCashCurrency) {
        options.setError(`${formatLedgerEventType(effectiveEventType)} 需要填写币种。`);
        return;
      }
    }

    if (effectiveEventType === "dividend") {
      if (cashAmount === null || cashAmount <= 0) {
        options.setError("分红需要填写正数金额。");
        return;
      }
      if (!normalizedCashCurrency) {
        options.setError("分红需要填写币种。");
        return;
      }
    }

    if (effectiveEventType === "adjustment") {
      if (!side) {
        options.setError("持仓调整需要填写方向。");
        return;
      }
      if (!quantity || quantity <= 0) {
        options.setError("持仓调整数量必须大于 0。");
        return;
      }
    }

    let meta: CreateLedgerEntryInput["meta"] = null;
    if (eventType === "corporate_action" && !isCorporateDividend) {
      if (options.ledgerForm.corporateKind === "info") {
        options.setError("公司行为不支持信息类型。");
        return;
      }
      let ratio: { numerator: number; denominator: number };
      try {
        ratio = parseCorporateAfterShares(options.ledgerForm.corporateAfterShares);
      } catch (err) {
        options.setError(options.toUserErrorMessage(err));
        return;
      }
      meta = {
        kind: options.ledgerForm.corporateKind,
        numerator: ratio.numerator,
        denominator: ratio.denominator
      };
    }

    const payloadEventType = isCorporateDividend ? "dividend" : eventType;
    const payload: CreateLedgerEntryInput = {
      portfolioId: options.activePortfolio.id,
      accountKey: options.ledgerForm.accountKey.trim() || null,
      eventType: payloadEventType,
      tradeDate,
      eventTs,
      sequence,
      instrumentId: instrumentId || null,
      symbol: symbol || null,
      side,
      quantity,
      price,
      priceCurrency: normalizedPriceCurrency || null,
      cashAmount,
      cashCurrency: normalizedCashCurrency || null,
      fee,
      tax,
      note: options.ledgerForm.note.trim() || null,
      source: options.ledgerForm.source,
      externalId: options.ledgerForm.externalId.trim() || null,
      meta
    };

    if (options.ledgerForm.id) {
      await window.mytrader.ledger.update({ ...payload, id: options.ledgerForm.id });
      options.setNotice("流水已更新。");
    } else {
      await window.mytrader.ledger.create(payload);
      options.setNotice("流水已新增。");
    }

    options.setLedgerForm(createEmptyLedgerForm(options.activePortfolio.baseCurrency));
    options.setIsLedgerFormOpen(false);
    await options.loadLedgerEntries(options.activePortfolio.id);
    await options.loadSnapshot(options.activePortfolio.id);
  }, [
    options.activePortfolio,
    options.ledgerForm,
    options.loadLedgerEntries,
    options.loadSnapshot,
    options.setError,
    options.setIsLedgerFormOpen,
    options.setLedgerForm,
    options.setNotice,
    options.toUserErrorMessage
  ]);

  const handleRequestDeleteLedgerEntry = useCallback((entry: LedgerEntry) => {
    options.setLedgerDeleteTarget(entry);
  }, [options.setLedgerDeleteTarget]);

  const handleConfirmDeleteLedgerEntry = useCallback(async () => {
    if (!window.mytrader || !options.activePortfolio || !options.ledgerDeleteTarget) {
      return;
    }
    options.setError(null);
    options.setNotice(null);
    const entryId = options.ledgerDeleteTarget.id;
    options.setLedgerDeleteTarget(null);
    await window.mytrader.ledger.remove(entryId);
    await options.loadLedgerEntries(options.activePortfolio.id);
    await options.loadSnapshot(options.activePortfolio.id);
    options.setNotice("流水已删除。");
  }, [
    options.activePortfolio,
    options.ledgerDeleteTarget,
    options.loadLedgerEntries,
    options.loadSnapshot,
    options.setError,
    options.setLedgerDeleteTarget,
    options.setNotice
  ]);

  const handleCancelDeleteLedgerEntry = useCallback(() => {
    options.setLedgerDeleteTarget(null);
  }, [options.setLedgerDeleteTarget]);

  const handleChooseCsv = useCallback(async (kind: "holdings" | "prices") => {
    if (!window.mytrader) return;
    options.setError(null);
    const selected = await window.mytrader.market.chooseCsvFile(kind);
    if (kind === "holdings") options.setHoldingsCsvPath(selected);
    else options.setPricesCsvPath(selected);
  }, [options.setError, options.setHoldingsCsvPath, options.setPricesCsvPath]);

  const handleImportHoldings = useCallback(async () => {
    if (!window.mytrader || !options.activePortfolio || !options.holdingsCsvPath) return;
    options.setError(null);
    options.setNotice(null);
    const result = await window.mytrader.market.importHoldingsCsv({
      portfolioId: options.activePortfolio.id,
      filePath: options.holdingsCsvPath
    });
    await options.loadSnapshot(options.activePortfolio.id);
    options.setNotice(
      `持仓导入：新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}。`
    );
  }, [
    options.activePortfolio,
    options.holdingsCsvPath,
    options.loadSnapshot,
    options.setError,
    options.setNotice
  ]);

  const handleImportPrices = useCallback(async () => {
    if (!window.mytrader || !options.pricesCsvPath) return;
    options.setError(null);
    options.setNotice(null);
    const result = await window.mytrader.market.importPricesCsv({
      filePath: options.pricesCsvPath,
      source: "csv"
    });
    if (options.activePortfolio) {
      await options.loadSnapshot(options.activePortfolio.id);
    }
    options.setNotice(`行情导入：新增 ${result.inserted} 条，跳过 ${result.skipped} 条。`);
  }, [
    options.activePortfolio,
    options.loadSnapshot,
    options.pricesCsvPath,
    options.setError,
    options.setNotice
  ]);

  return {
    updateLedgerForm,
    handleOpenLedgerForm,
    handleEditLedgerEntry,
    handleCancelLedgerEdit,
    handleSubmitLedgerEntry,
    handleRequestDeleteLedgerEntry,
    handleConfirmDeleteLedgerEntry,
    handleCancelDeleteLedgerEntry,
    handleChooseCsv,
    handleImportHoldings,
    handleImportPrices
  };
}
