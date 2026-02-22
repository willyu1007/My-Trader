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
  { value: "complete", label: "complete" },
  { value: "partial", label: "partial" },
  { value: "missing", label: "missing" },
  { value: "not_applicable", label: "not_applicable" }
];

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
    void refreshStatusRows();
  }, [refreshStatusRows]);

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
      setNotice("目标任务矩阵已保存。");
      await refreshConfigAndCoverage();
      await refreshStatusRows();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [matrixConfig, refreshConfigAndCoverage, refreshStatusRows]);

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
      setNotice("目标池物化已触发，状态已刷新。");
      await Promise.all([refreshConfigAndCoverage(), refreshStatusRows()]);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setMaterializing(false);
    }
  }, [refreshConfigAndCoverage, refreshStatusRows, symbolFilter]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900 dark:text-white">
          目标任务矩阵（SSOT-first）
        </h3>
        <div className="flex items-center gap-2">
          <props.Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={() => {
              void refreshConfigAndCoverage();
              void refreshStatusRows();
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="rounded-md border border-slate-200/80 dark:border-border-dark/70 bg-slate-50/60 dark:bg-background-dark/40 px-3 py-2">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              As Of
            </div>
            <div className="mt-0.5 font-mono text-sm text-slate-800 dark:text-slate-100">
              {coverage?.asOfTradeDate ? props.formatCnDate(coverage.asOfTradeDate) : "--"}
            </div>
          </div>
          <div className="rounded-md border border-slate-200/80 dark:border-border-dark/70 bg-slate-50/60 dark:bg-background-dark/40 px-3 py-2">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              覆盖规模
            </div>
            <div className="mt-0.5 font-mono text-sm text-slate-800 dark:text-slate-100">
              {coverage?.totals.symbols ?? 0} symbols / {coverage?.totals.modules ?? 0} modules
            </div>
          </div>
          <div className="rounded-md border border-slate-200/80 dark:border-border-dark/70 bg-slate-50/60 dark:bg-background-dark/40 px-3 py-2">
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              状态计数
            </div>
            <div className="mt-0.5 text-xs font-mono text-slate-700 dark:text-slate-200">
              C:{coverage?.totals.complete ?? 0} / P:{coverage?.totals.partial ?? 0} / M:
              {coverage?.totals.missing ?? 0} / NA:{coverage?.totals.notApplicable ?? 0}
            </div>
          </div>
        </div>

        {coverage && coverage.byAssetClass.length > 0 && (
          <div className="rounded-md border border-slate-200/70 dark:border-border-dark/70 px-2.5 py-2 text-xs text-slate-600 dark:text-slate-300">
            {coverage.byAssetClass.map((item) => (
              <span
                key={`asset-coverage-${item.assetClass}`}
                className="inline-flex mr-2 mb-1 rounded-full border border-slate-300/70 dark:border-border-dark/70 px-2 py-0.5"
              >
                {item.assetClass}: C {item.complete} / P {item.partial} / M {item.missing} / NA{" "}
                {item.notApplicable}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-md border border-slate-200/70 dark:border-border-dark/70 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                矩阵配置
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

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-3 items-start">
            <div className="space-y-1.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                缺口回补窗口（天）
              </div>
              <props.Input
                type="number"
                min={1}
                max={720}
                value={String(matrixConfig?.defaultLookbackDays ?? 180)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setMatrixConfig((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      defaultLookbackDays: Number.isFinite(next)
                        ? Math.max(1, Math.min(720, Math.floor(next)))
                        : prev.defaultLookbackDays
                    };
                  });
                }}
                className="h-8 font-mono text-sm"
              />
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
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-border-dark/70 p-2.5 space-y-2">
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
                          {item.status}
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
            目标任务矩阵加载中...
          </div>
        )}
      </div>
    </section>
  );
}
