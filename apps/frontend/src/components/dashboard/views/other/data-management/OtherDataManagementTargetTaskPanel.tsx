import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ListTargetTaskStatusResult,
  MarketTargetTaskMatrixConfig,
  PreviewTargetTaskCoverageResult,
  TargetTaskModuleId,
  TargetTaskStatus
} from "@mytrader/shared";

import type { OtherViewProps } from "../../OtherView";

type ModuleFilter = "all" | TargetTaskModuleId;
type StatusFilter = "all" | TargetTaskStatus;

const TARGET_TASK_MODULES: Array<{ id: TargetTaskModuleId; label: string }> = [
  { id: "core.daily_prices", label: "行情日线" },
  { id: "core.instrument_meta", label: "标的元数据" },
  { id: "core.daily_basics", label: "股票基础面" },
  { id: "core.daily_moneyflows", label: "股票资金流" },
  { id: "core.futures_settle", label: "期货结算价" },
  { id: "core.futures_oi", label: "期货持仓量" },
  { id: "core.spot_price_avg", label: "现货均价" },
  { id: "core.spot_settle", label: "现货交割量" },
  { id: "task.exposure", label: "任务: 敞口" },
  { id: "task.momentum", label: "任务: 动量" },
  { id: "task.liquidity", label: "任务: 流动性" }
];

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "complete", label: "完整" },
  { value: "partial", label: "部分缺失" },
  { value: "missing", label: "缺失" },
  { value: "not_applicable", label: "不适用" }
];
const COMPLETENESS_DEFINITION_TOOLTIP =
  "用于评估/回补目标池数据完整度，不改变抓取范围。";

type HealthLevel = "healthy" | "watch" | "risk";

type CoverageAssetView = {
  assetClass: string;
  assetLabel: string;
  complete: number;
  partial: number;
  missing: number;
  notApplicable: number;
  applicable: number;
  total: number;
  repair: number;
  completeRate: number;
  partialRate: number;
  missingRate: number;
  notApplicableRate: number;
  repairRate: number;
};

type CoverageMatrixRowKey =
  | "complete"
  | "partial"
  | "missing"
  | "notApplicable"
  | "repair";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

function getStatusToneClass(status: TargetTaskStatus): string {
  if (status === "complete") return "border-emerald-300 text-emerald-700 dark:text-emerald-300";
  if (status === "partial") return "border-amber-300 text-amber-700 dark:text-amber-300";
  if (status === "missing") return "border-rose-300 text-rose-700 dark:text-rose-300";
  return "border-slate-300 text-slate-600 dark:border-border-dark dark:text-slate-300";
}

function formatStatusLabel(status: TargetTaskStatus): string {
  if (status === "complete") return "完整";
  if (status === "partial") return "部分缺失";
  if (status === "missing") return "缺失";
  return "不适用";
}

function toAssetLabel(assetClass: string): string {
  if (assetClass === "stock") return "股票";
  if (assetClass === "etf") return "ETF";
  if (assetClass === "futures") return "期货";
  if (assetClass === "spot") return "现货";
  if (assetClass === "cash") return "现金";
  if (assetClass === "unknown") return "未知";
  return assetClass;
}

function toRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function resolveCompletenessBand(rate: number): {
  textClass: string;
} {
  if (rate < 0.2) {
    return { textClass: "text-rose-600 dark:text-rose-400" };
  }
  if (rate < 0.4) {
    return { textClass: "text-orange-600 dark:text-orange-400" };
  }
  if (rate < 0.6) {
    return { textClass: "text-amber-600 dark:text-amber-400" };
  }
  if (rate < 0.8) {
    return { textClass: "text-lime-600 dark:text-lime-400" };
  }
  return { textClass: "text-emerald-600 dark:text-emerald-400" };
}

