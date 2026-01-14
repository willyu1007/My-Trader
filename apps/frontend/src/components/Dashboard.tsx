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

const navItems = [
  {
    key: "portfolio",
    label: "投资组合",
    meta: "概览",
    description: "集中查看组合、持仓与估值变化。",
    icon: "pie_chart"
  },
  {
    key: "risk",
    label: "风险管理",
    meta: "敞口/限额",
    description: "跟踪风险敞口、限额与预警。",
    icon: "shield"
  },
  {
    key: "market",
    label: "市场行情",
    meta: "数据/报价",
    description: "导入行情与价格数据，更新估值。",
    icon: "show_chart"
  },
  {
    key: "opportunities",
    label: "机会",
    meta: "扫描/策略",
    description: "聚合潜在机会与策略提示。",
    icon: "lightbulb"
  },
  {
    key: "backtest",
    label: "回测",
    meta: "历史验证",
    description: "回测策略并对比历史表现。",
    icon: "query_stats"
  },
  {
    key: "insights",
    label: "观点",
    meta: "研究/复盘",
    description: "记录观点、研究与复盘笔记。",
    icon: "insights"
  },
  {
    key: "alerts",
    label: "提醒",
    meta: "预警/到价",
    description: "集中管理交易提醒与到价预警。",
    icon: "notifications_active"
  },
  {
    key: "other",
    label: "其他",
    meta: "工具箱",
    description: "工具与实验功能入口。",
    icon: "more_horiz"
  },
  {
    key: "account",
    label: "账号",
    meta: "权限/锁定",
    description: "账号信息、权限与锁定管理。",
    icon: "manage_accounts"
  }
] as const;

type WorkspaceView = (typeof navItems)[number]["key"];

