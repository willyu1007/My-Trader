import type {
  ChangeEvent,
  Dispatch,
  KeyboardEvent,
  SetStateAction
} from "react";

import type {
  ContributionBreakdown,
  InstrumentProfile,
  InstrumentProfileSummary,
  MarketDailyBar,
  MarketQuote,
  PerformanceMethod,
  PerformanceMetric,
  PerformanceRangeKey,
  Portfolio,
  PortfolioPerformance,
  PortfolioPerformanceRangeResult,
  PortfolioPerformanceSeries,
  PortfolioRiskMetrics,
  PositionValuation
} from "@mytrader/shared";

import type { AnalysisTab, MarketChartRangeKey } from "../types";

interface AnalysisTabOption {
  key: AnalysisTab;
  label: string;
  icon: string;
  description: string;
}

interface PerformanceRangeOption {
  key: PerformanceRangeKey;
  label: string;
}

interface MarketChartRangeOption {
  key: MarketChartRangeKey;
  label: string;
}

interface AnalysisRangeSummary {
  rangeHigh: number | null;
  rangeLow: number | null;
  avgVolume: number | null;
  rangeReturn: number | null;
  startDate: string | null;
  endDate: string | null;
}

export interface DataAnalysisViewProps {
  Badge: typeof import("../shared").Badge;
  CONTRIBUTION_TOP_N: number;
  ChartErrorBoundary: typeof import("../shared").ChartErrorBoundary;
  ContributionTable: typeof import("../shared").ContributionTable;
  EmptyState: typeof import("../shared").EmptyState;
  ErrorState: typeof import("../shared").ErrorState;
  Input: typeof import("../shared").Input;
  MarketAreaChart: typeof import("../shared").MarketAreaChart;
  Panel: typeof import("../shared").Panel;
  PerformanceChart: typeof import("../shared").PerformanceChart;
  PlaceholderPanel: typeof import("../shared").PlaceholderPanel;
  RiskMetricCard: typeof import("../shared").RiskMetricCard;
  SummaryCard: typeof import("../shared").SummaryCard;
  activePortfolio: Portfolio | null;
  activePortfolioId: string | null;
  analysisInstrumentBars: MarketDailyBar[];
  analysisInstrumentError: string | null;
  analysisInstrumentHasEnoughData: boolean;
  analysisInstrumentHoldingUnitCost: number | null;
  analysisInstrumentLatestBar: MarketDailyBar | null;
  analysisInstrumentLoading: boolean;
  analysisInstrumentNameBySymbol: Map<string, string>;
  analysisInstrumentPositionValuation: PositionValuation | null;
  analysisInstrumentProfile: InstrumentProfile | null;
  analysisInstrumentQuery: string;
  analysisInstrumentQuickSymbols: string[];
  analysisInstrumentQuote: MarketQuote | null;
  analysisInstrumentRange: MarketChartRangeKey;
  analysisInstrumentRangeSummary: AnalysisRangeSummary;
  analysisInstrumentSearchLoading: boolean;
  analysisInstrumentSearchResults: InstrumentProfileSummary[];
  analysisInstrumentSymbol: string | null;
  analysisInstrumentTargetPrice: number | null;
  analysisInstrumentTone: ReturnType<typeof import("../shared").getCnChangeTone>;
  analysisInstrumentUserTags: string[];
  analysisTab: AnalysisTab;
  analysisTabs: ReadonlyArray<AnalysisTabOption>;
  contributionBreakdown: ContributionBreakdown | null;
  formatCnWanYiNullable: (
    value: number | null,
    fractionDigits?: number,
    zeroFractionDigits?: number
  ) => string;
  formatDateRange: (startDate?: string | null, endDate?: string | null) => string;
  formatNumber: (value: number | null, fractionDigits?: number) => string;
  formatPctNullable: (value: number | null | undefined) => string;
  formatPerformanceMethod: (value: PerformanceMethod) => string;
  formatSignedPctNullable: (value: number | null | undefined) => string;
  loadAnalysisInstrument: (symbol: string) => Promise<void>;
  loadPerformance: (
    portfolioId: string,
    range: PerformanceRangeKey
  ) => Promise<void>;
  marketChartRanges: ReadonlyArray<MarketChartRangeOption>;
  performanceError: string | null;
  performanceLoading: boolean;
  performance: PortfolioPerformance | null;
  performanceRange: PerformanceRangeKey;
  performanceRanges: ReadonlyArray<PerformanceRangeOption>;
  performanceResult: PortfolioPerformanceRangeResult | null;
  performanceSeries: PortfolioPerformanceSeries | null;
  riskAnnualized: boolean;
  riskMetrics: PortfolioRiskMetrics | null;
  selectedPerformance: PerformanceMetric | null;
  setAnalysisInstrumentQuery: Dispatch<SetStateAction<string>>;
  setAnalysisInstrumentRange: Dispatch<SetStateAction<MarketChartRangeKey>>;
  setAnalysisInstrumentSymbol: Dispatch<SetStateAction<string | null>>;
  setPerformanceError: Dispatch<SetStateAction<string | null>>;
  setPerformanceRange: Dispatch<SetStateAction<PerformanceRangeKey>>;
  setRiskAnnualized: Dispatch<SetStateAction<boolean>>;
  setShowAllAssetContribution: Dispatch<SetStateAction<boolean>>;
  setShowAllSymbolContribution: Dispatch<SetStateAction<boolean>>;
  showAllAssetContribution: boolean;
  showAllSymbolContribution: boolean;
  toUserErrorMessage: (err: unknown) => string;
}

