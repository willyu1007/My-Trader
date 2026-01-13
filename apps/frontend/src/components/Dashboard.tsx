import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AccountSummary,
  AssetClass,
  CreatePositionInput,
  CreateRiskLimitInput,
  Portfolio,
  PortfolioSnapshot,
  PositionValuation,
  RiskLimit,
  RiskLimitType
} from "@mytrader/shared";

interface DashboardProps {
  account: AccountSummary;
  onLock: () => Promise<void>;
}

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

const emptyPositionForm: PositionFormState = {
  symbol: "",
  name: "",
  assetClass: "stock",
  market: "CN",
  currency: "CNY",
  quantity: "",
  cost: "",
  openDate: ""
};

const emptyRiskForm: RiskFormState = {
  limitType: "position_weight",
  target: "",
  thresholdPct: ""
};

const assetClassLabels: Record<AssetClass, string> = {
  stock: "股票",
  etf: "ETF",
  cash: "现金"
};

const riskLimitTypeLabels: Record<RiskLimitType, string> = {
  position_weight: "持仓权重",
  asset_class_weight: "资产类别权重"
};

export function Dashboard({ account, onLock }: DashboardProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioBaseCurrency, setPortfolioBaseCurrency] = useState("CNY");
  const [portfolioRename, setPortfolioRename] = useState("");

  const [positionForm, setPositionForm] = useState<PositionFormState>(
    emptyPositionForm
  );
  const [riskForm, setRiskForm] = useState<RiskFormState>(emptyRiskForm);

  const [holdingsCsvPath, setHoldingsCsvPath] = useState<string | null>(null);
  const [pricesCsvPath, setPricesCsvPath] = useState<string | null>(null);
  const [ingestStartDate, setIngestStartDate] = useState(
    formatInputDate(daysAgo(30))
  );
  const [ingestEndDate, setIngestEndDate] = useState(
    formatInputDate(new Date())
  );

  const activePortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === activePortfolioId) ?? null,
    [portfolios, activePortfolioId]
  );

  const loadPortfolios = useCallback(
    async (preferredId?: string | null) => {
      if (!window.mytrader) {
        setError("未检测到桌面端后端（preload API）。");
        return;
      }
      const list = await window.mytrader.portfolio.list();
      setPortfolios(list);
      const nextId = preferredId ?? list[0]?.id ?? null;
      setActivePortfolioId(nextId);
      if (nextId) {
        const selected = list.find((item) => item.id === nextId);
        setPortfolioRename(selected?.name ?? "");
      }
    },
    []
  );

  const loadSnapshot = useCallback(async (portfolioId: string) => {
    if (!window.mytrader) {
      setError("未检测到桌面端后端（preload API）。");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await window.mytrader.portfolio.getSnapshot(portfolioId);
      setSnapshot(data);
    } catch (err) {
      setError(toUserErrorMessage(err));
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolios().catch((err) => setError(toUserErrorMessage(err)));
  }, [loadPortfolios]);

  useEffect(() => {
    if (!activePortfolioId) {
      setSnapshot(null);
      return;
    }
    loadSnapshot(activePortfolioId).catch((err) =>
      setError(toUserErrorMessage(err))
    );
  }, [activePortfolioId, loadSnapshot]);

  useEffect(() => {
    if (!activePortfolio) return;
    setPortfolioRename(activePortfolio.name);
  }, [activePortfolio]);

  const handleCreatePortfolio = useCallback(async () => {
    if (!window.mytrader) return;
    setError(null);
    setNotice(null);
    const name = portfolioName.trim();
    if (!name) {
      setError("请输入组合名称。");
      return;
    }
    const created = await window.mytrader.portfolio.create({
      name,
      baseCurrency: portfolioBaseCurrency.trim() || "CNY"
    });
    setPortfolioName("");
    setPortfolioBaseCurrency("CNY");
    await loadPortfolios(created.id);
    setNotice(`组合已创建：${created.name}。`);
  }, [portfolioName, portfolioBaseCurrency, loadPortfolios]);

  const handleRenamePortfolio = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);
    const name = portfolioRename.trim();
    if (!name) {
      setError("请输入组合名称。");
      return;
    }
    const updated = await window.mytrader.portfolio.update({
      id: activePortfolio.id,
      name,
      baseCurrency: activePortfolio.baseCurrency
    });
    await loadPortfolios(updated.id);
    setNotice(`组合已重命名为：${updated.name}。`);
  }, [activePortfolio, portfolioRename, loadPortfolios]);

  const handleDeletePortfolio = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);
    await window.mytrader.portfolio.remove(activePortfolio.id);
    await loadPortfolios();
    setNotice("组合已删除。");
  }, [activePortfolio, loadPortfolios]);

  const handleEditPosition = useCallback((position: PositionValuation) => {
    setPositionForm({
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
  }, []);

  const handleCancelEditPosition = useCallback(() => {
    setPositionForm(emptyPositionForm);
  }, []);

  const handleSubmitPosition = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);

    const quantity = Number(positionForm.quantity);
    const costValue = positionForm.cost ? Number(positionForm.cost) : null;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("数量必须大于 0。");
      return;
    }
    if (positionForm.cost && !Number.isFinite(costValue)) {
      setError("成本必须是数字。");
      return;
    }
    if (!positionForm.symbol.trim()) {
      setError("请输入代码。");
      return;
    }
    if (!positionForm.market.trim() || !positionForm.currency.trim()) {
      setError("请输入市场与币种。");
      return;
    }

    const payload: CreatePositionInput = {
      portfolioId: activePortfolio.id,
      symbol: positionForm.symbol.trim(),
      name: positionForm.name.trim() || null,
      assetClass: positionForm.assetClass,
      market: positionForm.market.trim(),
      currency: positionForm.currency.trim(),
      quantity,
      cost: costValue,
      openDate: positionForm.openDate.trim() || null
    };

    if (positionForm.id) {
      await window.mytrader.position.update({ ...payload, id: positionForm.id });
      setNotice("持仓已更新。");
    } else {
      await window.mytrader.position.create(payload);
      setNotice("持仓已新增。");
    }

    setPositionForm(emptyPositionForm);
    await loadSnapshot(activePortfolio.id);
  }, [activePortfolio, positionForm, loadSnapshot]);

  const handleDeletePosition = useCallback(
    async (positionId: string) => {
      if (!window.mytrader || !activePortfolio) return;
      setError(null);
      setNotice(null);
      await window.mytrader.position.remove(positionId);
      await loadSnapshot(activePortfolio.id);
      setNotice("持仓已删除。");
    },
    [activePortfolio, loadSnapshot]
  );

  const handleEditRiskLimit = useCallback((limit: RiskLimit) => {
    setRiskForm({
      id: limit.id,
      limitType: limit.limitType,
      target: limit.target,
      thresholdPct: (limit.threshold * 100).toFixed(2)
    });
  }, []);

  const handleCancelRiskEdit = useCallback(() => {
    setRiskForm(emptyRiskForm);
  }, []);

  const handleSubmitRiskLimit = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);

    const threshold = Number(riskForm.thresholdPct) / 100;
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      setError("阈值必须在 0 到 100 之间。");
      return;
    }
    if (!riskForm.target.trim()) {
      setError("请输入目标。");
      return;
    }

    const payload: CreateRiskLimitInput = {
      portfolioId: activePortfolio.id,
      limitType: riskForm.limitType,
      target: riskForm.target.trim(),
      threshold
    };

    if (riskForm.id) {
      await window.mytrader.risk.update({ ...payload, id: riskForm.id });
      setNotice("风险限额已更新。");
    } else {
      await window.mytrader.risk.create(payload);
      setNotice("风险限额已新增。");
    }

    setRiskForm(emptyRiskForm);
    await loadSnapshot(activePortfolio.id);
  }, [activePortfolio, riskForm, loadSnapshot]);

  const handleDeleteRiskLimit = useCallback(
    async (riskLimitId: string) => {
      if (!window.mytrader || !activePortfolio) return;
      setError(null);
      setNotice(null);
      await window.mytrader.risk.remove(riskLimitId);
      await loadSnapshot(activePortfolio.id);
      setNotice("风险限额已删除。");
    },
    [activePortfolio, loadSnapshot]
  );

  const handleChooseCsv = useCallback(async (kind: "holdings" | "prices") => {
    if (!window.mytrader) return;
    setError(null);
    const selected = await window.mytrader.market.chooseCsvFile(kind);
    if (kind === "holdings") setHoldingsCsvPath(selected);
    else setPricesCsvPath(selected);
  }, []);

  const handleImportHoldings = useCallback(async () => {
    if (!window.mytrader || !activePortfolio || !holdingsCsvPath) return;
    setError(null);
    setNotice(null);
    const result = await window.mytrader.market.importHoldingsCsv({
      portfolioId: activePortfolio.id,
      filePath: holdingsCsvPath
    });
    await loadSnapshot(activePortfolio.id);
    setNotice(
      `持仓导入：新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}。`
    );
  }, [activePortfolio, holdingsCsvPath, loadSnapshot]);

  const handleImportPrices = useCallback(async () => {
    if (!window.mytrader || !pricesCsvPath) return;
    setError(null);
    setNotice(null);
    const result = await window.mytrader.market.importPricesCsv({
      filePath: pricesCsvPath,
      source: "csv"
    });
    if (activePortfolio) await loadSnapshot(activePortfolio.id);
    setNotice(`行情导入：新增 ${result.inserted} 条，跳过 ${result.skipped} 条。`);
  }, [pricesCsvPath, activePortfolio, loadSnapshot]);

  const handleIngestTushare = useCallback(async () => {
    if (!window.mytrader || !snapshot) return;
    setError(null);
    setNotice(null);
    const items = snapshot.positions.map((pos) => ({
      symbol: pos.position.symbol,
      assetClass: pos.position.assetClass
    }));
    const result = await window.mytrader.market.ingestTushare({
      items,
      startDate: ingestStartDate,
      endDate: ingestEndDate || null
    });
    await loadSnapshot(snapshot.portfolio.id);
    setNotice(`Tushare 拉取：新增 ${result.inserted} 条。`);
  }, [snapshot, ingestStartDate, ingestEndDate, loadSnapshot]);

  return (
    <div className="dashboard">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2 className="panelTitle">账号</h2>
            <p className="muted">当前账号：{account.label}</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onLock}>
            锁定
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2 className="panelTitle">组合</h2>
            <p className="muted">管理组合并设置当前使用组合。</p>
          </div>
        </div>
        <div className="panelBody">
          <div className="stack">
            <div className="formRowWide">
              <label className="formLabel">当前组合</label>
              <div className="inline">
                <select
                  value={activePortfolioId ?? ""}
                  onChange={(event) => setActivePortfolioId(event.target.value)}
                >
                  <option value="" disabled>
                    请选择组合
                  </option>
                  {portfolios.map((portfolio) => (
                    <option key={portfolio.id} value={portfolio.id}>
                      {portfolio.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() => loadPortfolios(activePortfolioId)}
                >
                  刷新
                </button>
              </div>
            </div>

            <div className="formRowWide">
              <label className="formLabel">重命名</label>
              <div className="inline">
                <input
                  type="text"
                  value={portfolioRename}
                  onChange={(event) => setPortfolioRename(event.target.value)}
                  placeholder="组合名称"
                />
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={handleRenamePortfolio}
                  disabled={!activePortfolio}
                >
                  更新
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={handleDeletePortfolio}
                  disabled={!activePortfolio}
                >
                  删除
                </button>
              </div>
            </div>

            <div className="divider" />

            <div className="formRowWide">
              <label className="formLabel">新建组合</label>
              <div className="inline">
                <input
                  type="text"
                  value={portfolioName}
                  onChange={(event) => setPortfolioName(event.target.value)}
                  placeholder="例如：核心持仓"
                />
                <input
                  type="text"
                  value={portfolioBaseCurrency}
                  onChange={(event) =>
                    setPortfolioBaseCurrency(event.target.value)
                  }
                  placeholder="基准币种"
                />
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={handleCreatePortfolio}
                  disabled={!portfolioName.trim()}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel panelGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2 className="panelTitle">持仓</h2>
              <p className="muted">添加持仓，跟踪估值与盈亏。</p>
            </div>
          </div>
          <div className="panelBody">
            {isLoading && <p className="muted">正在加载组合数据...</p>}
            {!isLoading && !activePortfolio && (
              <p className="muted">请先创建组合。</p>
            )}
            {!isLoading && activePortfolio && !snapshot && (
              <p className="muted">暂无估值快照。</p>
            )}
            {snapshot && (
              <>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>代码</th>
                        <th>名称</th>
                        <th>资产类别</th>
                        <th>数量</th>
                        <th>成本</th>
                        <th>最新价</th>
                        <th>市值</th>
                        <th>盈亏</th>
                        <th>权重</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.positions.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="muted">
                            暂无持仓。
                          </td>
                        </tr>
                      ) : (
                        snapshot.positions.map((pos) => (
                          <tr key={pos.position.id}>
                            <td>{pos.position.symbol}</td>
                            <td>{pos.position.name ?? "-"}</td>
                            <td>{formatAssetClassLabel(pos.position.assetClass)}</td>
                            <td>{formatNumber(pos.position.quantity)}</td>
                            <td>{formatCurrency(pos.position.cost)}</td>
                            <td>{formatCurrency(pos.latestPrice)}</td>
                            <td>{formatCurrency(pos.marketValue)}</td>
                            <td
                              className={
                                pos.pnl !== null && pos.pnl < 0 ? "textDanger" : ""
                              }
                            >
                              {formatCurrency(pos.pnl)}
                            </td>
                            <td>
                              {formatPct(
                                snapshot.exposures.bySymbol.find(
                                  (entry) => entry.key === pos.position.symbol
                                )?.weight ?? 0
                              )}
                            </td>
                            <td>
                              <div className="inline">
                                <button
                                  className="btn btn-secondary btn-sm"
                                  type="button"
                                  onClick={() => handleEditPosition(pos)}
                                >
                                  编辑
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  type="button"
                                  onClick={() =>
                                    handleDeletePosition(pos.position.id)
                                  }
                                >
                                  删除
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="summaryRow">
                  <span>总市值</span>
                  <strong>{formatCurrency(snapshot.totals.marketValue)}</strong>
                  <span>总盈亏</span>
                  <strong
                    className={
                      snapshot.totals.pnl < 0 ? "textDanger" : undefined
                    }
                  >
                    {formatCurrency(snapshot.totals.pnl)}
                  </strong>
                </div>
              </>
            )}

            {activePortfolio && (
              <>
                <div className="divider" />
                <h3 className="panelSubtitle">
                  {positionForm.id ? "编辑持仓" : "新增持仓"}
                </h3>
                <div className="stack">
                  <div className="formRowWide">
                    <label className="formLabel">代码</label>
                    <input
                      type="text"
                      value={positionForm.symbol}
                      onChange={(event) =>
                        setPositionForm((prev) => ({
                          ...prev,
                          symbol: event.target.value
                        }))
                      }
                      placeholder="例如：600519.SH"
                    />
                  </div>
                  <div className="formRowWide">
                    <label className="formLabel">名称</label>
                    <input
                      type="text"
                      value={positionForm.name}
                      onChange={(event) =>
                        setPositionForm((prev) => ({
                          ...prev,
                          name: event.target.value
                        }))
                      }
                    />
                  </div>
                  <div className="formRowWide">
                    <label className="formLabel">资产类别</label>
                    <select
                      value={positionForm.assetClass}
                      onChange={(event) =>
                        setPositionForm((prev) => ({
                          ...prev,
                          assetClass: event.target.value as AssetClass
                        }))
                      }
                    >
                      <option value="stock">股票</option>
                      <option value="etf">ETF</option>
                      <option value="cash">现金</option>
                    </select>
                  </div>
                  <div className="formRowWide">
                    <label className="formLabel">市场 / 币种</label>
                    <div className="inline">
                      <input
                        type="text"
                        value={positionForm.market}
                        onChange={(event) =>
                          setPositionForm((prev) => ({
                            ...prev,
                            market: event.target.value
                          }))
                        }
                        placeholder="CN"
                      />
                      <input
                        type="text"
                        value={positionForm.currency}
                        onChange={(event) =>
                          setPositionForm((prev) => ({
                            ...prev,
                            currency: event.target.value
                          }))
                        }
                        placeholder="CNY"
                      />
                    </div>
                  </div>
                  <div className="formRowWide">
                    <label className="formLabel">数量 / 成本</label>
                    <div className="inline">
                      <input
                        type="number"
                        value={positionForm.quantity}
                        onChange={(event) =>
                          setPositionForm((prev) => ({
                            ...prev,
                            quantity: event.target.value
                          }))
                        }
                        placeholder="数量"
                      />
                      <input
                        type="number"
                        value={positionForm.cost}
                        onChange={(event) =>
                          setPositionForm((prev) => ({
                            ...prev,
                            cost: event.target.value
                          }))
                        }
                        placeholder="成本价"
                      />
                    </div>
                  </div>
                  <div className="formRowWide">
                    <label className="formLabel">建仓日期</label>
                    <input
                      type="date"
                      value={positionForm.openDate}
                      onChange={(event) =>
                        setPositionForm((prev) => ({
                          ...prev,
                          openDate: event.target.value
                        }))
                      }
                    />
                  </div>
                  <div className="actions">
                    {positionForm.id && (
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={handleCancelEditPosition}
                      >
                        取消
                      </button>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      onClick={handleSubmitPosition}
                    >
                      {positionForm.id ? "更新" : "新增"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2 className="panelTitle">风险与敞口</h2>
              <p className="muted">跟踪集中度并执行风险限额。</p>
            </div>
          </div>
          <div className="panelBody">
            {!snapshot && <p className="muted">暂无风险数据。</p>}
            {snapshot && (
              <>
                <div className="panelSubgroup">
                  <h3 className="panelSubtitle">按资产类别敞口</h3>
                  {snapshot.exposures.byAssetClass.length === 0 ? (
                    <p className="muted">暂无敞口数据。</p>
                  ) : (
                    <ul className="list">
                      {snapshot.exposures.byAssetClass.map((entry) => (
                        <li key={entry.key} className="listRow">
                          <span>{formatAssetClassLabel(entry.key)}</span>
                          <span>{formatPct(entry.weight)}</span>
                          <span>{formatCurrency(entry.marketValue)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="panelSubgroup">
                  <h3 className="panelSubtitle">风险限额</h3>
                  {snapshot.riskLimits.length === 0 ? (
                    <p className="muted">尚未配置限额。</p>
                  ) : (
                    <ul className="list">
                      {snapshot.riskLimits.map((limit) => (
                        <li key={limit.id} className="listRow">
                          <span>
                            {formatRiskLimitTypeLabel(limit.limitType)} / {limit.target}
                          </span>
                          <span>{formatPct(limit.threshold)}</span>
                          <span className="inline">
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              onClick={() => handleEditRiskLimit(limit)}
                            >
                              编辑
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              onClick={() => handleDeleteRiskLimit(limit.id)}
                            >
                              删除
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="panelSubgroup">
                  <h3 className="panelSubtitle">
                    {riskForm.id ? "编辑限额" : "新增限额"}
                  </h3>
                  <div className="stack">
                    <div className="formRowWide">
                      <label className="formLabel">类型</label>
                      <select
                        value={riskForm.limitType}
                        onChange={(event) =>
                          setRiskForm((prev) => ({
                            ...prev,
                            limitType: event.target.value as RiskLimitType
                          }))
                        }
                      >
                        <option value="position_weight">持仓权重</option>
                        <option value="asset_class_weight">
                          资产类别权重
                        </option>
                      </select>
                    </div>
                    <div className="formRowWide">
                      <label className="formLabel">目标</label>
                      <input
                        type="text"
                        value={riskForm.target}
                        onChange={(event) =>
                          setRiskForm((prev) => ({
                            ...prev,
                            target: event.target.value
                          }))
                        }
                        placeholder="代码或资产类别"
                      />
                    </div>
                    <div className="formRowWide">
                      <label className="formLabel">阈值（%）</label>
                      <input
                        type="number"
                        value={riskForm.thresholdPct}
                        onChange={(event) =>
                          setRiskForm((prev) => ({
                            ...prev,
                            thresholdPct: event.target.value
                          }))
                        }
                        placeholder="例如：20"
                      />
                    </div>
                    <div className="actions">
                      {riskForm.id && (
                        <button
                          className="btn btn-secondary btn-sm"
                          type="button"
                          onClick={handleCancelRiskEdit}
                        >
                          取消
                        </button>
                      )}
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={handleSubmitRiskLimit}
                      >
                        {riskForm.id ? "更新" : "新增"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="panelSubgroup">
                  <h3 className="panelSubtitle">预警</h3>
                  {snapshot.riskWarnings.length === 0 ? (
                    <p className="muted">暂无预警。</p>
                  ) : (
                    <ul className="list">
                      {snapshot.riskWarnings.map((warning) => (
                        <li key={warning.limitId} className="listRow warningRow">
                          <span>{warning.message}</span>
                          <span>{formatPct(warning.actual)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2 className="panelTitle">行情数据</h2>
              <p className="muted">
                通过 CSV 导入或 Tushare 拉取更新估值。
              </p>
            </div>
          </div>
          <div className="panelBody">
            <div className="panelSubgroup">
              <p className="muted">
                最新行情日期：{snapshot?.priceAsOf ?? "--"}
              </p>
            </div>

            <div className="panelSubgroup">
              <h3 className="panelSubtitle">CSV 导入</h3>
              <div className="stack">
                <div className="formRowWide">
                  <label className="formLabel">持仓 CSV</label>
                  <div className="inline">
                    <input type="text" value={holdingsCsvPath ?? ""} readOnly />
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => handleChooseCsv("holdings")}
                    >
                      选择
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      onClick={handleImportHoldings}
                      disabled={!holdingsCsvPath || !activePortfolio}
                    >
                      导入
                    </button>
                  </div>
                </div>
                <div className="formRowWide">
                  <label className="formLabel">价格 CSV</label>
                  <div className="inline">
                    <input type="text" value={pricesCsvPath ?? ""} readOnly />
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => handleChooseCsv("prices")}
                    >
                      选择
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      onClick={handleImportPrices}
                      disabled={!pricesCsvPath}
                    >
                      导入
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="panelSubgroup">
              <h3 className="panelSubtitle">Tushare 拉取</h3>
              <div className="stack">
                <div className="formRowWide">
                  <label className="formLabel">日期范围</label>
                  <div className="inline">
                    <input
                      type="date"
                      value={ingestStartDate}
                      onChange={(event) => setIngestStartDate(event.target.value)}
                    />
                    <input
                      type="date"
                      value={ingestEndDate}
                      onChange={(event) => setIngestEndDate(event.target.value)}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      onClick={handleIngestTushare}
                      disabled={!snapshot || snapshot.positions.length === 0}
                    >
                      拉取
                    </button>
                  </div>
                </div>
                <p className="muted">
                  使用当前持仓代码拉取。请先设置 MYTRADER_TUSHARE_TOKEN。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {(error || notice) && (
        <div className={`alert ${error ? "alert-error" : "alert-info"}`}>
          <div className="alertIcon">!</div>
          <div className="alertBody">
            <div className="alertTitle">{error ? "错误" : "提示"}</div>
            <div className="alertMessage">{error ?? notice}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatAssetClassLabel(value: string): string {
  if (value in assetClassLabels) {
    return assetClassLabels[value as AssetClass];
  }
  return value;
}

function formatRiskLimitTypeLabel(value: RiskLimitType): string {
  return riskLimitTypeLabels[value] ?? value;
}

function toUserErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function formatInputDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