export function Dashboard({ account, onLock }: DashboardProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("portfolio");
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

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
    <div className="flex h-full bg-white dark:bg-[#0B0E14] overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isNavCollapsed ? "w-16" : "w-40"
        } flex-shrink-0 bg-[#0f172a] border-r border-slate-800 flex flex-col transition-all duration-300 z-20`}
      >
        <div className="flex items-center justify-between p-2 border-b border-slate-800 h-10">
          <p className={`text-xs font-semibold text-slate-400 ${isNavCollapsed ? "hidden" : "block"}`}>
            导航
          </p>
          <button
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            type="button"
            onClick={() => setIsNavCollapsed((prev) => !prev)}
            aria-label={isNavCollapsed ? "展开导航" : "收起导航"}
          >
            <span className="material-icons-outlined text-lg">
              {isNavCollapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>
        
        {/* Account info moved to global top bar */}

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.key === activeView;
            return (
              <button
                key={item.key}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group
                  ${isActive 
                    ? "bg-primary text-white font-medium" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }
                  ${isNavCollapsed ? "justify-center px-2" : ""}
                `}
                type="button"
                onClick={() => setActiveView(item.key)}
                title={item.label}
              >
                <span className={`material-icons-outlined ${isNavCollapsed ? "text-xl" : "text-lg"} ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>
                  {item.icon}
                </span>
                {!isNavCollapsed && (
                  <div className="flex flex-col items-start text-left leading-tight">
                    <span>{item.label}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white dark:bg-[#0B0E14]">
        {/* Top Navigation / Toolbar */}
        <div className="h-10 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 flex-shrink-0 bg-white dark:bg-[#0B0E14]">
           <div className="flex items-center gap-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {navItems.find(n => n.key === activeView)?.label}
              </h2>
              {/* Optional: Breadcrumbs or View Switcher here */}
           </div>
           <div className="flex items-center gap-2">
              {activeView === "account" && (
                 <Button variant="secondary" size="sm" onClick={onLock} icon="lock">锁定</Button>
              )}
              {activeView === "portfolio" && (
                 <Button variant="secondary" size="sm" onClick={() => loadPortfolios(activePortfolioId)} icon="refresh">刷新</Button>
              )}
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0 scroll-smooth">
          
          {/* View: Account */}
          {activeView === "account" && (
            <Panel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-w-4xl">
                 <DescriptionItem label="当前账号" value={account.label} />
                 <DescriptionItem label="账号 ID" value={<span className="font-mono text-xs">{account.id}</span>} />
                 <DescriptionItem label="数据目录" value={<span className="font-mono text-xs">{account.dataDir}</span>} />
                 <DescriptionItem label="创建时间" value={formatDateTime(account.createdAt)} />
                 <DescriptionItem label="最近登录" value={formatDateTime(account.lastLoginAt)} />
              </div>
            </Panel>
          )}

          {/* View: Portfolio */}
          {activeView === "portfolio" && (
            <>
              <Panel>
                <div className="space-y-6 max-w-5xl">
                  {/* Selector & Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormGroup label="切换组合">
                        <Select
                          value={activePortfolioId ?? ""}
                          onChange={(e) => setActivePortfolioId(e.target.value)}
                          options={[
                            { value: "", label: "请选择组合", disabled: true },
                            ...portfolios.map(p => ({ value: p.id, label: p.name }))
                          ]}
                          className="w-full"
                        />
                    </FormGroup>
                    
                    <FormGroup label="重命名当前组合">
                       <div className="flex gap-2">
                          <Input 
                            value={portfolioRename}
                            onChange={(e) => setPortfolioRename(e.target.value)}
                            placeholder="组合名称"
                            className="flex-1"
                          />
                          <Button variant="secondary" onClick={handleRenamePortfolio} disabled={!activePortfolio}>更新</Button>
                          <Button variant="danger" onClick={handleDeletePortfolio} disabled={!activePortfolio}>删除</Button>
                       </div>
                    </FormGroup>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800" />
                  
                  {/* Create New */}
                  <FormGroup label="新建组合">
                    <div className="flex gap-2 items-center">
                       <Input 
                         value={portfolioName}
                         onChange={(e) => setPortfolioName(e.target.value)}
                         placeholder="例如：核心持仓"
                         className="flex-[2]"
                       />
                       <Input 
                         value={portfolioBaseCurrency}
                         onChange={(e) => setPortfolioBaseCurrency(e.target.value)}
                         placeholder="基准币种"
                         className="flex-1"
                       />
                       <Button variant="primary" onClick={handleCreatePortfolio} disabled={!portfolioName.trim()} icon="add">创建</Button>
                    </div>
                  </FormGroup>
                </div>
              </Panel>

              <Panel>
                <h3 className="text-sm font-semibold mb-4 text-slate-800 dark:text-slate-200">持仓明细</h3>
                
                {isLoading && <EmptyState message="正在加载组合数据..." />}
                {!isLoading && !activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                {!isLoading && activePortfolio && !snapshot && <EmptyState message="暂无估值快照。" />}
                
                {snapshot && (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                       <SummaryCard label="总市值" value={formatCurrency(snapshot.totals.marketValue)} />
                       <SummaryCard 
                          label="总盈亏" 
                          value={formatCurrency(snapshot.totals.pnl)} 
                          trend={snapshot.totals.pnl >= 0 ? 'up' : 'down'}
                        />
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 mb-6">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                          <tr>
                            {["代码", "名称", "类型", "数量", "成本", "现价", "市值", "盈亏", "权重", "操作"].map(h => (
                              <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-[#0B0E14] divide-y divide-slate-200 dark:divide-slate-800">
                          {snapshot.positions.length === 0 ? (
                            <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">暂无持仓</td></tr>
                          ) : (
                            snapshot.positions.map((pos) => (
                              <tr key={pos.position.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                <td className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 font-mono">{pos.position.symbol}</td>
                                <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">{pos.position.name ?? "-"}</td>
                                <td className="px-4 py-2 text-sm text-slate-500">
                                   <Badge>{formatAssetClassLabel(pos.position.assetClass)}</Badge>
                                </td>
                                <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono text-right">{formatNumber(pos.position.quantity)}</td>
                                <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-500 font-mono text-right">{formatCurrency(pos.position.cost)}</td>
                                <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 font-mono text-right">{formatCurrency(pos.latestPrice)}</td>
                                <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100 font-medium font-mono text-right">{formatCurrency(pos.marketValue)}</td>
                                <td className={`px-4 py-2 text-sm font-mono text-right ${pos.pnl && pos.pnl < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                  {formatCurrency(pos.pnl)}
                                </td>
                                <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-500 font-mono text-right">
                                  {formatPct(
                                    snapshot.exposures.bySymbol.find(e => e.key === pos.position.symbol)?.weight ?? 0
                                  )}
                                </td>
                                <td className="px-4 py-2 text-sm text-right">
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditPosition(pos)} className="p-1 text-slate-400 hover:text-primary transition-colors" title="编辑">
                                       <span className="material-icons-outlined text-base">edit</span>
                                    </button>
                                    <button onClick={() => handleDeletePosition(pos.position.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="删除">
                                       <span className="material-icons-outlined text-base">delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Edit Form */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span className="material-icons-outlined text-primary text-base">edit_note</span>
                          {positionForm.id ? "编辑持仓" : "新增持仓"}
                        </h3>
                        {positionForm.id && (
                             <Button variant="secondary" size="sm" onClick={handleCancelEditPosition}>取消编辑</Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormGroup label="代码">
                           <Input 
                             value={positionForm.symbol} 
                             onChange={(e) => setPositionForm(p => ({ ...p, symbol: e.target.value }))}
                             placeholder="例如: 600519.SH"
                           />
                        </FormGroup>
                        <FormGroup label="名称">
                           <Input 
                             value={positionForm.name} 
                             onChange={(e) => setPositionForm(p => ({ ...p, name: e.target.value }))}
                             placeholder="可选"
                           />
                        </FormGroup>
                        <FormGroup label="资产类别">
                           <Select
                             value={positionForm.assetClass}
                             onChange={(e) => setPositionForm(p => ({ ...p, assetClass: e.target.value as AssetClass }))}
                             options={Object.entries(assetClassLabels).map(([v, l]) => ({ value: v, label: l }))}
                           />
                        </FormGroup>
                        <FormGroup label="市场 / 币种">
                           <div className="flex gap-2">
                             <Input 
                               value={positionForm.market} 
                               onChange={(e) => setPositionForm(p => ({ ...p, market: e.target.value }))}
                               placeholder="CN"
                             />
                             <Input 
                               value={positionForm.currency} 
                               onChange={(e) => setPositionForm(p => ({ ...p, currency: e.target.value }))}
                               placeholder="CNY"
                             />
                           </div>
                        </FormGroup>
                        <FormGroup label="数量">
                           <Input 
                             type="number"
                             value={positionForm.quantity} 
                             onChange={(e) => setPositionForm(p => ({ ...p, quantity: e.target.value }))}
                             placeholder="0"
                           />
                        </FormGroup>
                        <FormGroup label="成本单价">
                           <Input 
                             type="number"
                             value={positionForm.cost} 
                             onChange={(e) => setPositionForm(p => ({ ...p, cost: e.target.value }))}
                             placeholder="0.00"
                           />
                        </FormGroup>
                        <FormGroup label="建仓日期">
                           <Input 
                             type="date"
                             value={positionForm.openDate} 
                             onChange={(e) => setPositionForm(p => ({ ...p, openDate: e.target.value }))}
                           />
                        </FormGroup>
                        <div className="flex items-end">
                           <Button variant="primary" onClick={handleSubmitPosition} className="w-full">
                             {positionForm.id ? "保存更改" : "添加持仓"}
                           </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </Panel>
            </>
          )}

          {/* View: Risk */}
          {activeView === "risk" && (
            <Panel>
              {!snapshot ? <EmptyState message="暂无风险数据。" /> : (
                <div className="space-y-8 max-w-6xl">
                  {/* Exposure Table */}
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 pl-1">资产敞口分布</h3>
                    <div className="overflow-hidden border border-slate-200 dark:border-slate-800">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                         <thead className="bg-slate-50 dark:bg-slate-900">
                           <tr>
                             <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">资产类别</th>
                             <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">权重</th>
                             <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">市值</th>
                           </tr>
                         </thead>
                         <tbody className="bg-white dark:bg-[#0B0E14] divide-y divide-slate-200 dark:divide-slate-800">
                           {snapshot.exposures.byAssetClass.map(e => (
                             <tr key={e.key}>
                               <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{formatAssetClassLabel(e.key)}</td>
                               <td className="px-4 py-2 text-sm text-right font-mono text-slate-600 dark:text-slate-400">{formatPct(e.weight)}</td>
                               <td className="px-4 py-2 text-sm text-right font-mono text-slate-900 dark:text-white">{formatCurrency(e.marketValue)}</td>
                             </tr>
                           ))}
                         </tbody>
                      </table>
                    </div>
                  </section>
                  
                  {/* Risk Limits */}
                  <section>
                     <div className="flex justify-between items-center mb-3 px-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">限额监控</h3>
                        {snapshot.riskWarnings.length > 0 && (
                          <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                            {snapshot.riskWarnings.length} 个预警
                          </span>
                        )}
                     </div>
                     <div className="space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {snapshot.riskLimits.map(limit => (
                           <div key={limit.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                 <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatRiskLimitTypeLabel(limit.limitType)}</div>
                                    <div className="font-medium text-slate-900 dark:text-white mt-1 text-lg">{limit.target}</div>
                                 </div>
                                 <div className="text-xl font-mono font-light text-slate-700 dark:text-slate-300">{formatPct(limit.threshold)}</div>
                              </div>
                              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                                 <button onClick={() => handleEditRiskLimit(limit)} className="text-xs font-medium text-slate-500 hover:text-primary transition-colors">编辑</button>
                                 <button onClick={() => handleDeleteRiskLimit(limit.id)} className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors">删除</button>
                              </div>
                           </div>
                         ))}
                         {/* Add New Limit Form */}
                         <div className="bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-700 p-4 flex flex-col gap-3">
                           <div className="text-xs font-bold text-slate-400 uppercase text-center">{riskForm.id ? "编辑限额" : "新增限额"}</div>
                           <Select 
                              value={riskForm.limitType} 
                              onChange={(e) => setRiskForm(p => ({ ...p, limitType: e.target.value as RiskLimitType }))}
                              options={Object.entries(riskLimitTypeLabels).map(([v, l]) => ({ value: v, label: l }))}
                              className="text-xs"
                           />
                           <Input 
                              value={riskForm.target} 
                              onChange={(e) => setRiskForm(p => ({ ...p, target: e.target.value }))}
                              placeholder="目标 (如 600519)"
                              className="text-xs"
                           />
                           <Input 
                              type="number"
                              value={riskForm.thresholdPct} 
                              onChange={(e) => setRiskForm(p => ({ ...p, thresholdPct: e.target.value }))}
                              placeholder="阈值 %"
                              className="text-xs"
                           />
                           <div className="flex gap-2 mt-auto pt-2">
                              <Button variant="primary" size="sm" onClick={handleSubmitRiskLimit} className="w-full">{riskForm.id ? "保存" : "添加"}</Button>
                              {riskForm.id && <Button variant="secondary" size="sm" onClick={handleCancelRiskEdit}>取消</Button>}
                           </div>
                         </div>
                       </div>
                     </div>
                  </section>
                </div>
              )}
            </Panel>
          )}

          {/* View: Market */}
          {activeView === "market" && (
            <Panel>
               <div className="mb-6 bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 p-3 text-sm text-blue-800 dark:text-blue-300">
                  最新行情日期：<span className="font-mono font-medium">{snapshot?.priceAsOf ?? "--"}</span>
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
                  <section className="space-y-4">
                     <h3 className="font-bold text-slate-900 dark:text-white">CSV 导入</h3>
                     <FormGroup label="持仓 CSV">
                        <div className="flex gap-2">
                          <Input value={holdingsCsvPath ?? ""} readOnly className="flex-1 text-xs font-mono" />
                          <Button variant="secondary" onClick={() => handleChooseCsv("holdings")}>选择</Button>
                          <Button variant="primary" onClick={handleImportHoldings} disabled={!holdingsCsvPath || !activePortfolio}>导入</Button>
                        </div>
                     </FormGroup>
                     <FormGroup label="价格 CSV">
                        <div className="flex gap-2">
                          <Input value={pricesCsvPath ?? ""} readOnly className="flex-1 text-xs font-mono" />
                          <Button variant="secondary" onClick={() => handleChooseCsv("prices")}>选择</Button>
                          <Button variant="primary" onClick={handleImportPrices} disabled={!pricesCsvPath}>导入</Button>
                        </div>
                     </FormGroup>
                  </section>

                  <section className="space-y-4">
                     <h3 className="font-bold text-slate-900 dark:text-white">Tushare 拉取</h3>
                     <FormGroup label="日期范围">
                        <div className="flex gap-2 items-center">
                           <Input type="date" value={ingestStartDate} onChange={(e) => setIngestStartDate(e.target.value)} />
                           <span className="text-slate-400">-</span>
                           <Input type="date" value={ingestEndDate} onChange={(e) => setIngestEndDate(e.target.value)} />
                        </div>
                     </FormGroup>
                     <div className="pt-2">
                        <Button variant="primary" onClick={handleIngestTushare} disabled={!snapshot || snapshot.positions.length === 0} className="w-full">
                           开始拉取
                        </Button>
                        <p className="mt-2 text-xs text-slate-500">使用当前持仓代码拉取。请先设置 MYTRADER_TUSHARE_TOKEN。</p>
                     </div>
                  </section>
               </div>
            </Panel>
          )}

          {/* Placeholders */}
          {["opportunities", "backtest", "insights", "alerts", "other"].includes(activeView) && (
            <PlaceholderPanel 
              title={navItems.find(n => n.key === activeView)?.label ?? ""}
              description={navItems.find(n => n.key === activeView)?.description ?? ""}
            />
          )}

        </div>

        {/* Global Notifications */}
        {(error || notice) && (
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
              <div className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 ${
                 error 
                 ? "bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800 text-red-800 dark:text-red-100" 
                 : "bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100"
              }`}>
                 <span className="material-icons-outlined">{error ? "error" : "check_circle"}</span>
                 <span className="text-sm font-medium">{error ?? notice}</span>
                 <button onClick={() => { setError(null); setNotice(null); }} className="ml-2 opacity-60 hover:opacity-100">
                    <span className="material-icons-outlined text-sm">close</span>
                 </button>
              </div>
           </div>
        )}
      </section>
    </div>
  );
}

// --- UI Components ---

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-transparent mb-4 last:mb-0">
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function PlaceholderPanel({ title, description }: { title: string, description: string }) {
   return (
      <Panel>
         <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-icons-outlined text-5xl mb-4 opacity-30">construction</span>
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">{title}</h3>
            <p className="text-sm opacity-80">{description}</p>
            <p className="text-xs mt-4 opacity-50">该模块为占位视图，将在后续版本逐步实现。</p>
         </div>
      </Panel>
   )
}

function FormGroup({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
function Input({ className, ...props }: InputProps) {
  return (
    <input 
      className={`block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-1.5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm sm:leading-6 placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800 ${className}`}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string, label: string, disabled?: boolean }[];
}
function Select({ className, options, ...props }: SelectProps) {
  return (
    <select
      className={`block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-1.5 pl-3 pr-10 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm sm:leading-6 ${className}`}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
      ))}
    </select>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
}
function Button({ children, variant = 'secondary', size = 'md', icon, className, ...props }: ButtonProps) {
  const baseClass = "inline-flex items-center justify-center rounded font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary hover:bg-[#06b6d4] text-white border border-transparent shadow-sm focus:ring-primary",
    secondary: "bg-slate-100/90 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-500 text-slate-800 dark:text-slate-100 hover:bg-slate-200/90 dark:hover:bg-slate-600/80 focus:ring-slate-400",
    danger: "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/40 focus:ring-red-500"
  };
  
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm"
  };

  return (
    <button 
      className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className={`material-icons-outlined ${size === 'sm' ? 'text-sm mr-1.5' : 'text-base mr-2'}`}>{icon}</span>}
      {children}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-slate-500/10">
      {children}
    </span>
  );
}

function SummaryCard({ label, value, trend }: { label: string, value: string, trend?: 'up' | 'down' }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
       <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
       <div className={`text-xl font-bold font-mono ${
          trend === 'up' ? 'text-green-600 dark:text-green-500' : 
          trend === 'down' ? 'text-red-600 dark:text-red-500' : 
          'text-slate-900 dark:text-white'
       }`}>
          {value}
       </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
      <span className="material-icons-outlined text-3xl mb-2 opacity-50">inbox</span>
      <p className="text-sm">{message}</p>
    </div>
  )
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

function formatDateTime(value: number | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN");
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

function DescriptionItem({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{value}</span>
    </div>
  )
}