function getDateLagDays(dateText: string | null): number | null {
  if (!dateText) return null;
  const target = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = todayStart.getTime() - target.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function resolveHealthLevel(input: {
  missingRate: number;
  partialRate: number;
  lagDays: number | null;
}): {
  level: HealthLevel;
  label: string;
  textClass: string;
  dotClass: string;
  hint: string;
} {
  const lag = input.lagDays ?? 0;
  if (input.missingRate >= 0.3 || lag >= 3) {
    return {
      level: "risk",
      label: "高风险",
      textClass: "text-rose-700 dark:text-rose-300",
      dotClass: "bg-rose-500",
      hint: "先执行物化，再展开状态明细定位缺失。"
    };
  }
  if (input.missingRate >= 0.1 || input.partialRate >= 0.25 || lag >= 2) {
    return {
      level: "watch",
      label: "需关注",
      textClass: "text-amber-700 dark:text-amber-300",
      dotClass: "bg-amber-500",
      hint: "建议执行一次物化，并关注高缺失资产。"
    };
  }
  return {
    level: "healthy",
    label: "健康",
    textClass: "text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    hint: "当前覆盖稳定，可按需抽查状态明细。"
  };
}

export type OtherDataManagementTargetTaskPanelProps = Pick<
  OtherViewProps,
  "Button" | "Input" | "PopoverSelect" | "formatCnDate"
>;

export function OtherDataManagementTargetTaskPanel(
  props: OtherDataManagementTargetTaskPanelProps
) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [materializing, setMaterializing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [matrixConfig, setMatrixConfig] =
    useState<MarketTargetTaskMatrixConfig | null>(null);
  const [savedMatrixConfig, setSavedMatrixConfig] =
    useState<MarketTargetTaskMatrixConfig | null>(null);
  const [coverage, setCoverage] = useState<PreviewTargetTaskCoverageResult | null>(null);
  const [statusRows, setStatusRows] = useState<ListTargetTaskStatusResult | null>(null);

  const [symbolFilter, setSymbolFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [statusPanelExpanded, setStatusPanelExpanded] = useState(false);

  const refreshConfigAndCoverage = useCallback(async () => {
    if (!window.mytrader) return;
    setLoading(true);
    try {
      const [nextConfig, nextCoverage] = await Promise.all([
        window.mytrader.market.getTargetTaskMatrixConfig(),
        window.mytrader.market.previewTargetTaskCoverage()
      ]);
      setMatrixConfig(nextConfig);
      setSavedMatrixConfig(nextConfig);
      setCoverage(nextCoverage);
      setError(null);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStatusRows = useCallback(async () => {
    if (!window.mytrader) return;
    setStatusLoading(true);
    try {
      const result = await window.mytrader.market.listTargetTaskStatus({
        symbol: symbolFilter.trim() ? symbolFilter.trim() : null,
        moduleId: moduleFilter === "all" ? null : moduleFilter,
        status: statusFilter === "all" ? null : statusFilter,
        limit: 120,
        offset: 0
      });
      setStatusRows(result);
    } catch (err) {
      setError(toErrorMessage(err));
      setStatusRows(null);
    } finally {
      setStatusLoading(false);
    }
  }, [moduleFilter, statusFilter, symbolFilter]);

  useEffect(() => {
    void refreshConfigAndCoverage();
  }, [refreshConfigAndCoverage]);

  useEffect(() => {
    if (!statusPanelExpanded) return;
    void refreshStatusRows();
  }, [refreshStatusRows, statusPanelExpanded]);

  const matrixDirty = useMemo(() => {
    if (!matrixConfig || !savedMatrixConfig) return false;
    return JSON.stringify(matrixConfig) !== JSON.stringify(savedMatrixConfig);
  }, [matrixConfig, savedMatrixConfig]);

  const moduleFilterOptions = useMemo(
    () => [
      { value: "all", label: "全部模块" },
      ...TARGET_TASK_MODULES.map((module) => ({
        value: module.id,
        label: module.label
      }))
    ],
    []
  );

  const coverageSummary = useMemo(() => {
    if (!coverage) return null;
    const complete = coverage.totals.complete ?? 0;
    const partial = coverage.totals.partial ?? 0;
    const missing = coverage.totals.missing ?? 0;
    const notApplicable = coverage.totals.notApplicable ?? 0;
    const applicable = complete + partial + missing;
    const total = applicable + notApplicable;
    const repair = partial + missing;
    const completeRate = toRate(complete, applicable);
    const partialRate = toRate(partial, applicable);
    const missingRate = toRate(missing, applicable);
    const notApplicableRate = toRate(notApplicable, total);
    const repairRate = toRate(repair, applicable);
    const lagDays = getDateLagDays(coverage.asOfTradeDate);
    const health = resolveHealthLevel({ missingRate, partialRate, lagDays });

    return {
      complete,
      partial,
      missing,
      notApplicable,
      applicable,
      total,
      completeRate,
      partialRate,
      missingRate,
      notApplicableRate,
      repair,
      repairRate,
      lagDays,
      health
    };
  }, [coverage]);

  const assetCoverageViews = useMemo<CoverageAssetView[]>(() => {
    if (!coverage) return [];
    return coverage.byAssetClass
      .map((item) => {
        const complete = item.complete ?? 0;
        const partial = item.partial ?? 0;
        const missing = item.missing ?? 0;
        const notApplicable = item.notApplicable ?? 0;
        const applicable = complete + partial + missing;
        const total = applicable + notApplicable;
        const repair = partial + missing;
        return {
          assetClass: item.assetClass,
          assetLabel: toAssetLabel(item.assetClass),
          complete,
          partial,
          missing,
          notApplicable,
          applicable,
          total,
          repair,
          completeRate: toRate(complete, applicable),
          partialRate: toRate(partial, applicable),
          missingRate: toRate(missing, applicable),
          notApplicableRate: toRate(notApplicable, total),
          repairRate: toRate(repair, applicable)
        } satisfies CoverageAssetView;
      })
      .sort((a, b) => {
        if (a.missingRate !== b.missingRate) return b.missingRate - a.missingRate;
        return b.missing - a.missing;
      });
  }, [coverage]);

  const topRiskAsset = useMemo(() => {
    return assetCoverageViews.find((item) => item.applicable > 0) ?? null;
  }, [assetCoverageViews]);

  const displayAssetCoverageViews = useMemo(() => {
    const order = new Map<string, number>([
      ["stock", 0],
      ["etf", 1],
      ["futures", 2],
      ["spot", 3]
    ]);
    return assetCoverageViews
      .filter((item) => item.total > 0)
      .sort((a, b) => {
        const aOrder = order.get(a.assetClass) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = order.get(b.assetClass) ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.assetLabel.localeCompare(b.assetLabel, "zh-CN");
      });
  }, [assetCoverageViews]);

  const coverageMatrixRows = useMemo(() => {
    if (!coverageSummary) return [];

    const buildRow = (
      rowKey: CoverageMatrixRowKey,
      label: string,
      overallCount: number,
      overallRate: number | null,
      pick: (asset: CoverageAssetView) => { count: number; rate: number | null }
    ) => ({
      rowKey,
      label,
      overallCount,
      overallRate,
      assets: displayAssetCoverageViews.map((asset) => ({
        assetClass: asset.assetClass,
        ...pick(asset)
      }))
    });

    return [
      buildRow("complete", "完整", coverageSummary.complete, coverageSummary.completeRate, (asset) => ({
        count: asset.complete,
        rate: asset.completeRate
      })),
      buildRow("partial", "部分缺失", coverageSummary.partial, coverageSummary.partialRate, (asset) => ({
        count: asset.partial,
        rate: asset.partialRate
      })),
      buildRow("missing", "缺失", coverageSummary.missing, coverageSummary.missingRate, (asset) => ({
        count: asset.missing,
        rate: asset.missingRate
      })),
      buildRow(
        "notApplicable",
        "不适用",
        coverageSummary.notApplicable,
        coverageSummary.notApplicableRate,
        (asset) => ({
          count: asset.notApplicable,
          rate: asset.notApplicableRate
        })
      ),
      buildRow("repair", "待回补", coverageSummary.repair, coverageSummary.repairRate, (asset) => ({
        count: asset.repair,
        rate: asset.repairRate
      }))
    ];
  }, [coverageSummary, displayAssetCoverageViews]);

  const handleToggleModule = useCallback((moduleId: TargetTaskModuleId) => {
    setMatrixConfig((prev) => {
      if (!prev) return prev;
      const enabled = new Set(prev.enabledModules);
      if (enabled.has(moduleId)) {
        if (enabled.size <= 1) return prev;
        enabled.delete(moduleId);
      } else {
        enabled.add(moduleId);
      }
      return {
        ...prev,
        enabledModules: TARGET_TASK_MODULES.map((item) => item.id).filter((id) =>
          enabled.has(id)
        )
      };
    });
  }, []);

  const handleSaveMatrix = useCallback(async () => {
    if (!window.mytrader || !matrixConfig) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (matrixConfig.enabledModules.length === 0) {
        throw new Error("至少启用一个模块。");
      }
      const saved = await window.mytrader.market.setTargetTaskMatrixConfig(matrixConfig);
      setMatrixConfig(saved);
      setSavedMatrixConfig(saved);
      setNotice("完备性配置已保存。");
      await refreshConfigAndCoverage();
      if (statusPanelExpanded) {
        await refreshStatusRows();
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [matrixConfig, refreshConfigAndCoverage, refreshStatusRows, statusPanelExpanded]);

  const handleRunMaterialization = useCallback(async () => {
    if (!window.mytrader) return;
    setMaterializing(true);
    setError(null);
    setNotice(null);
    try {
      const symbols = symbolFilter
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      await window.mytrader.market.runTargetMaterialization({
        symbols: symbols.length > 0 ? symbols : null
      });
      await refreshConfigAndCoverage();
      if (statusPanelExpanded) {
        await refreshStatusRows();
        setNotice("目标池物化已触发，状态已刷新。");
      } else {
        setNotice("目标池物化已触发。");
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setMaterializing(false);
    }
  }, [refreshConfigAndCoverage, refreshStatusRows, statusPanelExpanded, symbolFilter]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
          <span>目标池数据完备性</span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-500 dark:border-border-dark dark:text-slate-300 cursor-help"
            title={COMPLETENESS_DEFINITION_TOOLTIP}
            aria-label={COMPLETENESS_DEFINITION_TOOLTIP}
          >
            ?
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <props.Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={() => {
              void refreshConfigAndCoverage();
              if (statusPanelExpanded) {
                void refreshStatusRows();
              }
            }}
            disabled={loading || statusLoading || materializing}
          >
            刷新
          </props.Button>
          <props.Button
            variant="primary"
            size="sm"
            icon="play_arrow"
            onClick={handleRunMaterialization}
            disabled={materializing}
          >
            执行物化
          </props.Button>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-3">
        {coverageSummary ? (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <div className="flex min-w-full w-max items-center gap-4 whitespace-nowrap px-1 py-1 text-xs">
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${coverageSummary.health.dotClass}`}
                  />
                  <span className={`font-semibold ${coverageSummary.health.textClass}`}>
                    健康状态: {coverageSummary.health.label}
                  </span>
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {coverageSummary.health.hint}
                </span>
                <span className="ml-auto text-right font-mono text-slate-500 dark:text-slate-400">
                  统计日期 {coverage?.asOfTradeDate ? props.formatCnDate(coverage.asOfTradeDate) : "--"}
                  {" · "}
                  延迟 {coverageSummary.lagDays === null ? "--" : `${coverageSummary.lagDays} 天`}
                  {" · "}
                  规模 {coverage?.totals.symbols ?? 0} symbols / {coverage?.totals.modules ?? 0} modules
                </span>
              </div>
            </div>
            <div className="w-full border-t border-slate-200/70 dark:border-border-dark/70" />

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  资产覆盖状态矩阵
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {topRiskAsset
                    ? `最高风险: ${topRiskAsset.assetLabel} · 缺失率 ${formatRate(
                        topRiskAsset.missingRate
                      )}`
                    : "最高风险: --"}
                  {" · "}
                  当前显示 {displayAssetCoverageViews.length} 个资产类别
                </div>
              </div>
              {displayAssetCoverageViews.length > 0 ? (
                <div className="max-h-[360px] overflow-auto">
                  <table className="min-w-[860px] w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-20 bg-white dark:bg-background-dark">
                      <tr className="border-b border-slate-200/70 dark:border-border-dark/70 text-slate-500 dark:text-slate-400">
                        <th className="sticky left-0 z-30 w-20 min-w-[80px] bg-white px-1.5 py-1.5 text-left font-semibold dark:bg-background-dark">
                          覆盖程度
                        </th>
                        <th className="px-1.5 py-1.5 text-right font-semibold">整体</th>
                        {displayAssetCoverageViews.map((asset) => (
                          <th
                            key={`coverage-matrix-header-${asset.assetClass}`}
                            className="px-1.5 py-1.5 text-right font-semibold"
                          >
                            {asset.assetLabel}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {coverageMatrixRows.map((row) => {
                        const overallCompleteTone =
                          row.rowKey === "complete" && row.overallRate !== null
                            ? resolveCompletenessBand(row.overallRate).textClass
                            : "text-slate-500 dark:text-slate-400";
                        return (
                          <tr
                            key={`coverage-matrix-row-${row.rowKey}`}
                            className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                          >
                            <td className="sticky left-0 z-10 w-20 min-w-[80px] bg-white px-1.5 py-1.5 dark:bg-background-dark">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {row.label}
                              </span>
                            </td>
                            <td className="px-1.5 py-1.5 text-right">
                              <div className="font-mono text-slate-700 dark:text-slate-200">
                                {row.overallCount.toLocaleString()}
                              </div>
                              <div className={`text-[10px] ${overallCompleteTone}`}>
                                {row.overallRate === null ? "--" : formatRate(row.overallRate)}
                              </div>
                            </td>
                            {row.assets.map((cell) => {
                              const cellCompleteTone =
                                row.rowKey === "complete" && cell.rate !== null
                                  ? resolveCompletenessBand(cell.rate).textClass
                                  : "text-slate-500 dark:text-slate-400";
                              return (
                                <td
                                  key={`coverage-matrix-cell-${row.rowKey}-${cell.assetClass}`}
                                  className="px-1.5 py-1.5 text-right"
                                >
                                  <div className="font-mono text-slate-700 dark:text-slate-200">
                                    {cell.count.toLocaleString()}
                                  </div>
                                  <div className={`text-[10px] ${cellCompleteTone}`}>
                                    {cell.rate === null ? "--" : formatRate(cell.rate)}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  暂无资产维度覆盖数据。
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-slate-200/70 px-3 py-2 text-xs text-slate-500 dark:border-border-dark/70 dark:text-slate-400">
            暂无覆盖数据。
          </div>
        )}

        <div className="rounded-md border border-slate-200/70 dark:border-border-dark/70 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                完备性模块配置
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                  matrixDirty
                    ? "border-amber-300 text-amber-700 dark:text-amber-300"
                    : "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {matrixDirty ? "草稿未保存" : "已同步"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <props.Button
                variant="secondary"
                size="sm"
                icon="restart_alt"
                onClick={() => setMatrixConfig(savedMatrixConfig)}
                disabled={!matrixDirty || saving || !savedMatrixConfig}
              >
                重置
              </props.Button>
              <props.Button
                variant="primary"
                size="sm"
                icon="save"
                onClick={handleSaveMatrix}
                disabled={!matrixDirty || saving || !matrixConfig}
              >
                保存矩阵
              </props.Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {TARGET_TASK_MODULES.map((module) => {
              const enabled = Boolean(
                matrixConfig?.enabledModules.includes(module.id)
              );
              return (
                <button
                  key={`task-module-${module.id}`}
                  type="button"
                  onClick={() => handleToggleModule(module.id)}
                  className={`rounded-md border px-2.5 py-2 text-left text-xs ${
                    enabled
                      ? "border-primary/40 bg-primary/12 text-slate-800 dark:text-slate-100"
                      : "border-slate-200/80 dark:border-border-dark/70 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <div className="font-semibold">{module.label}</div>
                  <div className="mt-0.5 font-mono opacity-75">{module.id}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-border-dark/70 p-2.5 space-y-2">
          <button
            type="button"
            onClick={() => setStatusPanelExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between text-left"
            aria-label={statusPanelExpanded ? "收起状态明细" : "展开状态明细"}
            title={statusPanelExpanded ? "收起状态明细" : "展开状态明细"}
          >
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              状态明细
            </span>
            <span className="material-icons-outlined text-sm text-slate-500 dark:text-slate-400">
              {statusPanelExpanded ? "expand_less" : "expand_more"}
            </span>
          </button>

          {statusPanelExpanded ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <props.Input
                  value={symbolFilter}
                  onChange={(event) => setSymbolFilter(event.target.value)}
                  placeholder="筛选 symbol（支持逗号/空格多值）"
                  className="h-8 max-w-[260px] text-xs font-mono"
                />
                <props.PopoverSelect
                  value={moduleFilter}
                  onChangeValue={(value: string) => setModuleFilter(value as ModuleFilter)}
                  options={moduleFilterOptions}
                  className="w-[220px]"
                  buttonClassName="h-8 text-xs"
                />
                <props.PopoverSelect
                  value={statusFilter}
                  onChangeValue={(value: string) => setStatusFilter(value as StatusFilter)}
                  options={STATUS_FILTER_OPTIONS}
                  className="w-[200px]"
                  buttonClassName="h-8 text-xs"
                />
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  onClick={() => void refreshStatusRows()}
                  disabled={statusLoading}
                >
                  刷新状态
                </props.Button>
              </div>

              {statusLoading && (
                <div className="text-xs text-slate-500 dark:text-slate-400">加载中...</div>
              )}
              {!statusLoading && (
                <div className="max-h-[360px] overflow-auto rounded-md border border-slate-200/70 dark:border-border-dark/70">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white dark:bg-background-dark">
                      <tr className="border-b border-slate-200/70 dark:border-border-dark/70 text-slate-500 dark:text-slate-400">
                        <th className="px-2 py-1.5 text-left font-semibold">Symbol</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Module</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Asset</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Status</th>
                        <th className="px-2 py-1.5 text-right font-semibold">Coverage</th>
                        <th className="px-2 py-1.5 text-left font-semibold">As Of</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(statusRows?.items ?? []).map((item) => (
                        <tr
                          key={`${item.symbol}-${item.moduleId}`}
                          className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                        >
                          <td className="px-2 py-1.5 font-mono text-slate-700 dark:text-slate-200">
                            {item.symbol}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                            {item.moduleId}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                            {item.assetClass ?? "--"}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 ${getStatusToneClass(
                                item.status
                              )}`}
                            >
                              {formatStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200">
                            {item.coverageRatio === null
                              ? "--"
                              : `${(item.coverageRatio * 100).toFixed(1)}%`}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                            {item.asOfTradeDate ? props.formatCnDate(item.asOfTradeDate) : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!statusRows || statusRows.items.length === 0 ? (
                    <div className="px-3 py-6 text-xs text-slate-500 dark:text-slate-400">
                      暂无状态数据。
                    </div>
                  ) : null}
                </div>
              )}
              {!statusLoading && statusRows ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  展示 {statusRows.items.length} / {statusRows.total}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              默认收起，展开后可按 symbol/module/status 排查缺口。
            </div>
          )}
        </div>

        {(error || notice) && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              error
                ? "border-rose-300 text-rose-700 dark:text-rose-300"
                : "border-emerald-300 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {error ?? notice}
          </div>
        )}

        {loading && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            完备性面板加载中...
          </div>
        )}
      </div>
    </section>
  );
}
