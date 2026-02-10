import type {
  ChangeEvent,
  Dispatch,
  SetStateAction
} from "react";

import type {
  AssetClass,
  LedgerEntry,
  LedgerEventType,
  MarketDataQuality,
  PerformanceMethod,
  PerformanceMetric,
  PerformanceRangeKey,
  Portfolio,
  PortfolioPerformance,
  PortfolioPerformanceRangeResult,
  PortfolioPerformanceSeries,
  PortfolioRiskMetrics,
  PortfolioSnapshot,
  PositionValuation
} from "@mytrader/shared";

import type {
  AnalysisTab,
  LedgerFilter,
  LedgerFormState,
  OtherTab,
  PortfolioTab,
  PositionFormState,
  WorkspaceView
} from "../types";

interface PortfolioTabOption {
  key: PortfolioTab;
  label: string;
  icon: string;
  description: string;
}

interface PerformanceRangeOption {
  key: PerformanceRangeKey;
  label: string;
}

interface CashFlowTotalItem {
  currency: string;
  amount: number;
}

export interface PortfolioViewProps {
  Badge: typeof import("../shared").Badge;
  Button: typeof import("../shared").Button;
  DataQualityCard: typeof import("../shared").DataQualityCard;
  DescriptionItem: typeof import("../shared").DescriptionItem;
  EmptyState: typeof import("../shared").EmptyState;
  ErrorState: typeof import("../shared").ErrorState;
  FormGroup: typeof import("../shared").FormGroup;
  HHI_WARN_THRESHOLD: number;
  IconButton: typeof import("../shared").IconButton;
  Input: typeof import("../shared").Input;
  LedgerForm: typeof import("../shared").LedgerForm;
  LedgerTable: typeof import("../shared").LedgerTable;
  Panel: typeof import("../shared").Panel;
  PerformanceChart: typeof import("../shared").PerformanceChart;
  PlaceholderPanel: typeof import("../shared").PlaceholderPanel;
  RiskMetricCard: typeof import("../shared").RiskMetricCard;
  Select: typeof import("../shared").Select;
  SummaryCard: typeof import("../shared").SummaryCard;
  activePortfolio: Portfolio | null;
  activePortfolioId: string | null;
  assetClassLabels: Record<AssetClass, string>;
  cashFlowTotals: CashFlowTotalItem[];
  cashTotal: number;
  dataQuality: MarketDataQuality | null;
  filteredLedgerEntries: LedgerEntry[];
  formatAssetClassLabel: (value: string) => string;
  formatCurrency: (value: number | null) => string;
  formatDateRange: (startDate?: string | null, endDate?: string | null) => string;
  formatNumber: (value: number | null, fractionDigits?: number) => string;
  formatPct: (value: number) => string;
  formatPctNullable: (value: number | null | undefined) => string;
  formatPerformanceMethod: (value: PerformanceMethod) => string;
  handleCancelEditPosition: () => void;
  handleCancelLedgerEdit: () => void;
  handleCreatePortfolio: () => Promise<void>;
  handleDeletePortfolio: () => Promise<void>;
  handleDeletePosition: (positionId: string) => Promise<void>;
  handleEditLedgerEntry: (entry: LedgerEntry) => void;
  handleEditPosition: (position: PositionValuation) => void;
  handleOpenLedgerForm: () => void;
  handleRenamePortfolio: () => Promise<void>;
  handleRequestDeleteLedgerEntry: (entry: LedgerEntry) => void;
  handleSubmitLedgerEntry: () => Promise<void>;
  handleSubmitPosition: () => Promise<void>;
  hhiValue: number | null;
  isLedgerFormOpen: boolean;
  isLoading: boolean;
  ledgerEndDate: string;
  ledgerEntries: LedgerEntry[];
  ledgerError: string | null;
  ledgerEventTypeOptions: Array<{ value: LedgerEventType; label: string }>;
  ledgerFilter: LedgerFilter;
  ledgerForm: LedgerFormState;
  ledgerLoading: boolean;
  ledgerStartDate: string;
  loadLedgerEntries: (portfolioId: string) => Promise<void>;
  loadPerformance: (
    portfolioId: string,
    range: PerformanceRangeKey
  ) => Promise<void>;
  performanceError: string | null;
  performanceLoading: boolean;
  performance: PortfolioPerformance | null;
  performanceRange: PerformanceRangeKey;
  performanceRanges: ReadonlyArray<PerformanceRangeOption>;
  performanceResult: PortfolioPerformanceRangeResult | null;
  performanceSeries: PortfolioPerformanceSeries | null;
  portfolioBaseCurrency: string;
  portfolioName: string;
  portfolioRename: string;
  portfolioTab: PortfolioTab;
  portfolioTabs: ReadonlyArray<PortfolioTabOption>;
  portfolios: Portfolio[];
  positionForm: PositionFormState;
  riskAnnualized: boolean;
  riskMetrics: PortfolioRiskMetrics | null;
  selectedPerformance: PerformanceMetric | null;
  setActivePortfolioId: Dispatch<SetStateAction<string | null>>;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  setAnalysisTab: Dispatch<SetStateAction<AnalysisTab>>;
  setLedgerEndDate: Dispatch<SetStateAction<string>>;
  setLedgerError: Dispatch<SetStateAction<string | null>>;
  setLedgerFilter: Dispatch<SetStateAction<LedgerFilter>>;
  setLedgerStartDate: Dispatch<SetStateAction<string>>;
  setOtherTab: Dispatch<SetStateAction<OtherTab>>;
  setPerformanceError: Dispatch<SetStateAction<string | null>>;
  setPerformanceRange: Dispatch<SetStateAction<PerformanceRangeKey>>;
  setPortfolioBaseCurrency: Dispatch<SetStateAction<string>>;
  setPortfolioName: Dispatch<SetStateAction<string>>;
  setPortfolioRename: Dispatch<SetStateAction<string>>;
  setPositionForm: Dispatch<SetStateAction<PositionFormState>>;
  setRiskAnnualized: Dispatch<SetStateAction<boolean>>;
  snapshot: PortfolioSnapshot | null;
  toUserErrorMessage: (err: unknown) => string;
  updateLedgerForm: (patch: Partial<LedgerFormState>) => void;
}