export function DataAnalysisView(props: DataAnalysisViewProps) {
  const {
    Badge,
    CONTRIBUTION_TOP_N,
    ChartErrorBoundary,
    ContributionTable,
    EmptyState,
    ErrorState,
    Input,
    MarketAreaChart,
    Panel,
    PerformanceChart,
    PlaceholderPanel,
    RiskMetricCard,
    SummaryCard,
    activePortfolio,
    activePortfolioId,
    analysisInstrumentBars,
    analysisInstrumentError,
    analysisInstrumentHasEnoughData,
    analysisInstrumentHoldingUnitCost,
    analysisInstrumentLatestBar,
    analysisInstrumentLoading,
    analysisInstrumentNameBySymbol,
    analysisInstrumentPositionValuation,
    analysisInstrumentProfile,
    analysisInstrumentQuery,
    analysisInstrumentQuickSymbols,
    analysisInstrumentQuote,
    analysisInstrumentRange,
    analysisInstrumentRangeSummary,
    analysisInstrumentSearchLoading,
    analysisInstrumentSearchResults,
    analysisInstrumentSymbol,
    analysisInstrumentTargetPrice,
    analysisInstrumentTone,
    analysisInstrumentUserTags,
    analysisTab,
    analysisTabs,
    contributionBreakdown,
    formatCnWanYiNullable,
    formatDateRange,
    formatNumber,
    formatPctNullable,
    formatPerformanceMethod,
    formatSignedPctNullable,
    loadAnalysisInstrument,
    loadPerformance,
    marketChartRanges,
    performanceError,
    performanceLoading,
    performance,
    performanceRange,
    performanceRanges,
    performanceResult,
    performanceSeries,
    riskAnnualized,
    riskMetrics,
    selectedPerformance,
    setAnalysisInstrumentQuery,
    setAnalysisInstrumentRange,
    setAnalysisInstrumentSymbol,
    setPerformanceError,
    setPerformanceRange,
    setRiskAnnualized,
    setShowAllAssetContribution,
    setShowAllSymbolContribution,
    showAllAssetContribution,
    showAllSymbolContribution,
    toUserErrorMessage
  } = props;

  return (
    <div className="space-y-6">
      <div className="px-3 py-4 space-y-6 max-w-6xl">
                <Panel>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      更全面的分析入口：组合 / 个股 / 指数 / 板块。
                    </p>
                  </div>

                  {analysisTab === "portfolio" && (
                    <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        当前组合：{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {activePortfolio?.name ?? "--"}
                        </span>
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
                  )}
                </Panel>

                {(analysisTab === "index" || analysisTab === "sector") && (
                  <PlaceholderPanel
                    title={`${analysisTabs.find((tab) => tab.key === analysisTab)?.label ?? ""}`}
                    description={
                      analysisTabs.find((tab) => tab.key === analysisTab)?.description ?? ""
                    }
                  />
                )}

                {analysisTab === "instrument" && (
                  <>
                    <Panel>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="w-full xl:max-w-2xl space-y-2">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              搜索标的（代码/名称）
                            </div>
                            <Input
                              value={analysisInstrumentQuery}
                              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setAnalysisInstrumentQuery(event.target.value)
                              }
                              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                                if (event.key !== "Enter") return;
                                if (analysisInstrumentSearchResults.length === 0) return;
                                event.preventDefault();
                                setAnalysisInstrumentSymbol(
                                  analysisInstrumentSearchResults[0].symbol
                                );
                              }}
                              placeholder="例如：600519 / 贵州茅台 / 510300"
                            />
                            {analysisInstrumentSearchLoading && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                搜索中...
                              </div>
                            )}
                            {!analysisInstrumentSearchLoading &&
                              analysisInstrumentQuery.trim() !== "" &&
                              analysisInstrumentSearchResults.length === 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  未找到匹配标的。
                                </div>
                              )}
                            {!analysisInstrumentSearchLoading &&
                              analysisInstrumentSearchResults.length > 0 && (
                                <div className="max-h-56 overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
                                  {analysisInstrumentSearchResults.slice(0, 20).map((item) => {
                                    const selected =
                                      analysisInstrumentSymbol === item.symbol;
                                    return (
                                      <button
                                        key={item.symbol}
                                        type="button"
                                        className={`w-full text-left px-3 py-2 border-b border-slate-200 dark:border-border-dark last:border-b-0 text-sm ${
                                          selected
                                            ? "bg-slate-100 dark:bg-background-dark text-slate-900 dark:text-white"
                                            : "hover:bg-slate-50 dark:hover:bg-background-dark/80 text-slate-700 dark:text-slate-200"
                                        }`}
                                        onClick={() =>
                                          setAnalysisInstrumentSymbol(item.symbol)
                                        }
                                      >
                                        <div className="font-mono">{item.symbol}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                          {item.name ?? "--"} · {item.market} · {item.assetClass}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                          </div>

                          <div className="space-y-2 xl:pl-2">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              区间
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {marketChartRanges.map((range) => {
                                const isActive = analysisInstrumentRange === range.key;
                                return (
                                  <button
                                    key={range.key}
                                    type="button"
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                      isActive
                                        ? "bg-primary text-white border-primary"
                                        : "bg-white dark:bg-surface-dark text-slate-500 dark:text-slate-300 border-slate-200 dark:border-border-dark hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                    onClick={() => setAnalysisInstrumentRange(range.key)}
                                  >
                                    {range.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            快捷标的（持仓 + 自选）
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {analysisInstrumentQuickSymbols.length === 0 && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                暂无快捷标的，可先在上方搜索。
                              </span>
                            )}
                            {analysisInstrumentQuickSymbols.map((symbol) => {
                              const selected = analysisInstrumentSymbol === symbol;
                              return (
                                <button
                                  key={symbol}
                                  type="button"
                                  className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                                    selected
                                      ? "border-primary bg-primary/10 text-primary dark:bg-primary/20"
                                      : "border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                  }`}
                                  onClick={() => setAnalysisInstrumentSymbol(symbol)}
                                  title={analysisInstrumentNameBySymbol.get(symbol) ?? symbol}
                                >
                                  {symbol}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </Panel>

                    {!analysisInstrumentSymbol && (
                      <EmptyState message="请选择一个标的以查看分析结果。" />
                    )}

                    {analysisInstrumentSymbol && analysisInstrumentLoading && (
                      <EmptyState message="正在加载个股分析..." />
                    )}

                    {analysisInstrumentSymbol &&
                      !analysisInstrumentLoading &&
                      analysisInstrumentError && (
                        <ErrorState
                          message={analysisInstrumentError}
                          onRetry={() => void loadAnalysisInstrument(analysisInstrumentSymbol)}
                        />
                      )}

                    {analysisInstrumentSymbol &&
                      !analysisInstrumentLoading &&
                      !analysisInstrumentError && (
                        <>
                          <Panel>
                            <div className="space-y-4">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    {analysisInstrumentSymbol}
                                  </h3>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {analysisInstrumentProfile?.name ?? "--"} ·{" "}
                                    {analysisInstrumentProfile?.market ?? "--"} ·{" "}
                                    {analysisInstrumentProfile?.currency ?? "--"}
                                  </p>
                                </div>
                                <Badge>
                                  区间 {formatDateRange(
                                    analysisInstrumentRangeSummary.startDate,
                                    analysisInstrumentRangeSummary.endDate
                                  )}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <SummaryCard
                                  label="最新价"
                                  value={formatNumber(analysisInstrumentQuote?.close ?? null, 2)}
                                />
                                <SummaryCard
                                  label="当日涨跌"
                                  value={formatSignedPctNullable(
                                    analysisInstrumentQuote?.changePct ?? null
                                  )}
                                  trend={
                                    analysisInstrumentQuote?.changePct === null ||
                                    analysisInstrumentQuote?.changePct === undefined
                                      ? undefined
                                      : analysisInstrumentQuote.changePct >= 0
                                        ? "up"
                                        : "down"
                                  }
                                />
                                <SummaryCard
                                  label="区间收益"
                                  value={formatSignedPctNullable(
                                    analysisInstrumentRangeSummary.rangeReturn
                                  )}
                                  trend={
                                    analysisInstrumentRangeSummary.rangeReturn === null
                                      ? undefined
                                      : analysisInstrumentRangeSummary.rangeReturn >= 0
                                        ? "up"
                                        : "down"
                                  }
                                />
                                <SummaryCard
                                  label="持仓成本"
                                  value={formatNumber(analysisInstrumentHoldingUnitCost, 2)}
                                />
                              </div>
                            </div>
                          </Panel>

                          <Panel>
                            <div className="space-y-3">
                              <div className="text-xs uppercase tracking-wider text-slate-500">
                                价格走势
                              </div>
                              <div className="h-[300px] rounded-md border border-slate-200 dark:border-border-dark overflow-hidden bg-white dark:bg-background-dark/40">
                                {!analysisInstrumentHasEnoughData ? (
                                  <EmptyState message="暂无足够行情数据。" />
                                ) : (
                                  <ChartErrorBoundary
                                    resetKey={`${analysisInstrumentSymbol}:${analysisInstrumentRange}:${analysisInstrumentBars.length}`}
                                  >
                                    <MarketAreaChart
                                      bars={analysisInstrumentBars}
                                      tone={analysisInstrumentTone}
                                    />
                                  </ChartErrorBoundary>
                                )}
                              </div>
                            </div>
                          </Panel>

                          <Panel>
                            <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
                              分析明细
                            </div>
                            <div className="overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
                              <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-200 dark:divide-border-dark">
                                  <tr>
                                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                      区间最高价
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">
                                      {formatNumber(analysisInstrumentRangeSummary.rangeHigh, 2)}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                      区间最低价
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">
                                      {formatNumber(analysisInstrumentRangeSummary.rangeLow, 2)}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                      最新开/高/低/收
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">
                                      {`${formatNumber(analysisInstrumentLatestBar?.open ?? null, 2)} / ${formatNumber(analysisInstrumentLatestBar?.high ?? null, 2)} / ${formatNumber(analysisInstrumentLatestBar?.low ?? null, 2)} / ${formatNumber(analysisInstrumentLatestBar?.close ?? null, 2)}`}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                      平均成交量
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">
                                      {formatCnWanYiNullable(
                                        analysisInstrumentRangeSummary.avgVolume,
                                        2,
                                        0
                                      )}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                      持仓数量
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">
                                      {formatNumber(
                                        analysisInstrumentPositionValuation?.position.quantity ?? null,
                                        2
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                      目标价
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">
                                      {formatNumber(analysisInstrumentTargetPrice, 2)}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                      标签
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">
                                      {analysisInstrumentUserTags.length > 0
                                        ? analysisInstrumentUserTags.slice(0, 8).join("、")
                                        : "--"}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-border-dark">
                                      最新交易日
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">
                                      {analysisInstrumentQuote?.tradeDate ?? "--"}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </Panel>
                        </>
                      )}
                  </>
                )}

                {analysisTab === "portfolio" && (
                  <>
                    <Panel>
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">组合分析概览</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        组合收益、贡献与风险共享同一计算区间（详版入口）。
                      </p>
                    </div>
                  </div>

                {performanceLoading && <EmptyState message="正在加载分析数据..." />}
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
                  !performanceResult && <EmptyState message="暂无分析数据。" />}

                {!performanceLoading &&
                  !performanceError &&
                  performanceResult && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard
                          label="当前口径"
                          value={formatPerformanceMethod(performance?.selectedMethod ?? "none")}
                        />
                        <SummaryCard
                          label="区间"
                          value={formatDateRange(
                            selectedPerformance?.startDate ?? performanceSeries?.startDate ?? null,
                            selectedPerformance?.endDate ?? performanceSeries?.endDate ?? null
                          )}
                        />
                        <SummaryCard
                          label="总收益率"
                          value={formatPctNullable(selectedPerformance?.totalReturn ?? null)}
                          trend={selectedPerformance && selectedPerformance.totalReturn >= 0 ? "up" : "down"}
                        />
                        <SummaryCard
                          label="年化收益率"
                          value={formatPctNullable(selectedPerformance?.annualizedReturn ?? null)}
                          trend={
                            selectedPerformance &&
                            selectedPerformance.annualizedReturn !== null &&
                            selectedPerformance.annualizedReturn >= 0
                              ? "up"
                              : "down"
                          }
                        />
                      </div>
                    </div>
                  )}
              </Panel>

                    {!performanceLoading &&
                !performanceError &&
                performanceResult &&
                performanceSeries && (
                  <Panel>
                    <PerformanceChart series={performanceSeries} />
                  </Panel>
                )}

                    {!performanceLoading &&
                !performanceError &&
                performanceResult && (
                  <Panel>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">贡献分解</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          标的与资产类别贡献，按当前区间计算。
                        </p>
                      </div>
                      {contributionBreakdown && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {contributionBreakdown.startDate} ~ {contributionBreakdown.endDate}
                        </span>
                      )}
                    </div>

                    {!contributionBreakdown && <EmptyState message="暂无贡献数据。" />}

                    {contributionBreakdown && (
                      <div className="space-y-4">
                        {contributionBreakdown.reason && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            {contributionBreakdown.reason}
                          </div>
                        )}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <ContributionTable
                            title="标的贡献"
                            entries={contributionBreakdown.bySymbol}
                            showAll={showAllSymbolContribution}
                            topCount={CONTRIBUTION_TOP_N}
                            showMarketValue={showAllSymbolContribution}
                            onToggle={() => setShowAllSymbolContribution((prev) => !prev)}
                          />
                          <ContributionTable
                            title="资产类别贡献"
                            entries={contributionBreakdown.byAssetClass}
                            labelHeader="资产类别"
                            showAll={showAllAssetContribution}
                            topCount={CONTRIBUTION_TOP_N}
                            showMarketValue={showAllAssetContribution}
                            onToggle={() => setShowAllAssetContribution((prev) => !prev)}
                          />
                        </div>
                        {contributionBreakdown.missingSymbols.length > 0 && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            缺少行情：{contributionBreakdown.missingSymbols.slice(0, 6).join(", ")}
                            {contributionBreakdown.missingSymbols.length > 6 ? " ..." : ""}
                          </div>
                        )}
                      </div>
                    )}
                  </Panel>
                )}

                    {!performanceLoading &&
                !performanceError &&
                performanceResult && (
                  <Panel>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">风险与回撤</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          基于 NAV 与 TWR 序列计算的波动率与最大回撤。
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300 ml-2">
                        <input
                          type="checkbox"
                          name="analysisRiskAnnualized"
                          checked={riskAnnualized}
                          onChange={(e) => setRiskAnnualized(e.target.checked)}
                          className="h-3.5 w-3.5 rounded-none border-slate-300 text-primary focus:ring-primary"
                        />
                        年化波动
                      </label>
                    </div>

                    {!riskMetrics && <EmptyState message="暂无风险数据。" />}

                    {riskMetrics && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <RiskMetricCard
                          title="NAV 序列"
                          metrics={riskMetrics.nav}
                          annualized={riskAnnualized}
                        />
                        <RiskMetricCard
                          title="TWR 序列"
                          metrics={riskMetrics.twr}
                          annualized={riskAnnualized}
                        />
                      </div>
                    )}
                  </Panel>
                )}
                  </>
                )}
      </div>
    </div>
  );
}
