import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  AssetClass,
  CreatePositionInput,
  CreateRiskLimitInput,
  Portfolio,
  PositionValuation,
  RiskLimit,
  RiskLimitType
} from "@mytrader/shared";

interface PositionFormState {
  id?: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  market: string;
  currency: string;
  quantity: string;
  cost: string;
  openDate: string;
}

interface RiskFormState {
  id?: string;
  limitType: RiskLimitType;
  target: string;
  thresholdPct: string;
}

export interface UseDashboardPortfolioActionsOptions {
  activePortfolio: Portfolio | null;
  portfolioName: string;
  portfolioBaseCurrency: string;
  portfolioRename: string;
  positionForm: PositionFormState;
  riskForm: RiskFormState;
  emptyPositionForm: PositionFormState;
  emptyRiskForm: RiskFormState;
  loadPortfolios: (nextActiveId?: string) => Promise<void>;
  loadSnapshot: (portfolioId: string) => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPortfolioName: Dispatch<SetStateAction<string>>;
  setPortfolioBaseCurrency: Dispatch<SetStateAction<string>>;
  setPositionForm: Dispatch<SetStateAction<PositionFormState>>;
  setRiskForm: Dispatch<SetStateAction<RiskFormState>>;
}

export function useDashboardPortfolioActions(
  options: UseDashboardPortfolioActionsOptions
) {
  const handleCreatePortfolio = useCallback(async () => {
    if (!window.mytrader) return;
    options.setError(null);
    options.setNotice(null);
    const name = options.portfolioName.trim();
    if (!name) {
      options.setError("请输入组合名称。");
      return;
    }
    const created = await window.mytrader.portfolio.create({
      name,
      baseCurrency: options.portfolioBaseCurrency.trim() || "CNY"
    });
    options.setPortfolioName("");
    options.setPortfolioBaseCurrency("CNY");
    await options.loadPortfolios(created.id);
    options.setNotice(`组合已创建：${created.name}。`);
  }, [
    options.loadPortfolios,
    options.portfolioBaseCurrency,
    options.portfolioName,
    options.setError,
    options.setNotice,
    options.setPortfolioBaseCurrency,
    options.setPortfolioName
  ]);

  const handleRenamePortfolio = useCallback(async () => {
    if (!window.mytrader || !options.activePortfolio) return;
    options.setError(null);
    options.setNotice(null);
    const name = options.portfolioRename.trim();
    if (!name) {
      options.setError("请输入组合名称。");
      return;
    }
    const updated = await window.mytrader.portfolio.update({
      id: options.activePortfolio.id,
      name,
      baseCurrency: options.activePortfolio.baseCurrency
    });
    await options.loadPortfolios(updated.id);
    options.setNotice(`组合已重命名为：${updated.name}。`);
  }, [
    options.activePortfolio,
    options.loadPortfolios,
    options.portfolioRename,
    options.setError,
    options.setNotice
  ]);

  const handleDeletePortfolio = useCallback(async () => {
    if (!window.mytrader || !options.activePortfolio) return;
    options.setError(null);
    options.setNotice(null);
    await window.mytrader.portfolio.remove(options.activePortfolio.id);
    await options.loadPortfolios();
    options.setNotice("组合已删除。");
  }, [options.activePortfolio, options.loadPortfolios, options.setError, options.setNotice]);

  const handleEditPosition = useCallback(
    (position: PositionValuation) => {
      options.setPositionForm({
        id: position.position.id,
        symbol: position.position.symbol,
        name: position.position.name ?? "",
        assetClass: position.position.assetClass,
        market: position.position.market,
        currency: position.position.currency,
        quantity: String(position.position.quantity),
        cost: position.position.cost?.toString() ?? "",
        openDate: position.position.openDate ?? ""
      });
    },
    [options.setPositionForm]
  );

  const handleCancelEditPosition = useCallback(() => {
    options.setPositionForm(options.emptyPositionForm);
  }, [options.emptyPositionForm, options.setPositionForm]);

  const handleSubmitPosition = useCallback(async () => {
    if (!window.mytrader || !options.activePortfolio) return;
    options.setError(null);
    options.setNotice(null);

    const quantity = Number(options.positionForm.quantity);
    const costValue = options.positionForm.cost ? Number(options.positionForm.cost) : null;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      options.setError("数量必须大于 0。");
      return;
    }
    if (options.positionForm.cost && !Number.isFinite(costValue)) {
      options.setError("成本必须是数字。");
      return;
    }
    if (!options.positionForm.symbol.trim()) {
      options.setError("请输入代码。");
      return;
    }
    if (!options.positionForm.market.trim() || !options.positionForm.currency.trim()) {
      options.setError("请输入市场与币种。");
      return;
    }

    const payload: CreatePositionInput = {
      portfolioId: options.activePortfolio.id,
      symbol: options.positionForm.symbol.trim(),
      name: options.positionForm.name.trim() || null,
      assetClass: options.positionForm.assetClass,
      market: options.positionForm.market.trim(),
      currency: options.positionForm.currency.trim(),
      quantity,
      cost: costValue,
      openDate: options.positionForm.openDate.trim() || null
    };

    if (options.positionForm.id) {
      await window.mytrader.position.update({ ...payload, id: options.positionForm.id });
      options.setNotice("持仓已更新。");
    } else {
      await window.mytrader.position.create(payload);
      options.setNotice("持仓已新增。");
    }

    options.setPositionForm(options.emptyPositionForm);
    await options.loadSnapshot(options.activePortfolio.id);
  }, [
    options.activePortfolio,
    options.emptyPositionForm,
    options.loadSnapshot,
    options.positionForm,
    options.setError,
    options.setNotice,
    options.setPositionForm
  ]);

  const handleDeletePosition = useCallback(
    async (positionId: string) => {
      if (!window.mytrader || !options.activePortfolio) return;
      options.setError(null);
      options.setNotice(null);
      await window.mytrader.position.remove(positionId);
      await options.loadSnapshot(options.activePortfolio.id);
      options.setNotice("持仓已删除。");
    },
    [options.activePortfolio, options.loadSnapshot, options.setError, options.setNotice]
  );

  const handleEditRiskLimit = useCallback(
    (limit: RiskLimit) => {
      options.setRiskForm({
        id: limit.id,
        limitType: limit.limitType,
        target: limit.target,
        thresholdPct: (limit.threshold * 100).toFixed(2)
      });
    },
    [options.setRiskForm]
  );

  const handleCancelRiskEdit = useCallback(() => {
    options.setRiskForm(options.emptyRiskForm);
  }, [options.emptyRiskForm, options.setRiskForm]);

  const handleSubmitRiskLimit = useCallback(async () => {
    if (!window.mytrader || !options.activePortfolio) return;
    options.setError(null);
    options.setNotice(null);

    const threshold = Number(options.riskForm.thresholdPct) / 100;
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      options.setError("阈值必须在 0 到 100 之间。");
      return;
    }
    if (!options.riskForm.target.trim()) {
      options.setError("请输入目标。");
      return;
    }

    const payload: CreateRiskLimitInput = {
      portfolioId: options.activePortfolio.id,
      limitType: options.riskForm.limitType,
      target: options.riskForm.target.trim(),
      threshold
    };

    if (options.riskForm.id) {
      await window.mytrader.risk.update({ ...payload, id: options.riskForm.id });
      options.setNotice("风险限额已更新。");
    } else {
      await window.mytrader.risk.create(payload);
      options.setNotice("风险限额已新增。");
    }

    options.setRiskForm(options.emptyRiskForm);
    await options.loadSnapshot(options.activePortfolio.id);
  }, [
    options.activePortfolio,
    options.emptyRiskForm,
    options.loadSnapshot,
    options.riskForm,
    options.setError,
    options.setNotice,
    options.setRiskForm
  ]);

  const handleDeleteRiskLimit = useCallback(
    async (riskLimitId: string) => {
      if (!window.mytrader || !options.activePortfolio) return;
      options.setError(null);
      options.setNotice(null);
      await window.mytrader.risk.remove(riskLimitId);
      await options.loadSnapshot(options.activePortfolio.id);
      options.setNotice("风险限额已删除。");
    },
    [options.activePortfolio, options.loadSnapshot, options.setError, options.setNotice]
  );

  return {
    handleCreatePortfolio,
    handleRenamePortfolio,
    handleDeletePortfolio,
    handleEditPosition,
    handleCancelEditPosition,
    handleSubmitPosition,
    handleDeletePosition,
    handleEditRiskLimit,
    handleCancelRiskEdit,
    handleSubmitRiskLimit,
    handleDeleteRiskLimit
  };
}