export function PortfolioView(props: PortfolioViewProps) {
  const {
    Badge,
    Button,
    DataQualityCard,
    DescriptionItem,
    EmptyState,
    ErrorState,
    FormGroup,
    HHI_WARN_THRESHOLD,
    IconButton,
    Input,
    LedgerForm,
    LedgerTable,
    Panel,
    PerformanceChart,
    PlaceholderPanel,
    RiskMetricCard,
    Select,
    SummaryCard,
    activePortfolio,
    activePortfolioId,
    assetClassLabels,
    cashFlowTotals,
    cashTotal,
    dataQuality,
    filteredLedgerEntries,
    formatAssetClassLabel,
    formatCurrency,
    formatDateRange,
    formatNumber,
    formatPct,
    formatPctNullable,
    formatPerformanceMethod,
    handleCancelEditPosition,
    handleCancelLedgerEdit,
    handleCreatePortfolio,
    handleDeletePortfolio,
    handleDeletePosition,
    handleEditLedgerEntry,
    handleEditPosition,
    handleOpenLedgerForm,
    handleRenamePortfolio,
    handleRequestDeleteLedgerEntry,
    handleSubmitLedgerEntry,
    handleSubmitPosition,
    hhiValue,
    isLedgerFormOpen,
    isLoading,
    ledgerEndDate,
    ledgerEntries,
    ledgerError,
    ledgerEventTypeOptions,
    ledgerFilter,
    ledgerForm,
    ledgerLoading,
    ledgerStartDate,
    loadLedgerEntries,
    loadPerformance,
    performanceError,
    performanceLoading,
    performance,
    performanceRange,
    performanceRanges,
    performanceResult,
    performanceSeries,
    portfolioBaseCurrency,
    portfolioName,
    portfolioRename,
    portfolioTab,
    portfolioTabs,
    portfolios,
    positionForm,
    riskAnnualized,
    riskMetrics,
    selectedPerformance,
    setActivePortfolioId,
    setActiveView,
    setAnalysisTab,
    setLedgerEndDate,
    setLedgerError,
    setLedgerFilter,
    setLedgerStartDate,
    setOtherTab,
    setPerformanceError,
    setPerformanceRange,
    setPortfolioBaseCurrency,
    setPortfolioName,
    setPortfolioRename,
    setPositionForm,
    setRiskAnnualized,
    snapshot,
    toUserErrorMessage,
    updateLedgerForm,
  } = props;

  return (
            <>
              {portfolioTab === "overview" && (
                <>
                  <Panel>
                    {isLoading && <EmptyState message="正在加载组合数据..." />}
                    {!isLoading && !activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                    {!isLoading && activePortfolio && !snapshot && <EmptyState message="暂无估值快照。" />}

                    {snapshot && (
                        <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <SummaryCard label="总资产" value={formatCurrency(snapshot.totals.marketValue)} />
                          <SummaryCard label="现金余额" value={formatCurrency(cashTotal)} />
                          <SummaryCard
                            label="总盈亏"
                            value={formatCurrency(snapshot.totals.pnl)}
                            trend={snapshot.totals.pnl >= 0 ? "up" : "down"}
                          />
                          <SummaryCard label="成本合计" value={formatCurrency(snapshot.totals.costValue)} />
                          <SummaryCard label="行情更新" value={snapshot.priceAsOf ?? "--"} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">数据状态</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {snapshot.priceAsOf ? `价格更新至 ${snapshot.priceAsOf}` : "暂无行情数据"}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">风险提示</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {snapshot.riskWarnings.length > 0
                                ? `${snapshot.riskWarnings.length} 条风险预警`
                                : "暂无触发预警"}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">快速动作</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">刷新行情 / 导入流水</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </Panel>

                  <Panel>
                    <h3 className="text-sm font-semibold mb-4 text-slate-800 dark:text-slate-200">组合管理</h3>
                    <div className="space-y-6 max-w-5xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormGroup label="切换组合">
                          <Select
                            value={activePortfolioId ?? ""}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                              setActivePortfolioId(event.target.value)
                            }
                            options={[
                              { value: "", label: "请选择组合", disabled: true },
                              ...portfolios.map((portfolio) => ({
                                value: portfolio.id,
                                label: portfolio.name
                              }))
                            ]}
                            className="w-full"
                          />
                        </FormGroup>

                        <FormGroup label="重命名当前组合">
                          <div className="flex gap-2">
                            <Input
                              value={portfolioRename}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setPortfolioRename(event.target.value)
                              }
                              placeholder="组合名称"
                              className="flex-1"
                            />
                            <Button variant="secondary" onClick={handleRenamePortfolio} disabled={!activePortfolio}>
                              更新
                            </Button>
                            <Button variant="danger" onClick={handleDeletePortfolio} disabled={!activePortfolio}>
                              删除
                            </Button>
                          </div>
                        </FormGroup>
                      </div>

                      <div className="border-t border-slate-100 dark:border-border-dark" />

                      <FormGroup label="新建组合">
                        <div className="flex gap-2 items-center">
                          <Input
                            value={portfolioName}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              setPortfolioName(event.target.value)
                            }
                            placeholder="例如：核心持仓"
                            className="flex-[2]"
                          />
                          <Input
                            value={portfolioBaseCurrency}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              setPortfolioBaseCurrency(event.target.value)
                            }
                            placeholder="基准币种"
                            className="flex-1"
                          />
                          <Button
                            variant="primary"
                            onClick={handleCreatePortfolio}
                            disabled={!portfolioName.trim()}
                            icon="add"
                          >
                            创建
                          </Button>
                        </div>
                      </FormGroup>
                    </div>
                  </Panel>
                </>
              )}

              {portfolioTab === "holdings" && (
                <Panel>
                  <h3 className="text-sm font-semibold mb-4 text-slate-800 dark:text-slate-200">持仓明细</h3>

                  {isLoading && <EmptyState message="正在加载组合数据..." />}
                  {!isLoading && !activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                  {!isLoading && activePortfolio && !snapshot && <EmptyState message="暂无估值快照。" />}

                  {snapshot && (
                    <>
                      <div className="overflow-x-auto border border-slate-200 dark:border-border-dark mb-6">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-border-dark">
                          <thead className="bg-slate-50 dark:bg-background-dark">
                            <tr>
                              {["代码", "名称", "类型", "数量", "成本", "现价", "市值", "盈亏", "权重", "操作"].map((h) => (
                                <th
                                  key={h}
                                  className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
                            {snapshot.positions.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                                  暂无持仓
                                </td>
                              </tr>
                            ) : (
                              snapshot.positions.map((pos) => (
                                <tr
                                  key={pos.position.id}
                                  className="hover:bg-slate-50 dark:hover:bg-background-dark/70 transition-colors group"
                                >
                                  <td className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 font-mono">
                                    {pos.position.symbol}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                                    {pos.position.name ?? "-"}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-500">
                                    <Badge>{formatAssetClassLabel(pos.position.assetClass)}</Badge>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono text-right">
                                    {formatNumber(pos.position.quantity)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-500 font-mono text-right">
                                    {formatCurrency(pos.position.cost)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 font-mono text-right">
                                    {formatCurrency(pos.latestPrice)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100 font-medium font-mono text-right">
                                    {formatCurrency(pos.marketValue)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-sm font-mono text-right ${
                                      pos.pnl && pos.pnl < 0 ? "text-red-500" : "text-emerald-500"
                                    }`}
                                  >
                                    {formatCurrency(pos.pnl)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-500 font-mono text-right">
                                    {formatPct(
                                      snapshot.exposures.bySymbol.find(
                                        (entry) => entry.key === pos.position.symbol
                                      )
                                        ?.weight ?? 0
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleEditPosition(pos)}
                                        className="p-1 text-slate-400 hover:text-primary transition-colors"
                                        title="编辑"
                                      >
                                        <span className="material-icons-outlined text-base">edit</span>
                                      </button>
                                      <button
                                        onClick={() => handleDeletePosition(pos.position.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                        title="删除"
                                      >
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

                      <div className="bg-slate-50 dark:bg-background-dark p-4 border-t border-slate-200 dark:border-border-dark">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span className="material-icons-outlined text-primary text-base">edit_note</span>
                            {positionForm.id ? "编辑持仓" : "新增持仓"}
                          </h3>
                          {positionForm.id && (
                            <Button variant="secondary" size="sm" onClick={handleCancelEditPosition}>
                              取消编辑
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <FormGroup label="代码">
                            <Input
                              value={positionForm.symbol}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setPositionForm((previous) => ({
                                  ...previous,
                                  symbol: event.target.value
                                }))
                              }
                              placeholder="例如: 600519.SH"
                            />
                          </FormGroup>
                          <FormGroup label="名称">
                            <Input
                              value={positionForm.name}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setPositionForm((previous) => ({
                                  ...previous,
                                  name: event.target.value
                                }))
                              }
                              placeholder="可选"
                            />
                          </FormGroup>
                          <FormGroup label="资产类别">
                            <Select
                              value={positionForm.assetClass}
                              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                setPositionForm((previous) => ({
                                  ...previous,
                                  assetClass: event.target.value as AssetClass
                                }))
                              }
                              options={Object.entries(assetClassLabels).map(([v, l]) => ({
                                value: v,
                                label: l
                              }))}
                            />
                          </FormGroup>
                          <FormGroup label="市场 / 币种">
                            <div className="flex gap-2">
                              <Input
                                value={positionForm.market}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  setPositionForm((previous) => ({
                                    ...previous,
                                    market: event.target.value
                                  }))
                                }
                                placeholder="CN"
                              />
                              <Input
                                value={positionForm.currency}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  setPositionForm((previous) => ({
                                    ...previous,
                                    currency: event.target.value
                                  }))
                                }
                                placeholder="CNY"
                              />
                            </div>
                          </FormGroup>
                          <FormGroup label="数量">
                            <Input
                              type="number"
                              value={positionForm.quantity}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setPositionForm((previous) => ({
                                  ...previous,
                                  quantity: event.target.value
                                }))
                              }
                              placeholder="0"
                            />
                          </FormGroup>
                          <FormGroup label="成本单价">
                            <Input
                              type="number"
                              value={positionForm.cost}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setPositionForm((previous) => ({
                                  ...previous,
                                  cost: event.target.value
                                }))
                              }
                              placeholder="0.00"
                            />
                          </FormGroup>
                          <FormGroup label="建仓日期">
                            <Input
                              type="date"
                              value={positionForm.openDate}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setPositionForm((previous) => ({
                                  ...previous,
                                  openDate: event.target.value
                                }))
                              }
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
              )}

              {portfolioTab === "performance" && (
                <Panel>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">收益表现</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        收益曲线与口径区间保持一致。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {performanceRanges.map((range) => {
                        const isActive = performanceRange === range.key;
                        return (
                          <button
                            key={range.key}
                            type="button"
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              isActive
                                ? "bg-primary text-white border-primary"
                                : "bg-white dark:bg-surface-dark text-slate-500 dark:text-slate-300 border-slate-200 dark:border-border-dark hover:text-slate-900 dark:hover:text-white"
                            }`}
                            onClick={() => setPerformanceRange(range.key)}
                          >
                            {range.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {performanceLoading && <EmptyState message="正在加载收益曲线..." />}
                  {!performanceLoading && performanceError && (
                    <ErrorState
                      message={performanceError}
                      onRetry={() => {
                        if (!activePortfolioId) return;
                        loadPerformance(activePortfolioId, performanceRange).catch((err: unknown) =>
                          setPerformanceError(toUserErrorMessage(err))
                        );
                      }}
                    />
                  )}
                  {!performanceLoading && !performanceError && !activePortfolio && (
                    <EmptyState message="请先选择或创建组合。" />
                  )}
                  {!performanceLoading &&
                    !performanceError &&
                    activePortfolio &&
                    !performanceResult && <EmptyState message="暂无收益数据。" />}

                  {!performanceLoading && !performanceError && performance && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard
                          label="当前口径"
                          value={formatPerformanceMethod(performance.selectedMethod)}
                        />
                        <SummaryCard
                          label="区间"
                          value={formatDateRange(
                            selectedPerformance?.startDate,
                            selectedPerformance?.endDate
                          )}
                        />
                        <SummaryCard
                          label="总收益率"
                          value={formatPctNullable(selectedPerformance?.totalReturn ?? null)}
                        />
                        <SummaryCard
                          label="年化收益率"
                          value={formatPctNullable(selectedPerformance?.annualizedReturn ?? null)}
                        />
                      </div>

                      {dataQuality && (
                        <DataQualityCard
                          quality={dataQuality}
                          onOpenMarketDataStatus={() => {
                            setActiveView("other");
                            setOtherTab("data-status");
                          }}
                        />
                      )}

	                      {performance.reason && (
	                        <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4 text-sm text-slate-600 dark:text-slate-300">
	                          {performance.reason}
	                        </div>
	                      )}

                      {performanceSeries ? (
                        <PerformanceChart series={performanceSeries} />
                      ) : (
                        <EmptyState message="暂无收益曲线。" />
                      )}

                      <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-wider text-slate-500">
                              深入分析
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              贡献分解、风险拆解等详细分析请在「数据分析」中查看。
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="functions"
                            onClick={() => {
                              setActiveView("data-analysis");
                              setAnalysisTab("portfolio");
                            }}
                          >
                            打开数据分析
                          </Button>
                        </div>
                      </div>

	                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	                        <div className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
	                          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">TWR</div>
                          <DescriptionItem
                            label="区间"
                            value={formatDateRange(
                              performance.twr?.startDate,
                              performance.twr?.endDate
                            )}
                          />
                          <DescriptionItem
                            label="总收益率"
                            value={formatPctNullable(performance.twr?.totalReturn ?? null)}
                          />
                          <DescriptionItem
                            label="年化收益率"
                            value={formatPctNullable(
                              performance.twr?.annualizedReturn ?? null
                            )}
                          />
                        </div>
	                        <div className="bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200 dark:border-border-dark rounded-lg p-4">
	                          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">MWR</div>
                          <DescriptionItem
                            label="区间"
                            value={formatDateRange(
                              performance.mwr?.startDate,
                              performance.mwr?.endDate
                            )}
                          />
                          <DescriptionItem
                            label="总收益率"
                            value={formatPctNullable(performance.mwr?.totalReturn ?? null)}
                          />
                          <DescriptionItem
                            label="年化收益率"
                            value={formatPctNullable(
                              performance.mwr?.annualizedReturn ?? null
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </Panel>
              )}

              {portfolioTab === "trades" && (
                <Panel>
	                  <div className="mb-2 rounded-none border border-slate-200 dark:border-border-dark bg-white/70 dark:bg-surface-dark overflow-hidden">
	                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-border-dark">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-base text-primary">
                          swap_horiz
                        </span>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          交易流水
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 rounded-none bg-transparent px-2 py-0.5">
                        <Input
                          type="date"
                          value={ledgerStartDate}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setLedgerStartDate(event.target.value)
                          }
                          className="text-xs w-32 border-0 bg-transparent dark:bg-transparent focus:ring-0 focus:border-transparent rounded-none"
                          disabled={!activePortfolio}
                        />
                        <span className="text-xs text-slate-400">至</span>
                        <Input
                          type="date"
                          value={ledgerEndDate}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setLedgerEndDate(event.target.value)
                          }
                          className="text-xs w-32 border-0 bg-transparent dark:bg-transparent focus:ring-0 focus:border-transparent rounded-none"
                          disabled={!activePortfolio}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <Select
                          value={ledgerFilter}
                          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                            setLedgerFilter(event.target.value as LedgerFilter)
                          }
                          options={[
                            { value: "all", label: "全部交易类型" },
                            ...ledgerEventTypeOptions
                          ]}
                          className="text-[11px] w-40 rounded-none border-0 !bg-transparent dark:!bg-transparent text-primary focus:ring-0 focus:border-transparent pl-2 pr-6"
                          disabled={!activePortfolio}
                        />
                        <span className="h-4 w-px bg-slate-200 dark:bg-border-dark" />
                        <span>
                          筛选结果 {filteredLedgerEntries.length} / {ledgerEntries.length}
                        </span>
                        {cashFlowTotals.map((item) => (
                          <span
                            key={item.currency}
                            className="text-[11px] font-mono text-emerald-500 dark:text-emerald-300"
                          >
                            现金净流 {item.currency} {formatCurrency(item.amount)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <IconButton
                          icon="refresh"
                          label="刷新流水"
                          size="sm"
                          className="rounded-none"
                          onClick={() => {
                            if (!activePortfolioId) return;
                            loadLedgerEntries(activePortfolioId).catch((err: unknown) =>
                              setLedgerError(toUserErrorMessage(err))
                            );
                          }}
                          disabled={!activePortfolioId || ledgerLoading}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          icon="add"
                          className={`rounded-none px-2 py-1 text-[11px] ${
                            isLedgerFormOpen || Boolean(ledgerForm.id)
                              ? "bg-slate-400 border-slate-400 hover:bg-slate-400 text-white"
                              : ""
                          }`}
                          onClick={handleOpenLedgerForm}
                          disabled={!activePortfolio || isLedgerFormOpen || Boolean(ledgerForm.id)}
                        >
                          录入
                        </Button>
                      </div>
                    </div>
                  </div>

                  {!activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                  {activePortfolio && ledgerLoading && <EmptyState message="正在加载流水..." />}
                  {activePortfolio && ledgerError && (
                    <ErrorState
                      message={ledgerError}
                      onRetry={() => {
                        if (!activePortfolioId) return;
                        loadLedgerEntries(activePortfolioId).catch((err: unknown) =>
                          setLedgerError(toUserErrorMessage(err))
                        );
                      }}
                    />
                  )}

                  {activePortfolio && (isLedgerFormOpen || Boolean(ledgerForm.id)) && (
                    <div className="mb-3 bg-cyan-50/45 dark:bg-cyan-950/20 border border-slate-200 dark:border-border-dark border-t-0 border-l-2 border-r-2 border-b-2 border-l-cyan-300 border-r-cyan-300 border-b-cyan-300 dark:border-l-cyan-800 dark:border-r-cyan-800 dark:border-b-cyan-800 rounded-none p-3">
                      <LedgerForm
                        form={ledgerForm}
                        baseCurrency={activePortfolio.baseCurrency}
                        onChange={updateLedgerForm}
                        onSubmit={handleSubmitLedgerEntry}
                        onCancel={handleCancelLedgerEdit}
                      />
                    </div>
                  )}

                  {activePortfolio && !ledgerLoading && !ledgerError && (
                    <>
                      {filteredLedgerEntries.length === 0 ? (
                        <EmptyState message="暂无流水记录。" />
                      ) : (
                        <LedgerTable
                          entries={filteredLedgerEntries}
                          onEdit={handleEditLedgerEntry}
                          onDelete={handleRequestDeleteLedgerEntry}
                        />
                      )}
                    </>
                  )}
                </Panel>
              )}

              {portfolioTab === "risk" && (
                <Panel>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">风险指标</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        波动率与最大回撤基于区间曲线计算。
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {performanceRanges.map((range) => {
                        const isActive = performanceRange === range.key;
                        return (
                          <button
                            key={range.key}
                            type="button"
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              isActive
                                ? "bg-primary text-white border-primary"
                                : "bg-white dark:bg-surface-dark text-slate-500 dark:text-slate-300 border-slate-200 dark:border-border-dark hover:text-slate-900 dark:hover:text-white"
                            }`}
                            onClick={() => setPerformanceRange(range.key)}
                          >
                            {range.label}
                          </button>
                        );
                      })}
                      <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300 ml-2">
                        <input
                          type="checkbox"
                          name="portfolioRiskAnnualized"
                          checked={riskAnnualized}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setRiskAnnualized(event.target.checked)
                          }
                          className="h-3.5 w-3.5 rounded-none border-slate-300 text-primary focus:ring-primary"
                        />
                        年化波动
                      </label>
                    </div>
                  </div>

                  {performanceLoading && <EmptyState message="正在加载风险指标..." />}
                  {!performanceLoading && performanceError && (
                    <ErrorState
                      message={performanceError}
                      onRetry={() => {
                        if (!activePortfolioId) return;
                        loadPerformance(activePortfolioId, performanceRange).catch((err: unknown) =>
                          setPerformanceError(toUserErrorMessage(err))
                        );
                      }}
                    />
                  )}
                  {!performanceLoading && !performanceError && !activePortfolio && (
                    <EmptyState message="请先选择或创建组合。" />
                  )}
                  {!performanceLoading &&
                    !performanceError &&
                    activePortfolio &&
                    !performanceResult && <EmptyState message="暂无风险数据。" />}

                  {!performanceLoading &&
                    !performanceError &&
                    activePortfolio && (
                      <div className="space-y-4">
                        {riskMetrics ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <RiskMetricCard
                              title="估值曲线"
                              metrics={riskMetrics.nav}
                              annualized={riskAnnualized}
                            />
                            <RiskMetricCard
                              title="TWR 曲线"
                              metrics={riskMetrics.twr}
                              annualized={riskAnnualized}
                            />
                          </div>
                        ) : (
                          <EmptyState message="暂无风险指标。" />
                        )}
                        {snapshot && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark border border-slate-200/80 dark:border-border-dark rounded-lg p-4">
                              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                                集中度 (HHI)
                              </div>
                              <div className="text-2xl font-mono text-slate-800 dark:text-slate-100">
                                {hhiValue === null ? "--" : hhiValue.toFixed(3)}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                阈值 {HHI_WARN_THRESHOLD.toFixed(2)}
                              </div>
                              {hhiValue !== null && hhiValue >= HHI_WARN_THRESHOLD && (
                                <div className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                                  集中度偏高，请关注单一标的风险。
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </Panel>
              )}

              {["allocation", "corporate"].includes(portfolioTab) && (
                <PlaceholderPanel
                  title={portfolioTabs.find((tab) => tab.key === portfolioTab)?.label ?? ""}
                  description={
                    portfolioTabs.find((tab) => tab.key === portfolioTab)?.description ?? ""
                  }
                />
              )}
            </>
  );
}
