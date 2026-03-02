import { Fragment, useEffect, useMemo, useState } from "react";

import type {
  CleanupMarketTestDataResult,
  InjectMarketTestDataResult,
  MarketTestDataScenarioId,
  MarketTestDataScenarioSpec,
  MarketTestDataScenarioStatus
} from "@mytrader/shared";

import type { OtherViewProps } from "../OtherView";

type TestDataResult = InjectMarketTestDataResult | CleanupMarketTestDataResult;

export type OtherTestTabProps = Pick<
  OtherViewProps,
  "Button" | "activePortfolio" | "setActiveView"
>;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

function formatDateTime(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.floor(value)));
}

export function OtherTestTab({
  Button,
  activePortfolio,
  setActiveView
}: OtherTestTabProps) {
  const [scenarios, setScenarios] = useState<MarketTestDataScenarioSpec[]>([]);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<
    MarketTestDataScenarioId[]
  >([]);
  const [statusRows, setStatusRows] = useState<MarketTestDataScenarioStatus[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [runningAction, setRunningAction] = useState<"inject" | "cleanup" | null>(
    null
  );
  const [includeDependencies, setIncludeDependencies] = useState(true);
  const [selectedCleanupScenarioIds, setSelectedCleanupScenarioIds] = useState<
    MarketTestDataScenarioId[]
  >([]);
  const [expandedStatusRows, setExpandedStatusRows] = useState<
    MarketTestDataScenarioId[]
  >([]);
  const [lastResult, setLastResult] = useState<TestDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshScenarios = async () => {
    if (!window.mytrader) return;
    setLoadingScenarios(true);
    setError(null);
    try {
      const result = await window.mytrader.market.listTestDataScenarios();
      setScenarios(result.scenarios);
      const defaults = result.scenarios
        .filter((item) => item.defaultSelected)
        .map((item) => item.id);
      setSelectedScenarioIds((prev) =>
        prev.length > 0 ? prev : (defaults as MarketTestDataScenarioId[])
      );
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoadingScenarios(false);
    }
  };

  const refreshStatus = async () => {
    if (!window.mytrader) return;
    setLoadingStatus(true);
    try {
      const result = await window.mytrader.market.getTestDataStatus();
      setStatusRows(result.scenarios);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void refreshScenarios();
    void refreshStatus();
  }, []);

  useEffect(() => {
    const valid = new Set(statusRows.map((item) => item.scenarioId));
    setExpandedStatusRows((prev) => prev.filter((id) => valid.has(id)));
    const injected = new Set(
      statusRows.filter((item) => item.injected).map((item) => item.scenarioId)
    );
    setSelectedCleanupScenarioIds((prev) => prev.filter((id) => injected.has(id)));
  }, [statusRows]);

  const selectedSet = useMemo(
    () => new Set<MarketTestDataScenarioId>(selectedScenarioIds),
    [selectedScenarioIds]
  );

  const scenarioNameMap = useMemo(() => {
    const map = new Map<MarketTestDataScenarioId, string>();
    scenarios.forEach((scenario) => {
      map.set(scenario.id, scenario.name);
    });
    return map;
  }, [scenarios]);

  const injectedStatusRows = useMemo(
    () => statusRows.filter((item) => item.injected),
    [statusRows]
  );

  const injectedScenarioSet = useMemo(
    () => new Set<MarketTestDataScenarioId>(injectedStatusRows.map((item) => item.scenarioId)),
    [injectedStatusRows]
  );

  const selectedCleanupSet = useMemo(
    () => new Set<MarketTestDataScenarioId>(selectedCleanupScenarioIds),
    [selectedCleanupScenarioIds]
  );

  const cleanupAllInjectedSelected =
    injectedStatusRows.length > 0 &&
    selectedCleanupScenarioIds.length === injectedStatusRows.length;

  const expandedStatusSet = useMemo(
    () => new Set<MarketTestDataScenarioId>(expandedStatusRows),
    [expandedStatusRows]
  );

  const toggleScenario = (id: MarketTestDataScenarioId) => {
    setSelectedScenarioIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  };

  const handleSelectAll = () => {
    if (selectedScenarioIds.length === scenarios.length) {
      setSelectedScenarioIds([]);
      return;
    }
    setSelectedScenarioIds(scenarios.map((item) => item.id));
  };

  const toggleCleanupScenario = (id: MarketTestDataScenarioId) => {
    if (!injectedScenarioSet.has(id)) return;
    setSelectedCleanupScenarioIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  };

  const handleSelectAllCleanup = () => {
    if (cleanupAllInjectedSelected) {
      setSelectedCleanupScenarioIds([]);
      return;
    }
    setSelectedCleanupScenarioIds(injectedStatusRows.map((item) => item.scenarioId));
  };

  const toggleStatusRowExpanded = (id: MarketTestDataScenarioId) => {
    setExpandedStatusRows((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  };

  const runAction = async (action: "inject" | "cleanup") => {
    if (!window.mytrader) return;
    const scenarioIds =
      action === "inject" ? selectedScenarioIds : selectedCleanupScenarioIds;
    if (scenarioIds.length === 0) {
      setError(action === "inject" ? "请至少选择一个场景。" : "请在右侧选择要清理的已注入场景。");
      return;
    }
    setRunningAction(action);
    setError(null);
    try {
      if (action === "inject") {
        const result = await window.mytrader.market.injectTestData({
          scenarioIds,
          portfolioId: activePortfolio?.id ?? null,
          includeDependencies
        });
        setLastResult(result);
      } else {
        const result = await window.mytrader.market.cleanupTestData({
          scenarioIds,
          portfolioId: activePortfolio?.id ?? null
        });
        setLastResult(result);
      }
      await refreshStatus();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <section className="h-full min-h-0 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900 dark:text-white">测试数据工作台</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={() => {
              void refreshScenarios();
              void refreshStatus();
            }}
            disabled={loadingScenarios || loadingStatus || runningAction !== null}
          >
            刷新
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="show_chart"
            onClick={() => setActiveView("market")}
          >
            打开市场行情
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-3">
        <div className="h-full min-h-0 rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              场景列表
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={includeDependencies}
                  onChange={(event) => setIncludeDependencies(event.target.checked)}
                />
                自动包含依赖场景
              </label>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                已选 {selectedScenarioIds.length} / {scenarios.length} 个场景
              </div>
              <button
                type="button"
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                onClick={handleSelectAll}
                disabled={loadingScenarios || scenarios.length === 0}
              >
                {selectedScenarioIds.length === scenarios.length ? "取消全选" : "全选"}
              </button>
              <Button
                variant="primary"
                size="sm"
                className="min-w-[108px]"
                onClick={() => void runAction("inject")}
                disabled={runningAction !== null || selectedScenarioIds.length === 0}
              >
                {runningAction === "inject" ? "注入中..." : "批量注入"}
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {loadingScenarios && (
              <div className="px-3 py-5 text-sm text-slate-500 dark:text-slate-400">
                场景加载中...
              </div>
            )}
            {!loadingScenarios && scenarios.length === 0 && (
              <div className="px-3 py-5 text-sm text-slate-500 dark:text-slate-400">
                暂无测试场景。
              </div>
            )}
            {!loadingScenarios && scenarios.length > 0 && (
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-50/70 dark:bg-background-dark/50">
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 font-medium w-[28%]">名称</th>
                    <th className="px-3 py-2 font-medium w-[32%]">覆盖</th>
                    <th className="px-3 py-2 font-medium w-[28%]">依赖</th>
                    <th className="px-3 py-2 font-medium w-[12%]">大小</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((scenario) => {
                    const checked = selectedSet.has(scenario.id);
                    return (
                      <tr
                        key={scenario.id}
                        className={`border-t border-slate-200/70 dark:border-border-dark/70 ${
                          checked ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2 align-top">
                          <label className="inline-flex items-start gap-2 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4"
                              checked={checked}
                              onChange={() => toggleScenario(scenario.id)}
                            />
                            <span
                              className="truncate text-slate-900 dark:text-slate-100 underline decoration-dotted underline-offset-2"
                              data-mt-tooltip={scenario.description}
                              data-mt-tooltip-delay-ms="150"
                            >
                              {scenario.name}
                            </span>
                          </label>
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-600 dark:text-slate-300">
                          {scenario.coverage.join(" · ")}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-500 dark:text-slate-400">
                          {scenario.dependencies.length > 0
                            ? scenario.dependencies
                                .map((dependencyId) => scenarioNameMap.get(dependencyId) ?? dependencyId)
                                .join(" / ")
                            : "--"}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-600 dark:text-slate-300">
                          {scenario.sizeLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 border-t border-slate-200/70 dark:border-border-dark/70">
              <div className="text-xs text-rose-600 dark:text-rose-300">{error}</div>
            </div>
          )}
        </div>

        <div className="h-full min-h-0 rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark flex flex-col">
          <div className="px-3 py-2 border-b border-slate-200/70 dark:border-border-dark/70 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              执行面板
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                目标组合：{activePortfolio ? `${activePortfolio.name}` : "未选择"}
              </div>
              <button
                type="button"
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                onClick={handleSelectAllCleanup}
                disabled={injectedStatusRows.length === 0 || runningAction !== null}
              >
                {cleanupAllInjectedSelected ? "取消全选" : "全选已注入"}
              </button>
              <Button
                variant="secondary"
                size="sm"
                className="min-w-[108px]"
                onClick={() => void runAction("cleanup")}
                disabled={runningAction !== null || selectedCleanupScenarioIds.length === 0}
              >
                {runningAction === "cleanup" ? "清理中..." : "批量清理"}
              </Button>
            </div>
          </div>
          <div className="p-3 space-y-3 flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
              <div className="h-full overflow-auto">
                {statusRows.length === 0 ? (
                  <div className="px-1 py-3 text-xs text-slate-500 dark:text-slate-400">
                    暂无状态数据。
                  </div>
                ) : (
                  <table className="w-full table-fixed text-xs">
                    <thead className="bg-slate-50/70 dark:bg-background-dark/50">
                      <tr className="text-left text-slate-500 dark:text-slate-400">
                        <th className="px-2 py-1.5 font-medium w-[38%]">场景</th>
                        <th className="px-2 py-1.5 font-medium w-[16%]">状态</th>
                        <th className="px-2 py-1.5 font-medium w-[14%]">条目</th>
                        <th className="px-2 py-1.5 font-medium w-[32%]">分项</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusRows.map((row) => {
                        const expanded = expandedStatusSet.has(row.scenarioId);
                        const cleanupChecked = selectedCleanupSet.has(row.scenarioId);
                        return (
                          <Fragment key={row.scenarioId}>
                            <tr className="border-t border-slate-200/70 dark:border-border-dark/70">
                              <td className="px-2 py-1.5">
                                <label className="inline-flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={cleanupChecked}
                                    disabled={!row.injected || runningAction !== null}
                                    onChange={() => toggleCleanupScenario(row.scenarioId)}
                                  />
                                  <span className="text-slate-700 dark:text-slate-200 truncate">
                                    {scenarioNameMap.get(row.scenarioId) ?? row.scenarioId}
                                  </span>
                                </label>
                              </td>
                              <td className="px-2 py-1.5">
                                {row.injected ? (
                                  <span className="text-emerald-700 dark:text-emerald-300">
                                    已注入
                                  </span>
                                ) : (
                                  <span className="text-slate-500 dark:text-slate-400">
                                    未注入
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 font-mono text-slate-600 dark:text-slate-300">
                                {formatCount(row.totalCount)}
                              </td>
                              <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400">
                                {row.breakdown.length > 0 ? (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                                    onClick={() => toggleStatusRowExpanded(row.scenarioId)}
                                  >
                                    <span className="material-icons-outlined text-[14px] leading-none">
                                      {expanded ? "expand_less" : "expand_more"}
                                    </span>
                                    <span>
                                      {expanded ? "收起分项" : "展开分项"}（{row.breakdown.length}）
                                    </span>
                                  </button>
                                ) : (
                                  "--"
                                )}
                              </td>
                            </tr>
                            {expanded && row.breakdown.length > 0 && (
                              <tr className="border-t border-slate-200/70 dark:border-border-dark/70">
                                <td colSpan={4} className="px-2 py-1.5">
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                    {row.breakdown.map((item) => (
                                      <div
                                        key={`${row.scenarioId}:${item.label}`}
                                        className="flex items-center justify-between text-[11px]"
                                      >
                                        <span className="text-slate-500 dark:text-slate-400 truncate">
                                          {item.label}
                                        </span>
                                        <span className="font-mono text-slate-700 dark:text-slate-200">
                                          {formatCount(item.count)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {lastResult && (
              <div className="rounded-md border border-slate-200/70 dark:border-border-dark/70">
                <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-border-dark/70">
                  最近结果 · {lastResult.operation === "inject" ? "注入" : "清理"} ·{" "}
                  {formatDateTime(lastResult.finishedAt)}
                </div>
                <div className="p-2 text-xs text-slate-700 dark:text-slate-200 space-y-1">
                  <div>
                    总计：新增 {lastResult.inserted} · 更新 {lastResult.updated} ·
                    跳过 {lastResult.skipped} · 删除 {lastResult.deleted}
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {lastResult.scenarios.map((item) => (
                      <div
                        key={`${item.scenarioId}:${item.durationMs}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {scenarioNameMap.get(item.scenarioId) ?? item.scenarioId}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          +{item.inserted}/~{item.updated}/-{item.deleted}
                        </span>
                      </div>
                    ))}
                  </div>
                  {lastResult.warnings.length > 0 && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300">
                      告警：{lastResult.warnings.join("；")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
